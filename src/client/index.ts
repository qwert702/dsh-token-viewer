/**
 * Token consumption surface plugin, browser half: the TokenDock strip in the
 * composer dock (conversation.input.dock), the SidebarTokenPanel card above
 * the workspaces region (sidebar.workspaces.header), and the right-side
 * usage detail panel (shell.overlay). The surfaces read host-computed
 * token-meter projection values, so the plugin owns no refresh chain and no
 * event listener; the only wire is the balance fetch, through the host route.
 * The sidebar header hole is declared by the ui-sidebar shell; the overlay
 * hole by ui-layout. The detail panel's open/close state lives in one shared
 * store handle passed to both the card and the overlay entry.
 */
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the token-meter SessionProjectionMap merge (typed projection reads).
import type {} from '@deepseek-ai/dsh-token-meter/client'
// Type-only: pulls ui-conversation's SlotMap merge (the input.dock entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls ui-sidebar's SlotMap merge (the sidebar.workspaces.header entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls ui-layout's SlotMap merge (the shell.overlay entry).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { SidebarTokenPanel, type SidebarTokenPanelInjected } from './SidebarTokenPanel.tsx'
import { TokenDock } from './TokenDock.tsx'
import { TokenDetailPanel, type TokenDetailPanelInjected } from './TokenDetailPanel.tsx'
import { createTokenDetailStore } from './token-detail-store.ts'
import { en, zh, type TokenKey } from './locales.ts'

export type { SidebarTokenPanelProps, SidebarTokenPanelInjected } from './SidebarTokenPanel.tsx'
export type { TokenDetailPanelProps, TokenDetailPanelInjected } from './TokenDetailPanel.tsx'
export type { TokenDetailStore } from './token-detail-store.ts'
export type { TokenDockProps } from './TokenDock.tsx'
export type { TokenKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The token-usage surfaces' copy. */
    tokenViewer: TokenKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'tokenViewer'

/** Required services for the token dock and sidebar card. */
export const inject = ['slots', 'locale', 'sessions', 'settingsScope']

/**
 * Client plugin body: the dock strip, the sidebar header card, and the
 * right-side usage detail panel over the token-meter session projections; the
 * card opens a session from its per-conversation list (and the detail panel)
 * through the sessions service. The detail panel's open/close state rides one
 * shared store handle passed to both the card and the shell.overlay panel.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-token-viewer: dictionaries')

  const openSession = (sessionId: SessionId): void => { ctx.sessions.open(sessionId) }
  const tokenDetailStore = createTokenDetailStore()

  // Deployment default model for the model-stats table: the harness's
  // agent-default-model settings namespace, falling back to the DeepSeek
  // v4-flash list name when the namespace is not exposed to this client.
  const modelScope = ctx.settingsScope.bind({ namespace: 'agent-default-model' })
  const getDefaultModel = (): string => {
    const snapshot = modelScope.getSnapshot()
    const model = snapshot?.status === 'ready' ? snapshot.value?.model : undefined
    return typeof model === 'string' && model !== '' ? model : 'deepseek-v4-flash'
  }

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'token-viewer',
    order: 20,
    locale: NS,
  }, TokenDock))

  ctx.slots.inject('sidebar.workspaces.header', () => ctx.slots.register({
    name: 'sidebar.workspaces.header',
    locale: NS,
    store: tokenDetailStore,
    inject: (): SidebarTokenPanelInjected => ({ openSession }),
  }, SidebarTokenPanel))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'token-viewer-detail',
    order: 10,
    locale: NS,
    store: tokenDetailStore,
    inject: (): TokenDetailPanelInjected => ({ openSession, getDefaultModel }),
  }, TokenDetailPanel))
}
