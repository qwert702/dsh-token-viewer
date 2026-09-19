/**
 * Token consumption surface plugin, browser half. Five entries, one surface:
 *
 *  - `sidebar.panellist` — the Token row of the sidebar's global panel list
 *    (the glyph only; the sidebar owns the button and resolves the label).
 *  - `main` (key `token`) — the Token panel page that row selects: balance,
 *    aggregate consumption, the drawer entry, and the per-conversation list.
 *  - `sidebar.footer.action` — the compact balance chip beside Settings.
 *  - `conversation.input.dock` — the live strip above the composer for the
 *    current Session.
 *  - `shell.overlay` — the CC Switch-style usage-statistics drawer.
 *
 * Every surface reads host-computed values: the Session surfaces read the
 * `tokenUsage` / `contextPressure` / `contextBreakdown` projections, and the
 * panel reads the per-Session projections the runtime already publishes on the
 * session-list rows. The only wire this plugin owns is the balance fetch,
 * through the host route — the browser never sees the API key.
 *
 * 0.1.6 note: the sidebar's `sidebar.workspaces.header` hole this plugin used
 * to fork no longer exists, and `dsh.client.inject` edges are prefetch
 * metadata rather than apply ordering, so every registration goes through
 * `slots.inject(...)` and waits for the owning entry to declare its hole.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { MainPanelId } from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls ui-layout's SlotMap merge (main, shell.overlay).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls ui-sidebar's SlotMap merge (sidebar.panellist,
// sidebar.footer.action).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls ui-conversation's SlotMap merge (conversation.input.dock).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { SessionId } from './types.ts'
import { SidebarTokenPanel, type SidebarTokenPanelInjected } from './SidebarTokenPanel.tsx'
import { TokenPanelIcon } from './TokenPanelIcon.tsx'
import { BalanceChip } from './BalanceChip.tsx'
import { TokenDock } from './TokenDock.tsx'
import { TokenDetailPanel, type TokenDetailPanelInjected } from './TokenDetailPanel.tsx'
import { en, zh, type TokenKey } from './locales.ts'

export type { SidebarTokenPanelProps, SidebarTokenPanelInjected } from './SidebarTokenPanel.tsx'
export type { TokenPanelIconProps } from './TokenPanelIcon.tsx'
export type { BalanceChipProps, BalanceChipOwnerProps } from './BalanceChip.tsx'
export type { TokenDetailPanelProps, TokenDetailPanelInjected } from './TokenDetailPanel.tsx'
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

/**
 * Identity shared by the sidebar panel row and the `main` page it opens. The
 * sidebar addresses the panel by this id, so it must be unique among the
 * deployment's global panels (`conversation` is the reserved one).
 */
const PANEL_ID = 'token' as MainPanelId

/** Required services: the slot registry and the dictionary namespace. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: seat the Token panel and its sidebar row, the balance
 * chip in the sidebar foot, the live dock strip, and the usage drawer.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-token-viewer: dictionaries')
  const t = ctx.locale.bind(NS)

  const openSession = (sessionId: SessionId): void => {
    const navigation = ctx.get('uiWorkspace') as { openSession?: (id: SessionId) => void } | undefined
    navigation?.openSession?.(sessionId)
  }
  const injected = (): SidebarTokenPanelInjected & TokenDetailPanelInjected => ({ openSession })

  ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main',
    key: PANEL_ID,
    locale: NS,
    inject: injected,
  }, SidebarTokenPanel))

  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist',
    id: PANEL_ID,
    order: 30,
    label: () => t('panel'),
    locale: NS,
  }, TokenPanelIcon))

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'token-viewer-balance',
    order: 10,
    label: () => t('balance'),
    locale: NS,
  }, BalanceChip))

  ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
    name: 'conversation.input.dock',
    id: 'token-viewer',
    order: 20,
    locale: NS,
  }, TokenDock))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'token-viewer-detail',
    order: 10,
    locale: NS,
    inject: injected,
  }, TokenDetailPanel))
}
