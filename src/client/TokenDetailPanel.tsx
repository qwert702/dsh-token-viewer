/**
 * TokenDetailPanel: the right-side usage statistics drawer opened from the
 * sidebar card, styled after CC Switch's usage page — a time-range filter, a
 * hero row of summary cards (real usage, estimated cost, cache hit rate,
 * session count, balance), an approximate usage-trend bar chart, per-model and
 * per-workspace (project) statistics tables, and a per-conversation log table
 * with time/input/output/cache/cost columns. Clicking a conversation row opens
 * that session and closes the panel. Registered into shell.overlay, renders
 * nothing while closed (click-through), and takes over pointer events only
 * when open. The time range and the trend filter by each session's last
 * activity — the harness projects cumulative totals, not per-request usage,
 * so the numbers are approximate for non-"all" ranges and the trend is by last
 * activity; model stats fold the host's per-model `modelUsage` projection
 * (each session's assistant usage attributed to its message model), falling
 * back to the deployment default model only when no session reports it.
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-layout's SlotMap merge (the shell.overlay entry).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the token-meter SessionProjectionMap merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { useBalance } from './balance.ts'
import {
  currencySymbol, derivePerModel, derivePerSession, derivePerWorkspace, deriveSidebarTotals, deriveUsageTrend, formatCost,
  formatMoney, formatTokens, rangeSinceMs, type UsageRange,
} from './derive.ts'
import type { TokenDetailStore } from './token-detail-store.ts'
import css from './TokenDetailPanel.module.css'

/** Business face injected by the client plugin body: open a session by id, and the default model label. */
export interface TokenDetailPanelInjected {
  openSession: (sessionId: SessionId) => void
  /** Deployment default model name (all usage is attributed to it). */
  getDefaultModel: () => string
}

/** Full props of the detail panel: global seat + shared store + open verb + locale. */
export type TokenDetailPanelProps = PropsRuntime<'shell.overlay'> & PropsStore<TokenDetailStore> & TokenDetailPanelInjected & PropsLocale<'tokenViewer'>

/** Clock label for one session row (HH:MM, plus date when not today). */
function clockLabel(updatedAt: number): string {
  const d = new Date(updatedAt)
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  return sameDay ? hhmm : `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hhmm}`
}

/** One hero summary card. */
function HeroCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={css.heroCard}>
      <div className={css.heroLabel}>{label}</div>
      <div className={accent ? css.heroValueAccent : css.heroValue}>{value}</div>
    </div>
  )
}

/**
 * Render the right-side statistics drawer.
 * @param props - global seat, shared open store, session-open verb, locale.
 * @returns the drawer, or nothing while closed.
 */
export function TokenDetailPanel({ useStore, useSessions, useWorkspaces, actions, t, openSession, getDefaultModel }: TokenDetailPanelProps) {
  const open = useStore((state) => state.open)
  const byId = useSessions((state) => state.byId)
  const workspaceItems = useWorkspaces((state) => state.items)
  const balance = useBalance()
  const [range, setRange] = useState<UsageRange>('all')
  const sinceMs = useMemo(() => rangeSinceMs(range), [range])
  const totals = useMemo(() => deriveSidebarTotals(byId, sinceMs), [byId, sinceMs])
  const perWorkspace = useMemo(() => derivePerWorkspace(workspaceItems, byId, sinceMs), [workspaceItems, byId, sinceMs])
  const perSession = useMemo(() => derivePerSession(byId, sinceMs), [byId, sinceMs])
  const perModel = useMemo(() => derivePerModel(byId, sinceMs), [byId, sinceMs])
  const trend = useMemo(() => deriveUsageTrend(byId, range), [byId, range])
  const trendMax = useMemo(() => Math.max(1, ...trend.map((p) => p.input + p.output + p.cacheRead)), [trend])
  if (!open) return null
  const input = totals.uncached + totals.cacheRead + totals.cacheWrite
  const cacheHit = input > 0 ? Math.round((totals.cacheRead / input) * 100) : null
  const cost = perSession.reduce((sum, row) => sum + row.cost, 0)
  const balanceOk = balance.state.status === 'ok' && balance.state.balance !== null
  const close = () => { actions.setOpen(false) }
  const ranges: UsageRange[] = ['all', 'today', '7d']
  return (
    <div className={css.backdrop} onClick={close} data-token-detail>
      <div className={css.panel} role="dialog" aria-label={t('title')} onClick={(e) => { e.stopPropagation() }}>
        <div className={css.header}>
          <div className={css.headerTitle}>{t('title')}</div>
          <button type="button" className={css.close} onClick={close} aria-label={t('close')}>✕</button>
        </div>
        <div className={css.body}>
          <div className={css.toolbar}>
            <span className={css.toolbarLabel}>{t('range')}</span>
            <div className={css.segmented} role="group" aria-label={t('range')}>
              {ranges.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={range === r ? css.segmentActive : css.segment}
                  onClick={() => { setRange(r) }}
                >
                  {t(r === 'all' ? 'all' : r === 'today' ? 'today' : 'last7d')}
                </button>
              ))}
            </div>
          </div>

          <div className={css.hero}>
            <HeroCard label={t('realUsage')} value={formatTokens(input + totals.output)} />
            <HeroCard label={t('cost')} value={formatCost(cost)} accent />
            <HeroCard label={t('cacheHit')} value={cacheHit === null ? '—' : `${cacheHit}%`} />
            <HeroCard label={t('sessions')} value={String(perSession.length)} />
            {balanceOk && <HeroCard label={t('balance')} value={`${currencySymbol(balance.state.balance.currency)}${formatMoney(balance.state.balance.totalBalance)}`} />}
          </div>

          <section className={css.section}>
            <div className={css.sectionTitle}>
              {t('trend')} <span className={css.sectionHint}>{t('trendApprox')}</span>
            </div>
            <div className={css.legend}>
              <span className={css.legendItem}><i className={css.swatchInput} />{t('input')}</span>
              <span className={css.legendItem}><i className={css.swatchOutput} />{t('output')}</span>
              <span className={css.legendItem}><i className={css.swatchCache} />{t('cacheRead')}</span>
            </div>
            <div className={css.chart}>
              {trend.map((p) => (
                <div
                  key={p.key}
                  className={css.chartCol}
                  title={`${p.label}: ${t('input')} ${formatTokens(p.input)} · ${t('output')} ${formatTokens(p.output)} · ${t('cacheRead')} ${formatTokens(p.cacheRead)}`}
                >
                  <div className={css.chartBars}>
                    <div className={css.barCache} style={{ height: `${(p.cacheRead / trendMax) * 100}%` }} />
                    <div className={css.barOutput} style={{ height: `${(p.output / trendMax) * 100}%` }} />
                    <div className={css.barInput} style={{ height: `${(p.input / trendMax) * 100}%` }} />
                  </div>
                  <span className={css.chartLabel}>{p.label}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <div className={css.sectionTitle}>{t('modelStats')}</div>
            <div className={css.table}>
              <div className={css.tableHead}>
                <span className={css.colModel}>{t('model')}</span>
                <span className={css.colNum}>{t('sessions')}</span>
                <span className={css.colNum}>{t('input')}</span>
                <span className={css.colNum}>{t('output')}</span>
                <span className={css.colNum}>{t('cost')}</span>
              </div>
              {perModel.length > 0
                ? perModel.map((row) => (
                  <div key={row.model} className={css.tableRow}>
                    <span className={css.colModel} title={row.model}>{row.model}</span>
                    <span className={css.colNum}>{row.sessions}</span>
                    <span className={css.colNum}>{formatTokens(row.uncached + row.cacheRead + row.cacheWrite)}</span>
                    <span className={css.colNum}>{formatTokens(row.output)}</span>
                    <span className={css.colNum}>{formatCost(row.cost)}</span>
                  </div>
                ))
                : (
                  <div className={css.tableRow}>
                    <span className={css.colModel} title={getDefaultModel()}>{getDefaultModel()}</span>
                    <span className={css.colNum}>{totals.sessions}</span>
                    <span className={css.colNum}>{formatTokens(input)}</span>
                    <span className={css.colNum}>{formatTokens(totals.output)}</span>
                    <span className={css.colNum}>{formatCost(cost)}</span>
                  </div>
                )}
            </div>
          </section>

          <section className={css.section}>
            <div className={css.sectionTitle}>{t('byProject')}</div>
            <div className={css.table}>
              <div className={css.tableHead}>
                <span className={css.colProject}>{t('byProject')}</span>
                <span className={css.colNum}>{t('sessions')}</span>
                <span className={css.colNum}>{t('input')}</span>
                <span className={css.colNum}>{t('output')}</span>
                <span className={css.colNum}>{t('cost')}</span>
              </div>
              {perWorkspace.map((row) => (
                <div key={row.id} className={css.tableRow}>
                  <span className={css.colProject} title={row.title}>{row.title === 'ungrouped' ? t('ungrouped') : row.title}</span>
                  <span className={css.colNum}>{row.sessions}</span>
                  <span className={css.colNum}>{formatTokens(row.input)}</span>
                  <span className={css.colNum}>{formatTokens(row.output)}</span>
                  <span className={css.colNum}>{formatCost(row.cost)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={css.section}>
            <div className={css.sectionTitle}>{t('byConversation')}</div>
            <div className={css.table}>
              <div className={css.tableHead}>
                <span className={css.colTime}>{t('time')}</span>
                <span className={css.colSession}>{t('byConversation')}</span>
                <span className={css.colNum}>{t('input')}</span>
                <span className={css.colNum}>{t('output')}</span>
                <span className={css.colNum}>{t('cacheRead')}</span>
                <span className={css.colNum}>{t('cost')}</span>
              </div>
              {perSession.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={css.logRow}
                  onClick={() => { openSession(row.id); close() }}
                  title={row.title}
                >
                  <span className={css.colTime}>{clockLabel(row.updatedAt)}</span>
                  <span className={css.colSession}>{row.title}</span>
                  <span className={css.colNum}>{formatTokens(row.input)}</span>
                  <span className={css.colNum}>{formatTokens(row.output)}</span>
                  <span className={css.colNum}>{formatTokens(row.cacheRead)}</span>
                  <span className={css.colNum}>{formatCost(row.cost)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
