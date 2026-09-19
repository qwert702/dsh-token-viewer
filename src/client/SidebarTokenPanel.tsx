/**
 * SidebarTokenPanel: the Token panel page (the `main` keyed slot, entry key
 * `token`) reached from the sidebar's Token row. Shows the DeepSeek account
 * balance (via the host proxy), aggregate token consumption across all
 * sessions, the entry that opens the statistics drawer, and the expandable
 * per-conversation list. Reads the per-session projection values the runtime
 * publishes on the session-list rows; the balance is the only wire, through
 * the host route.
 *
 * 0.1.6 replaced the sidebar shell's workspace-header hole this plugin used to
 * fork: `sidebar.workspaces` is single-occupancy, and the sanctioned way to add
 * a first-class surface is a panel selected from `sidebar.panellist` (the same
 * mechanism the stock Plugins panel uses). The panel's standard kit is
 * `useSessions` / `useWorkspaces` / `usePanelInfo` — no `useProjection` (that
 * hook is Session-scoped, so it reaches the composer dock, not a root panel)
 * and no `useStore`, which is why the drawer flag rides the module store.
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-layout's SlotMap merge (the `main` entry).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls ui-session's GlobalStandardProps merge (useSessions).
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls ui-workspace's GlobalStandardProps merge (useWorkspaces).
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
// Type-only: pulls the token-meter SessionProjectionMap merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import type { SessionId } from './types.ts'
import { useBalance } from './balance.ts'
import { requireKit } from './kit.ts'
import { BalanceRow } from './BalanceRow.tsx'
import { derivePerSession, deriveSidebarTotals, formatTokens } from './derive.ts'
import { PerSessionList } from './PerSessionList.tsx'
import { tokenDetailStore } from './token-detail-store.ts'
import css from './SidebarTokenPanel.module.css'

/** Business face injected by the client plugin body: open a session by id. */
export interface SidebarTokenPanelInjected {
  openSession: (sessionId: SessionId) => void
}

/** Full props of the Token panel: global kit + injected open verb + locale. */
export type SidebarTokenPanelProps = PropsRuntime<'main'> & SidebarTokenPanelInjected & PropsLocale<'tokenViewer'>

/**
 * Slot adapter for the Token panel page: renders the body only when the
 * runtime kit carries every hook it reads.
 * @param props - global kit, session-open verb, locale.
 * @returns the panel, or nothing.
 */
export function SidebarTokenPanel(props: SidebarTokenPanelProps) {
  if (!requireKit('SidebarTokenPanel', props, ['useSessions'])) return null
  return <SidebarTokenBody {...props} />
}

/**
 * Panel body: aggregates the per-session `tokenUsage` projection values over
 * the session list, composes the balance row + the per-conversation list, and
 * opens the detail drawer through the shared module store.
 * @param props - global kit, session-open verb, locale.
 * @returns the Token panel.
 */
function SidebarTokenBody({ useSessions, t, openSession }: SidebarTokenPanelProps) {
  const byId = useSessions((state) => state.byId)
  const totals = useMemo(() => deriveSidebarTotals(byId), [byId])
  const perSession = useMemo(() => derivePerSession(byId), [byId])
  const balance = useBalance()
  const [open, setOpen] = useState(false)
  const input = totals.uncached + totals.cacheRead + totals.cacheWrite
  const hasUsage = input > 0 || totals.output > 0
  const cacheHit = input > 0 ? Math.round((totals.cacheRead / input) * 100) : null
  const tooltipLines = [
    `${t('input')}: ${formatTokens(input)} ${t('tokens')} (${t('uncached')} ${formatTokens(totals.uncached)} · ${t('cacheRead')} ${formatTokens(totals.cacheRead)} · ${t('cacheWrite')} ${formatTokens(totals.cacheWrite)})`,
    `${t('output')}: ${formatTokens(totals.output)} ${t('tokens')}`,
    `${t('sessions')}: ${totals.sessions}`,
  ]
  if (cacheHit !== null) tooltipLines.push(`${t('cacheHit')}: ${cacheHit}%`)
  return (
    <div className={css.page} data-token-viewer-panel title={tooltipLines.join('\n')}>
      <div className={css.titleRow}>
        <div className={css.title}>{t('title')}</div>
        <BalanceRow balance={balance.state} onRefresh={balance.refresh} t={t} />
      </div>
      {hasUsage ? (
        <div className={css.line}>
          <span className={css.seg}>{t('input')} <strong>{formatTokens(input)}</strong></span>
          <span className={css.seg}>{t('output')} <strong>{formatTokens(totals.output)}</strong></span>
          {cacheHit !== null && <span className={css.seg}>{t('cacheHit')} <strong>{cacheHit}%</strong></span>}
          {totals.sessions > 0 && <span className={css.seg}>{t('sessions')} <strong>{totals.sessions}</strong></span>}
        </div>
      ) : (
        <div className={css.empty}>{t('noData')}</div>
      )}
      {hasUsage && (
        <button type="button" className={css.detailButton} onClick={() => { tokenDetailStore.setOpen(true) }}>
          {t('detail')} →
        </button>
      )}
      <PerSessionList rows={perSession} open={open} onToggle={() => { setOpen((v) => !v) }} onOpen={openSession} t={t} />
    </div>
  )
}

export type { TokenKey } from './locales.ts'
