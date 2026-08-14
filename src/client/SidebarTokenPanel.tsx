/**
 * SidebarTokenPanel: a compact card ABOVE the sidebar's workspaces region
 * showing aggregate token consumption across all sessions (billed input,
 * output, cache hit rate, session count). Reads the per-session projection
 * values the runtime publishes on the session-list rows, so the card needs no
 * store and no wire. Renders nothing until a session reports usage, and
 * nothing in the collapsed rail (wide === false).
 */
import { useMemo } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-sidebar's SlotMap merge (the sidebar.workspaces.header entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
// Type-only: pulls the token-meter SessionProjectionMap merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { deriveSidebarTotals, formatTokens } from './derive.ts'
import css from './SidebarTokenPanel.module.css'

/** Full props of the header card: global seat + owner wide flag + locale seat. */
export type SidebarTokenPanelProps = PropsRuntime<'sidebar.workspaces.header'> & PropsLocale<'tokenViewer'>

/** The card's hover detail: the full billing breakdown plus session count. */
function panelTooltip(
  input: number,
  output: number,
  cacheHit: number | null,
  sessions: number,
  uncached: number,
  cacheRead: number,
  cacheWrite: number,
  t: SidebarTokenPanelProps['t'],
): string {
  const lines = [
    `${t('input')}: ${formatTokens(input)} ${t('tokens')} (${t('uncached')} ${formatTokens(uncached)} · ${t('cacheRead')} ${formatTokens(cacheRead)} · ${t('cacheWrite')} ${formatTokens(cacheWrite)})`,
    `${t('output')}: ${formatTokens(output)} ${t('tokens')}`,
    `${t('sessions')}: ${sessions}`,
  ]
  if (cacheHit !== null) lines.push(`${t('cacheHit')}: ${cacheHit}%`)
  return lines.join('\n')
}

/**
 * Header-card adapter: aggregates the per-session `tokenUsage` projection
 * values over the session list.
 */
export function SidebarTokenPanel({ useSessions, wide, t }: SidebarTokenPanelProps) {
  const byId = useSessions((state) => state.byId)
  const totals = useMemo(() => deriveSidebarTotals(byId), [byId])
  if (!wide) return null
  const input = totals.uncached + totals.cacheRead + totals.cacheWrite
  if (input <= 0 && totals.output <= 0) return null
  const cacheHit = input > 0 ? Math.round((totals.cacheRead / input) * 100) : null
  return (
    <div className={css.card} data-token-viewer-sidebar title={panelTooltip(input, totals.output, cacheHit, totals.sessions, totals.uncached, totals.cacheRead, totals.cacheWrite, t)}>
      <div className={css.title}>{t('title')}</div>
      <div className={css.line}>
        <span className={css.seg}>{t('input')} <strong>{formatTokens(input)}</strong></span>
        <span className={css.seg}>{t('output')} <strong>{formatTokens(totals.output)}</strong></span>
        {cacheHit !== null && <span className={css.seg}>{t('cacheHit')} <strong>{cacheHit}%</strong></span>}
        {totals.sessions > 1 && <span className={css.seg}>{t('sessions')} <strong>{totals.sessions}</strong></span>}
      </div>
    </div>
  )
}
