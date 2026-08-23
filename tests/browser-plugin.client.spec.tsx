// @vitest-environment jsdom
/**
 * ui-token-viewer browser half on a real cordis Context with fake slots and
 * locale faces: the plugin registers the TokenDock strip at
 * conversation.input.dock, the SidebarTokenPanel card at
 * sidebar.workspaces.header, and the TokenDetailPanel drawer at
 * shell.overlay (sharing one store handle with the card). Registration
 * disposal rides the plugin fiber (HMR safety). The node half and the
 * invariant companion are exercised over the same Context.
 */
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'
import { SidebarTokenPanel } from '../src/client/SidebarTokenPanel.tsx'
import { TokenDock } from '../src/client/TokenDock.tsx'
import { TokenDetailPanel } from '../src/client/TokenDetailPanel.tsx'
import { apply as nodeApply } from '../src/index.ts'

afterEach(cleanup)

/** Boot the plugin over fake faces; the slots are declared by the root seat. */
async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  ctx.slots.register({
    name: 'root',
    children: {
      'conversation.input.dock': { kind: 'list', scope: 'session' },
      'sidebar.workspaces.header': { kind: 'single', scope: 'root' },
      'shell.overlay': { kind: 'list', scope: 'root' },
    },
  } as never, (() => null) as never)
  ctx.provide('locale', new LocaleRuntime(ctx))
  ctx.provide('sessions', { open: () => {} })
  ctx.provide('settingsScope', { bind: () => ({ getSnapshot: () => undefined, subscribe: () => () => {} }) })
  const fiber = ctx.plugin({ inject: [...inject], apply })
  return {
    ctx,
    fiber,
    dockEntry: () => ctx.slots.entries('conversation.input.dock')[0],
    headerEntry: () => ctx.slots.entries('sidebar.workspaces.header')[0],
    overlayEntry: () => ctx.slots.entries('shell.overlay')[0],
  }
}

describe('ui-token-viewer browser plugin', () => {
  it('registers the dock strip, the sidebar header card, and the overlay drawer', async () => {
    const b = await bench()
    await b.fiber.await()
    expect(b.dockEntry()?.options).toMatchObject({ id: 'token-viewer', order: 20 })
    expect(b.dockEntry()?.locale).toBe('tokenViewer')
    expect(b.dockEntry()?.component).toBe(TokenDock)
    expect(b.headerEntry()?.locale).toBe('tokenViewer')
    expect(b.headerEntry()?.component).toBe(SidebarTokenPanel)
    expect(b.overlayEntry()?.options).toMatchObject({ id: 'token-viewer-detail', order: 10 })
    expect(b.overlayEntry()?.locale).toBe('tokenViewer')
    expect(b.overlayEntry()?.component).toBe(TokenDetailPanel)
    // The card and the drawer share one store handle (open/close coupling).
    expect(b.headerEntry()?.store).toBe(b.overlayEntry()?.store)
  })

  it('drops every entry when the plugin fiber unloads (HMR safety)', async () => {
    const b = await bench()
    await b.fiber.await()
    expect(b.dockEntry()).toBeDefined()
    expect(b.headerEntry()).toBeDefined()
    expect(b.overlayEntry()).toBeDefined()
    await b.fiber.dispose()
    expect(b.dockEntry()).toBeUndefined()
    expect(b.headerEntry()).toBeUndefined()
    expect(b.overlayEntry()).toBeUndefined()
  })

  it('injects an openSession verb on the header card and the drawer', async () => {
    const b = await bench()
    await b.fiber.await()
    const cardFace = b.headerEntry()?.inject?.() as { openSession?: (id: unknown) => void } | undefined
    expect(typeof cardFace?.openSession).toBe('function')
    const drawerFace = b.overlayEntry()?.inject?.() as { openSession?: (id: unknown) => void } | undefined
    expect(typeof drawerFace?.openSession).toBe('function')
  })
})

describe('ui-token-viewer node half', () => {
  // The invariant companion is mounted by the vitest-wide invariant host on
  // every Context this suite creates; its registration is covered there.
  it('the node apply is an inert loader seat', () => {
    expect(() => { nodeApply() }).not.toThrow()
  })
})
