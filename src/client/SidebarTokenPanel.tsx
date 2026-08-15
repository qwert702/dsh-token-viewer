/**
 * SidebarTokenPanel: a compact card ABOVE the sidebar's workspaces region.
 * Shows the DeepSeek account balance (via the host proxy), aggregate token
 * consumption across all sessions, and the expandable per-conversation list.
 * Reads the per-session projection values the runtime publishes on the
 * session-list rows; the balance is the only wire, through the host route.
 * Renders nothing until balance or usage is available, and nothing in the
 * collapsed rail (wide === false).
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-sidebar's SlotMap merge (the sidebar.workspaces.header entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the token-meter SessionProjectionMap merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { useBalance } from './balance.ts'
import { BalanceRow } from './BalanceRow.tsx'
import { derivePerSession, deriveSidebarTotals, formatTokens } from './derive.ts'
import { PerSessionList } from './PerSessionList.tsx'
import css from './SidebarTokenPanel.module.css'

/** Business face injected by the client plugin body: open a session by id. */
export interface SidebarTokenPanelInjected {
  openSession: (sessionId: SessionId) => void
}

/** Full props of the header card: global seat + owner wide flag + injected open + locale. */
export type SidebarTokenPanelProps = PropsRuntime<'sidebar.workspaces.header'> & SidebarTokenPanelInjected & PropsLocale<'tokenViewer'>

/**
 * Header-card adapter: aggregates the per-session `tokenUsage` projection
 * values over the session list and composes the balance row + the
 * per-conversation list.
 */
export function SidebarTokenPanel({ useSessions, wide, t, openSession }: SidebarTokenPanelProps) {
  const byId = useSessions((state) => state.byId)
  const totals = useMemo(() => deriveSidebarTotals(byId), [byId])
  const perSession = useMemo(() => derivePerSession(byId), [byId])
  const balance = useBalance()
  const [open, setOpen] = useState(false)
  if (!wide) return null
  const input = totals.uncached + totals.cacheRead + totals.cacheWrite
  const hasUsage = input > 0 || totals.output > 0
  const showBalance = balance.state.status === 'ok' && balance.state.balance !== null
  if (!hasUsage && !showBalance) return null
  const cacheHit = input > 0 ? Math.round((totals.cacheRead / input) * 100) : null
  const tooltipLines = [
    `${t('input')}: ${formatTokens(input)} ${t('tokens')} (${t('uncached')} ${formatTokens(totals.uncached)} · ${t('cacheRead')} ${formatTokens(totals.cacheRead)} · ${t('cacheWrite')} ${formatTokens(totals.cacheWrite)})`,
    `${t('output')}: ${formatTokens(totals.output)} ${t('tokens')}`,
    `${t('sessions')}: ${totals.sessions}`,
  ]
  if (cacheHit !== null) tooltipLines.push(`${t('cacheHit')}: ${cacheHit}%`)
  return (
    <div className={css.card} data-token-viewer-sidebar title={tooltipLines.join('\n')}>
      <div className={css.titleRow}>
        <div className={css.title}>{t('title')}</div>
        <BalanceRow balance={balance.state} onRefresh={balance.refresh} t={t} />
      </div>
      {hasUsage && (
        <div className={css.line}>
          <span className={css.seg}>{t('input')} <strong>{formatTokens(input)}</strong></span>
          <span className={css.seg}>{t('output')} <strong>{formatTokens(totals.output)}</strong></span>
          {cacheHit !== null && <span className={css.seg}>{t('cacheHit')} <strong>{cacheHit}%</strong></span>}
          {totals.sessions > 1 && <span className={css.seg}>{t('sessions')} <strong>{totals.sessions}</strong></span>}
        </div>
      )}
      <PerSessionList rows={perSession} open={open} onToggle={() => { setOpen((v) => !v) }} onOpen={openSession} t={t} />
    </div>
  )
}
