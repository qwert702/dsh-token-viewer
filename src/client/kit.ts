/**
 * Runtime-kit guards. A slot entry receives the runtime kit of its slot's
 * scope (`useSessions`, `useProjection`, `useStore`, ...), which is only
 * loosely typed at runtime — so a harness release can drop a hook this plugin
 * reads. Checking the kit inside a thin wrapper (instead of calling the hook)
 * keeps React's rules of hooks intact: the wrapper calls no hooks, and the
 * body that does call them simply never mounts.
 *
 * The failure mode is deliberate: a surface hides itself and warns once,
 * rather than throwing during render and taking the whole shell down.
 */

/** Surfaces that already warned, so a re-render does not spam the console. */
const warned = new Set<string>()

/**
 * Whether a surface's injected kit carries every hook it reads.
 * @param surface - diagnostic name of the surface (used in the warning).
 * @param kit - the slot props object carrying the runtime kit.
 * @param names - the hook names the surface calls.
 * @returns true when all of them are functions; otherwise warns once and false.
 */
export function requireKit(
  surface: string,
  kit: Record<string, unknown>,
  names: readonly string[],
): boolean {
  const missing = names.filter((name) => typeof kit[name] !== 'function')
  if (missing.length === 0) return true
  if (!warned.has(surface)) {
    warned.add(surface)
    console.warn(
      `[dsh-token-viewer] ${surface}: this harness does not supply ${missing.join(', ')} to the slot; `
      + 'the surface stays hidden (the plugin may need updating for this harness version)',
    )
  }
  return false
}
