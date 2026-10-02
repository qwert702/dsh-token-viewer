// @vitest-environment jsdom
/**
 * ui-token-viewer browser half: `apply()` runs against a recording slots and
 * locale face (the same stub shape the harness-free smoke test uses) and must
 * register exactly the six stock-slot entries of the 0.1.6+ contract — the
 * sidebar panel row + keyed `main` page, the sidebar-foot balance chip, the
 * composer dock strip, and the shell overlay drawer — each waiting on
 * `slots.inject()` and carrying the tokenViewer locale namespace. Registration
 * disposal is what makes HMR safe. The node half is exercised by
 * test/smoke.cjs.
 */
import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/client/index.ts'
import { SidebarTokenPanel } from '../src/client/SidebarTokenPanel.tsx'
import { TokenPanelIcon } from '../src/client/TokenPanelIcon.tsx'
import { BalanceChip } from '../src/client/BalanceChip.tsx'
import { TokenDock } from '../src/client/TokenDock.tsx'
import { TokenDetailPanel } from '../src/client/TokenDetailPanel.tsx'
import { TokenPet } from '../src/client/TokenPet.tsx'

/** The six stock-slot entries this plugin registers into, with 0.1.6+ entry facts. */
const EXPECTED = [
  { slot: 'main', key: 'token', component: SidebarTokenPanel },
  { slot: 'sidebar.panellist', id: 'token', order: 30, component: TokenPanelIcon },
  { slot: 'sidebar.footer.action', id: 'token-viewer-balance', order: 10, component: BalanceChip },
  { slot: 'conversation.input.dock', id: 'token-viewer', order: 20, component: TokenDock },
  { slot: 'shell.overlay', id: 'token-viewer-detail', order: 10, component: TokenDetailPanel },
  { slot: 'shell.overlay', id: 'token-viewer-pet', order: 20, component: TokenPet },
]

interface Recording {
  injections: Array<{ slot: string; register: () => { dispose: () => void } }>
  registrations: Array<{ options: Record<string, unknown>; component: unknown; dispose: () => void }>
  dictionaries: string[]
}

/** A stub client context with recording slots and locale services. */
function makeCtx(): Recording & {
  ctx: Parameters<typeof apply>[0]
} {
  const recording: Recording = { injections: [], registrations: [], dictionaries: [] }
  const ctx = {
    effect: (factory: () => unknown) => { factory(); return () => undefined },
    get: () => undefined,
    locale: {
      register: (namespace: string) => { recording.dictionaries.push(namespace) },
      bind: (namespace: string) => (key: string) => `${namespace}.${key}`,
    },
    slots: {
      inject: (slot: string, factory: () => { dispose: () => void }) => {
        const registration = factory()
        recording.injections.push({ slot, register: () => registration })
        return () => { registration.dispose() }
      },
      register: (options: Record<string, unknown>, component: unknown) => {
        const dispose = () => { recording.registrations.splice(recording.registrations.findIndex((r) => r.options === options), 1) }
        recording.registrations.push({ options, component, dispose })
        return { dispose }
      },
    },
  } as unknown as Parameters<typeof apply>[0]
  return { ctx, ...recording }
}

describe('ui-token-viewer browser plugin', () => {
  it('declares the slots + locale inject list', () => {
    expect(inject).toEqual(['slots', 'locale'])
  })

  it('registers exactly the six stock-slot entries', () => {
    const b = makeCtx()
    apply(b.ctx)
    expect(b.dictionaries).toContain('tokenViewer')
    expect(b.injections.map((i) => i.slot)).toEqual(EXPECTED.map((e) => e.slot))
    expect(b.registrations).toHaveLength(EXPECTED.length)
    for (const [index, registration] of b.registrations.entries()) {
      const expected = EXPECTED[index]!
      expect(registration.options.name).toBe(expected.slot)
      expect(registration.options.locale).toBe('tokenViewer')
      expect(registration.component).toBe(expected.component)
      if (expected.id !== undefined) expect(registration.options.id).toBe(expected.id)
      if (expected.order !== undefined) expect(registration.options.order).toBe(expected.order)
      if (expected.key !== undefined) expect(registration.options.key).toBe(expected.key)
    }
  })

  it('addresses the main panel from the sidebar panel row', () => {
    const b = makeCtx()
    apply(b.ctx)
    const row = b.registrations.find((r) => r.options.name === 'sidebar.panellist')
    const page = b.registrations.find((r) => r.options.name === 'main')
    expect(row?.options.id).toBe(page?.options.key)
  })

  it('resolves a non-empty label for the nav-style rows', () => {
    const b = makeCtx()
    apply(b.ctx)
    for (const registration of b.registrations) {
      const label = registration.options.label
      if (typeof label !== 'function') continue
      expect((label as (locale: unknown) => string)(undefined)).not.toBe('')
    }
  })

  it('injects an openSession verb on the main page and the drawer', () => {
    const b = makeCtx()
    apply(b.ctx)
    for (const registration of b.registrations) {
      if (registration.options.name !== 'main' && registration.options.name !== 'shell.overlay') continue
      if (registration.options.inject === undefined) continue // the pet opts out of the shared verb
      // the register factory was already invoked by slots.inject(); re-invoke it
      // the way the harness does at seat time and read the inject face
      const face = (registration.options as { inject?: () => unknown }).inject?.()
      expect(typeof (face as { openSession?: unknown })?.openSession).toBe('function')
    }
  })

  it('drops every entry when its slots.inject disposer runs (HMR safety)', () => {
    const b = makeCtx()
    apply(b.ctx)
    expect(b.registrations).toHaveLength(EXPECTED.length)
    for (const injection of b.injections) injection.register().dispose()
    expect(b.registrations).toHaveLength(0)
  })
})
