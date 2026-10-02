// Compiles both halves of the plugin:
//
//   src/index.ts        → lib/index.js   (node half: projections, settings
//                                         namespace, balance + pricing routes)
//   src/client/index.ts → lib/client.js  (browser half: the loader bundle)
//
// src/ is the single source of truth: the previous build vendored a fork of the
// stock sidebar bundle (with its own copy of the CSS and shell locales), which
// silently drifted from src/ on every edit. This one compiles only this
// package's own modules and leaves every harness module to the runtime.
//
// esbuild is NOT a dependency of this package (its node_modules is a junction
// into the harness install tree). Resolution order:
//   1. $DSH_ESBUILD_WORKSPACE — a directory whose node_modules holds esbuild
//   2. the managed WorkBuddy node workspace
//   3. plain `import('esbuild')` for a checkout that does have it
//
// Run:  node scripts/build-client.mjs

import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dir = path.dirname(fileURLToPath(import.meta.url))
const pkgRoot = path.resolve(dir, '..')
const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'))
const PLUGIN_ID = pkg.name
const hostEntry = path.join(pkgRoot, 'src', 'index.ts')
const clientEntry = path.join(pkgRoot, 'src', 'client', 'index.ts')
const hostOut = path.join(pkgRoot, 'lib', 'index.js')
const clientOut = path.join(pkgRoot, 'lib', 'client.js')

/** Specifiers the runtime's static module table provides (`staticModules` in the web shell). */
const STATIC_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

/**
 * Resolve esbuild from the first anchor that carries it.
 * @returns the esbuild module.
 */
async function loadEsbuild() {
  const require = createRequire(import.meta.url)
  const anchors = [
    process.env.DSH_ESBUILD_WORKSPACE,
    path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.workbuddy', 'binaries', 'node', 'workspace'),
  ].filter((anchor) => typeof anchor === 'string' && anchor !== '')
  for (const anchor of anchors) {
    const manifest = path.join(anchor, 'package.json')
    if (!existsSync(manifest)) continue
    try {
      return createRequire(manifest)('esbuild')
    } catch { /* try the next anchor */ }
  }
  return require('esbuild')
}

/** Stable 32-bit FNV-1a hash, used to scope CSS module class names. */
function hash32(text) {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/**
 * `\.` followed by a class identifier. The identifier must start with a letter
 * or underscore, which is what keeps CSS custom properties (`var(--dsw-…)`)
 * and decimal literals (`1.5rem`) out of the match.
 */
const CLASS_SELECTOR = /\.([A-Za-z_][\w-]*)/g

/**
 * CSS Modules without a CSS pipeline: each `.module.css` load is rewritten into
 * a JS module that scopes its class names, injects one `<style>` tag at
 * materialization (the loader runs factory bodies lazily, so the tag lands when
 * the plugin is imported, not when the script executes), and default-exports
 * the original-name → scoped-name map.
 */
const cssModulesPlugin = {
  name: 'dsh-css-modules',
  setup(build) {
    build.onLoad({ filter: /\.module\.css$/ }, (args) => {
      const source = readFileSync(args.path, 'utf8')
      const relative = path.relative(pkgRoot, args.path).split(path.sep).join('/')
      const scope = `tv${hash32(relative).toString(36)}_`
      const classes = {}
      const scoped = source.replace(CLASS_SELECTOR, (_match, name) => {
        if (classes[name] === undefined) classes[name] = scope + name
        return '.' + classes[name]
      })
      const tagId = `${PLUGIN_ID}/${relative}`
      const contents = [
        `const css = ${JSON.stringify(scoped)};`,
        `const tagId = ${JSON.stringify(tagId)};`,
        'if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {',
        '  const tag = document.createElement("style");',
        `  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};`,
        '  tag.dataset.pluginCss = tagId;',
        '  tag.textContent = css;',
        '  document.head.appendChild(tag);',
        '}',
        `export default ${JSON.stringify(classes)};`,
      ].join('\n')
      return { contents, loader: 'js' }
    })
  },
}

/**
 * Compile the node half into lib/index.js. The package is `"type": "module"`,
 * so the output is ESM; every bare specifier stays an external import resolved
 * from the harness install tree at run time.
 * @param esbuild - the loaded esbuild module.
 * @returns nothing.
 */
async function buildHost(esbuild) {
  const result = await esbuild.build({
    entryPoints: [hostEntry],
    outfile: hostOut,
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: ['node20'],
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'warning',
    tsconfigRaw: {},
    packages: 'external',
  })
  const [artifact] = result.outputFiles
  mkdirSync(path.dirname(hostOut), { recursive: true })
  writeFileSync(hostOut, artifact.text)
  const kb = (Buffer.byteLength(artifact.text) / 1024).toFixed(1)
  console.log(`built ${path.relative(pkgRoot, hostOut).split(path.sep).join('/')} (${kb} kB)`)
}

/**
 * Compile the browser half into lib/client.js.
 * @param esbuild - the loaded esbuild module.
 * @returns nothing.
 */
async function buildClient(esbuild) {
  const result = await esbuild.build({
    entryPoints: [clientEntry],
    outfile: clientOut,
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: ['es2020'],
    jsx: 'automatic',
    charset: 'utf8',
    legalComments: 'none',
    logLevel: 'warning',
    // The repo's tsconfig.json extends a path from the upstream monorepo, which
    // does not exist in an installed checkout; compile settings live here.
    tsconfigRaw: { compilerOptions: { jsx: 'react-jsx' } },
    // The runtime's static module table seeds react and the framework modules;
    // everything else in the bundle must be self-contained. PNGs inline as data
    // URIs — a separate emitted file could never be served by the single-file
    // module loader.
    external: STATIC_MODULES,
    loader: { '.png': 'dataurl' },
    plugins: [cssModulesPlugin],
    banner: {
      js: [
        'window.__ModuleLoader__.load({',
        `\tid: ${JSON.stringify(PLUGIN_ID)},`,
        '\tfactory: (require) => {',
        '\t\tvar module = { exports: {} };',
        '\t\tvar exports = module.exports;',
        '\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });',
      ].join('\n'),
    },
    footer: {
      js: [
        '\t\treturn module.exports;',
        '\t}',
        '});',
      ].join('\n'),
    },
  })

  const [artifact] = result.outputFiles
  mkdirSync(path.dirname(clientOut), { recursive: true })
  writeFileSync(clientOut, artifact.text)
  const kb = (Buffer.byteLength(artifact.text) / 1024).toFixed(1)
  console.log(`built ${path.relative(pkgRoot, clientOut).split(path.sep).join('/')} (${kb} kB)`)
}

/**
 * Compile both halves.
 * @returns nothing.
 */
async function main() {
  const esbuild = await loadEsbuild()
  await buildHost(esbuild)
  await buildClient(esbuild)
}

await main()
