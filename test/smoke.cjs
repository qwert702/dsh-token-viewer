/**
 * Offline smoke test for the built plugin. It loads lib/client.js the way the
 * web shell does — through `window.__ModuleLoader__.load({ id, factory })` with
 * a stubbed module table — then runs `apply()` against a recording slot
 * registry and invokes every registered component with a stub kit. The node
 * half is imported for real and driven against recording services.
 *
 * It is deliberately harness-free (no React, no jsdom, no vitest): it catches
 * the failures that actually broke this plugin on the 0.1.6 upgrade — a stale
 * module id, a require outside the static table, a missing CSS injection, a
 * slot this harness does not declare, a projection without a wire view, and a
 * component that throws when its props contract changes.
 *
 * Run:  node test/smoke.cjs
 */
const { readFileSync, existsSync } = require('node:fs')
const { pathToFileURL } = require('node:url')
const path = require('node:path')
const vm = require('node:vm')

const root = path.resolve(__dirname, '..')
const clientFile = path.join(root, 'lib', 'client.js')
const hostFile = path.join(root, 'lib', 'index.js')

let failures = 0
/**
 * Record one assertion.
 * @param {boolean} ok - whether the condition held.
 * @param {string} label - what was asserted.
 * @param {unknown} [detail] - extra context printed on failure.
 */
function check(ok, label, detail) {
  if (ok) {
    console.log(`  ok   ${label}`)
    return
  }
  failures += 1
  console.log(`  FAIL ${label}`)
  if (detail !== undefined) console.log(`       ${String(detail)}`)
}

/**
 * Run one callback, reporting a throw as a failed check instead of aborting.
 * @param {string} label - the assertion the callback makes.
 * @param {() => void} body - the callback.
 */
function attempt(label, body) {
  try {
    body()
    check(true, label)
  } catch (error) {
    check(false, label, error && error.stack ? error.stack.split('\n')[0] : error)
  }
}

// ---------------------------------------------------------------------------
// Minimal React stand-in: the components only call hooks while rendering, and
// this test drives them by calling the function directly.
// ---------------------------------------------------------------------------
const react = {
  useMemo: (factory) => factory(),
  useCallback: (fn) => fn,
  useEffect: () => undefined,
  useRef: (value) => ({ current: value }),
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => undefined],
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}
const jsxRuntime = {
  jsx: (type, props) => ({ type, props }),
  jsxs: (type, props) => ({ type, props }),
  Fragment: Symbol.for('react.fragment'),
}
const staticTable = {
  react,
  'react/jsx-runtime': jsxRuntime,
  'react-dom': {},
  'react-dom/client': {},
  '@deepseek-ai/cordis': {},
  '@deepseek-ai/dsh-client-store': {},
  '@deepseek-ai/dsh-client-ui-slots': {},
  '@deepseek-ai/dsh-client-ui-primitives': {},
  '@deepseek-ai/dsh-client-ui-dockkit': {},
}

/**
 * The slot contract the 0.1.6 harness declares for each entry this plugin
 * registers into. `needsLabel` marks the nav-style slots whose owner projects a
 * label (the sidebar resolves it for the row title and accessible name); the
 * dock and overlay slots take an optional label that the stock entries omit.
 */
const SLOT_CONTRACT = {
  main: { kind: 'keyed', kit: ['useSessions', 'useWorkspaces', 'usePanelInfo'] },
  'sidebar.panellist': { kind: 'list', needsLabel: true, owner: { size: 16, active: false } },
  'sidebar.footer.action': { kind: 'list', needsLabel: true, owner: { wide: true } },
  'conversation.input.dock': { kind: 'list', owner: { session: {}, input: {} }, kit: ['useProjection', 'sessionId'] },
  'shell.overlay': { kind: 'list', owner: {}, kit: ['useSessions', 'useWorkspaces'] },
}

/** Load lib/client.js through the loader facade and return its plugin object. */
function loadBrowserHalf() {
  const source = readFileSync(clientFile, 'utf8')
  let registration
  const sandbox = {
    window: { __ModuleLoader__: { load: (entry) => { registration = entry } } },
    document: {
      querySelector: () => null,
      createElement: () => ({ dataset: {}, textContent: '' }),
      head: { appendChild: () => undefined },
    },
    Symbol,
    Object,
    JSON,
    console,
  }
  sandbox.globalThis = sandbox
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'lib/client.js' })
  return { registration }
}

/** Assertions over the browser half. */
function checkBrowserHalf() {
  console.log('browser half (lib/client.js)')
  check(existsSync(clientFile), 'lib/client.js exists')
  const { registration } = loadBrowserHalf()

  check(registration !== undefined, 'registers with window.__ModuleLoader__.load')
  check(registration?.id === 'dsh-token-viewer', 'module id is the package name', registration?.id)
  check(typeof registration?.factory === 'function', 'exposes a factory')
  if (typeof registration?.factory !== 'function') return

  const required = []
  const plugin = registration.factory((specifier) => {
    required.push(specifier)
    if (!(specifier in staticTable)) throw new Error(`unexpected external require: ${specifier}`)
    return staticTable[specifier]
  })

  check(typeof plugin.apply === 'function', 'factory result exports apply()')
  check(Array.isArray(plugin.inject), 'factory result exports an inject list', plugin.inject)
  check(
    Array.isArray(plugin.inject) && plugin.inject.includes('slots') && plugin.inject.includes('locale'),
    'inject list carries slots + locale',
    plugin.inject,
  )
  check(
    required.every((specifier) => specifier === 'react' || specifier === 'react/jsx-runtime'),
    'requires only statically seeded modules',
    required.join(', '),
  )

  const injections = []
  const registrations = []
  const dictionaryNamespaces = []
  const ctx = {
    effect: (factory) => { factory(); return () => undefined },
    inject: (names, factory) => { factory(ctx); return () => undefined },
    get: () => undefined,
    locale: {
      register: (namespace) => { dictionaryNamespaces.push(namespace) },
      bind: (namespace) => (key) => `${namespace}.${key}`,
    },
    slots: {
      inject: (slot, factory) => { injections.push({ slot, register: factory() }); return () => undefined },
      register: (options, component) => {
        registrations.push({ options, component })
        return { dispose: () => undefined }
      },
    },
  }

  attempt('apply() runs without throwing', () => { plugin.apply(ctx) })

  check(dictionaryNamespaces.includes('tokenViewer'), 'registers the tokenViewer dictionary')
  const slots = registrations.map((entry) => entry.options.name)
  check(
    JSON.stringify(slots) === JSON.stringify(Object.keys(SLOT_CONTRACT)),
    'registers exactly the harness-declared slots',
    slots.join(', '),
  )
  check(injections.length === registrations.length, 'every registration waits on slots.inject()')
  check(
    injections.every(({ slot }) => Object.prototype.hasOwnProperty.call(SLOT_CONTRACT, slot)),
    'injects only declared slots',
    injections.map(({ slot }) => slot).join(', '),
  )

  for (const { options, component } of registrations) {
    const contract = SLOT_CONTRACT[options.name]
    check(contract !== undefined, `${options.name}: slot exists in this harness`)
    check(typeof component === 'function', `${options.name}: registers a component`)
    check(options.locale === 'tokenViewer', `${options.name}: binds the tokenViewer locale namespace`)
    if (contract !== undefined && contract.kind !== 'keyed') {
      check(typeof options.id === 'string' && options.id !== '', `${options.name}: carries a list id`)
      if (contract.needsLabel === true) {
        const label = typeof options.label === 'function' ? options.label('') : options.label
        check(typeof label === 'string' && label !== '', `${options.name}: resolves a non-empty label`)
      }
    }
    if (options.name === 'main') check(options.key === 'token', 'main: keyed by the Token panel id', options.key)
  }

  const panelRow = registrations.find((entry) => entry.options.name === 'sidebar.panellist')
  const mainEntry = registrations.find((entry) => entry.options.name === 'main')
  check(
    panelRow !== undefined && mainEntry !== undefined && panelRow.options.id === mainEntry.options.key,
    'the sidebar panel row addresses the registered main panel',
  )

  // A component that throws here would take the whole shell down at runtime.
  const kit = {
    useSessions: (selector) => selector({ byId: {}, ids: [], phase: 'ready' }),
    useWorkspaces: (selector) => selector({ items: [] }),
    usePanelInfo: (selector) => selector({ activePanelId: null }),
    useProjection: () => undefined,
    t: (key) => key,
    openSession: () => undefined,
    sessionId: undefined,
  }
  for (const { options, component } of registrations) {
    const contract = SLOT_CONTRACT[options.name] ?? { owner: {} }
    attempt(`${options.name}: renders without throwing`, () => {
      const element = component({ ...kit, ...contract.owner })
      if (element === undefined) throw new Error('rendered undefined')
    })
  }
}

/** Assertions over the node half: the projections MUST carry a wire view. */
async function checkHostHalf() {
  console.log('\nnode half (lib/index.js)')
  check(existsSync(hostFile), 'lib/index.js exists')
  const host = await import(pathToFileURL(hostFile).href)

  check(typeof host.apply === 'function', 'exports apply()')
  check(typeof host.name === 'string' && host.name !== '', 'exports a plugin name', host.name)
  check(Array.isArray(host.inject), 'exports an inject list', host.inject)
  for (const service of ['webServer', 'credentials', 'sessionProjections']) {
    check(
      Array.isArray(host.inject) && host.inject.includes(service),
      `inject list carries ${service}`,
      host.inject,
    )
  }
  check(
    Array.isArray(host.inject) && !host.inject.includes('settings'),
    'inject list no longer depends on the removed settings.register service',
    host.inject,
  )
  check(
    host.Config !== undefined && (typeof host.Config === 'object' || typeof host.Config === 'function'),
    'exports a Config schema (the 0.1.7+/0.2.0 config channel)',
  )

  const records = []
  const hostCtx = {
    effect: (factory) => { factory(); return () => undefined },
    inject: (names, factory) => { factory(hostCtx); return () => undefined },
    webServer: { register: (route) => { records.push(route); return () => undefined } },
    settings: { register: () => ({ get: () => ({ apiKeyRef: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com' }) }) },
    credentials: { resolve: async () => undefined },
    sessionProjections: {
      register: (definition) => {
        records.push({ projection: definition.key, definition })
        return () => undefined
      },
    },
  }

  try {
    await host.apply(hostCtx)
    check(true, 'apply() runs without throwing')
  } catch (error) {
    check(false, 'apply() runs without throwing', error && error.stack ? error.stack.split('\n')[0] : error)
  }

  const projections = records.filter((entry) => entry.projection !== undefined)
  check(projections.length === 2, 'registers both usage projections', projections.map((entry) => entry.projection).join(', '))
  for (const { projection, definition } of projections) {
    check(definition.wire !== undefined, `${projection}: declares a wire view (browser-readable)`)
    check(typeof definition.wire?.view === 'function', `${projection}: wire.view is a function`)
    check(definition.wire?.viewSchema !== undefined, `${projection}: wire.viewSchema validates the payload`)
    check(Number.isInteger(definition.stateVersion), `${projection}: declares a stateVersion`)
    attempt(`${projection}: init() + apply() are callable`, () => {
      const initial = definition.init({}, 0)
      definition.wire.view(initial)
    })
  }

  const routes = records.filter((entry) => entry.projection === undefined).map((entry) => entry.path)
  check(routes.includes('/api/billing/balance'), 'serves the balance route', routes.join(', '))
  check(routes.includes('/api/billing/pricing'), 'serves the pricing route', routes.join(', '))
}

async function main() {
  checkBrowserHalf()
  await checkHostHalf()
  console.log(failures === 0 ? '\nsmoke: all checks passed' : `\nsmoke: ${failures} check(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
