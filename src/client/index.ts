/**
 * Token consumption surface plugin, browser half: the TokenDock strip in the
 * composer dock (conversation.input.dock) and the SidebarTokenPanel card above
 * the workspaces region (sidebar.workspaces.header). Both are projection-mode
 * surfaces — the numbers arrive as host-computed token-meter projection values,
 * so this plugin owns no store, no refresh chain, and no event listener. The
 * sidebar header hole is declared by the ui-sidebar shell; this plugin only
 * contributes the card.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the token-meter SessionProjectionMap merge (typed projection reads).
import type {} from '@deepseek-ai/dsh-token-meter/client'
// Type-only: pulls ui-conversation's SlotMap merge (the input.dock entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls ui-sidebar's SlotMap merge (the sidebar.workspaces.header entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import { SidebarTokenPanel, type SidebarTokenPanelInjected } from './SidebarTokenPanel.tsx'
import { TokenDock } from './TokenDock.tsx'
import { en, zh, type TokenKey } from './locales.ts'

export type { SidebarTokenPanelProps, SidebarTokenPanelInjected } from './SidebarTokenPanel.tsx'
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
export const inject = ['slots', 'locale', 'sessions']

/**
 * Client plugin body: the dock strip and the sidebar header card over the
 * token-meter session projections; the card opens a session from its
 * per-conversation list through the sessions service.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-token-viewer: dictionaries')

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'token-viewer',
    order: 20,
    locale: NS,
  }, TokenDock))

  ctx.slots.inject('sidebar.workspaces.header', () => ctx.slots.register({
    name: 'sidebar.workspaces.header',
    locale: NS,
    inject: (): SidebarTokenPanelInjected => ({
      openSession: (sessionId) => { ctx.sessions.open(sessionId) },
    }),
  }, SidebarTokenPanel))
}
