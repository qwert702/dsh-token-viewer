/**
 * TokenDetailPanel: the right-side usage statistics drawer opened from the
 * sidebar card, a faithful port of CC Switch's usage dashboard methodology.
 * Every figure folds per-request usage records (the host `usageLog`
 * projection): the hero shows real consumption (all four token buckets), the
 * request count, total cost, the four bucket breakdowns, and the cache hit
 * rate with its progress bar; the trend chart buckets requests by their own
 * commit time (hourly for the day preset, daily otherwise, empty buckets
 * zero-filled) with the four token series plus a dashed cost line; and three
 * tabs carry the request log (newest first; clicking a row opens that
 * session), per-project statistics, and per-model statistics with average
 * cost. Range presets match CC Switch exactly: the day, fixed N-day windows
 * starting at the local midnight of (N − 1) days back, and everything.
 * Registered into shell.overlay, renders nothing while closed.
 */
import { useMemo, useState } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-layout's SlotMap merge (the shell.overlay entry).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the token-meter SessionProjectionMap merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import {
  collectRequestRecords, formatCostExact, formatTokensShort, modelStats, projectStats,
  requestLogRows, resolveUsageRange, usageSummary, usageTrend, type UsageRange,
} from './derive.ts'
import type { TokenDetailStore } from './token-detail-store.ts'
import css from './TokenDetailPanel.module.css'

/** Business face injected by the client plugin body: open a session by id. */
export interface TokenDetailPanelInjected {
  openSession: (sessionId: SessionId) => void
}

/** Full props of the detail panel: global seat + shared store + open verb + locale. */
export type TokenDetailPanelProps = PropsRuntime<'shell.overlay'> & PropsStore<TokenDetailStore> & TokenDetailPanelInjected & PropsLocale<'tokenViewer'>

/** Clock label for one request row (HH:MM, plus date when not today). */
function clockLabel(t: number): string {
  const d = new Date(t)
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  return sameDay ? hhmm : `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hhmm}`
}

/** Detail-panel tab keys. */
type Tab = 'logs' | 'projects' | 'models'

/**
 * The trend chart: the four token series as overlaid gradient areas on one
 * token axis plus the dashed cost line on its own scale, in CC Switch's
 * colors. Hovering a bucket shows its full figures through the SVG title.
 * @param props - trend buckets and the labels' locale flag.
 * @returns the chart SVG.
 */
function TrendChart({ buckets, t }: { buckets: ReturnType<typeof usageTrend>; t: TokenDetailPanelProps['t'] }) {
  const width = Math.max(280, buckets.length * 26)
  const height = 108
  const pad = 2
  const tokenMax = Math.max(1, ...buckets.map((b) => Math.max(b.input, b.output, b.cacheWrite, b.cacheRead)))
  const costMax = Math.max(1e-9, ...buckets.map((b) => b.cost))
  const step = buckets.length > 1 ? (width - pad * 2) / (buckets.length - 1) : 0
  const x = (i: number): number => pad + i * step
  const y = (v: number, max: number): number => height - pad - (v / max) * (height - pad * 2)
  const line = (pick: (i: number) => number, max: number): string =>
    buckets.map((_, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(pick(i), max).toFixed(1)}`).join(' ')
  const area = (pick: (i: number) => number, max: number): string =>
    `${line(pick, max)} L${x(buckets.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`
  if (buckets.length === 0) return <div className={css.chartEmpty} />
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8))
  return (
    <div className={css.chartWrap}>
      <svg className={css.chartSvg} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="tvAreaInput" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity="0.25" />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tvAreaOutput" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="95%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tvAreaCacheWrite" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity="0.25" />
            <stop offset="95%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="tvAreaCacheRead" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity="0.25" />
            <stop offset="95%" stopColor="#a855f7" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} className={css.chartGrid} x1={pad} x2={width - pad} y1={height * f} y2={height * f} />
        ))}
        <path className={css.areaInput} d={area((i) => buckets[i].input, tokenMax)} />
        <path className={css.areaOutput} d={area((i) => buckets[i].output, tokenMax)} />
        <path className={css.areaCacheWrite} d={area((i) => buckets[i].cacheWrite, tokenMax)} />
        <path className={css.areaCacheRead} d={area((i) => buckets[i].cacheRead, tokenMax)} />
        <path className={css.lineInput} d={line((i) => buckets[i].input, tokenMax)} />
        <path className={css.lineOutput} d={line((i) => buckets[i].output, tokenMax)} />
        <path className={css.lineCacheWrite} d={line((i) => buckets[i].cacheWrite, tokenMax)} />
        <path className={css.lineCacheRead} d={line((i) => buckets[i].cacheRead, tokenMax)} />
        <path className={css.lineCost} d={line((i) => buckets[i].cost, costMax)} />
        {buckets.map((bucket, i) => (
          <rect
            key={bucket.t}
            className={css.chartHit}
            x={x(i) - step / 2}
            y={0}
            width={Math.max(step, 6)}
            height={height}
          >
            <title>{`${bucket.label}: ${t('freshInput')} ${bucket.input.toLocaleString()} · ${t('output')} ${bucket.output.toLocaleString()} · ${t('cacheWrite')} ${bucket.cacheWrite.toLocaleString()} · ${t('cacheRead')} ${bucket.cacheRead.toLocaleString()} · ${t('totalCost')} ${formatCostExact(bucket.cost, 4)} · ${t('requests')} ${bucket.requests}`}</title>
          </rect>
        ))}
      </svg>
      {buckets.map((bucket, i) => (
        i % labelEvery === 0
          ? <span key={`l${bucket.t}`} className={css.chartLabel} style={{ left: `${buckets.length > 1 ? (i / (buckets.length - 1)) * 100 : 50}%` }}>{bucket.label}</span>
          : null
      ))}
    </div>
  )
}

/** One hero mini-stat card. */
function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className={css.miniStat}>
      <div className={css.miniLabel}>{label}</div>
      <div className={css.miniValue} style={accent === undefined ? undefined : { color: accent }}>{value}</div>
    </div>
  )
}

/**
 * Render the right-side statistics drawer.
 * @param props - global seat, shared open store, session-open verb, locale.
 * @returns the drawer, or nothing while closed.
 */
export function TokenDetailPanel({ useStore, useSessions, useWorkspaces, actions, t, openSession }: TokenDetailPanelProps) {
  const open = useStore((state) => state.open)
  const byId = useSessions((state) => state.byId)
  const workspaceItems = useWorkspaces((state) => state.items)
  const [range, setRange] = useState<UsageRange>('today')
  const [tab, setTab] = useState<Tab>('logs')
  const now = useMemo(() => Date.now(), [range, byId])
  const records = useMemo(() => collectRequestRecords(byId, range, now), [byId, range, now])
  const summary = useMemo(() => usageSummary(records), [records])
  const trend = useMemo(() => usageTrend(records, range, now), [records, range, now])
  const models = useMemo(() => modelStats(records), [records])
  const projects = useMemo(() => projectStats(workspaceItems, records), [workspaceItems, records])
  const logs = useMemo(() => requestLogRows(records), [records])
  const isZh = t('today') === '当天'
  if (!open) return null
  const close = () => { actions.setOpen(false) }
  const ranges: UsageRange[] = ['today', '7d', '14d', '30d', 'all']
  const rangeLabelOf = (r: UsageRange): string => t(r === 'all' ? 'all' : r === 'today' ? 'today' : r === '7d' ? 'last7d' : r === '14d' ? 'last14d' : 'last30d')
  const hitPercent = Math.max(0, Math.min(100, summary.cacheHitRate * 100))
  const hitPercentLabel = hitPercent.toFixed(hitPercent >= 99.95 ? 0 : 1)
  const tabs: Tab[] = ['logs', 'projects', 'models']
  const resolved = resolveUsageRange(range, now)
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
                  {rangeLabelOf(r)}
                </button>
              ))}
            </div>
          </div>

          <div className={css.hero}>
            <div className={css.heroTop}>
              <div className={css.heroMain}>
                <div className={css.heroLabel}>{t('realTotal')}</div>
                <div className={css.heroBigRow}>
                  <span className={css.heroBig} title={summary.realTotal.toLocaleString()}>{summary.realTotal.toLocaleString()}</span>
                  <span className={css.heroChip}>≈ {formatTokensShort(summary.realTotal, isZh, 2)}</span>
                </div>
              </div>
              <div className={css.heroSide}>
                <div className={css.heroSideItem}>
                  <span className={css.heroSideLabel}>{t('requests')}</span>
                  <span className={css.heroSideValue}>{summary.requests.toLocaleString()}</span>
                </div>
                <div className={css.heroSideDivider} />
                <div className={css.heroSideItem}>
                  <span className={css.heroSideLabel}>{t('totalCost')}</span>
                  <span className={css.heroSideValueCost}>{formatCostExact(summary.cost, 4)}</span>
                </div>
              </div>
            </div>
            <div className={css.heroGrid}>
              <MiniStat label={t('freshInput')} value={formatTokensShort(summary.input, isZh)} accent="#3b82f6" />
              <MiniStat label={t('output')} value={formatTokensShort(summary.output, isZh)} accent="#22c55e" />
              <MiniStat label={t('cacheWrite')} value={formatTokensShort(summary.cacheWrite, isZh)} accent="#f97316" />
              <MiniStat label={t('cacheRead')} value={formatTokensShort(summary.cacheRead, isZh)} accent="#a855f7" />
              <div className={css.hitRate}>
                <div className={css.hitRateTop}>
                  <span className={css.miniLabel}>{t('cacheHitRate')}</span>
                  <span className={css.hitRateValue}>{hitPercentLabel}%</span>
                </div>
                <div className={css.hitRateTrack}>
                  <div className={css.hitRateFill} style={{ width: `${hitPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          <section className={css.section}>
            <div className={css.sectionTitle}>
              {t('trend')} <span className={css.sectionHint}>{t('trendExact')} · {rangeLabelOf(range)} · {new Date(resolved.startDate).toLocaleDateString()} – {new Date(resolved.endDate).toLocaleDateString()}</span>
            </div>
            <div className={css.legend}>
              <span className={css.legendItem}><i className={css.swatchInput} />{t('freshInput')}</span>
              <span className={css.legendItem}><i className={css.swatchOutput} />{t('output')}</span>
              <span className={css.legendItem}><i className={css.swatchCacheWrite} />{t('cacheWrite')}</span>
              <span className={css.legendItem}><i className={css.swatchCacheRead} />{t('cacheRead')}</span>
              <span className={css.legendItem}><i className={css.swatchCost} />{t('totalCost')}</span>
            </div>
            <TrendChart buckets={trend} t={t} />
          </section>

          <section className={css.section}>
            <div className={css.tabs} role="tablist">
              {tabs.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  className={tab === key ? css.tabActive : css.tab}
                  onClick={() => { setTab(key) }}
                >
                  {t(key === 'logs' ? 'requestLogs' : key === 'projects' ? 'projectStats' : 'modelStats')}
                </button>
              ))}
            </div>

            {tab === 'logs' && (
              <div className={css.table}>
                <div className={css.tableHead}>
                  <span className={css.colTime}>{t('time')}</span>
                  <span className={css.colSession}>{t('byConversation')}</span>
                  <span className={css.colModel}>{t('model')}</span>
                  <span className={css.colNum}>{t('freshInput')}</span>
                  <span className={css.colNum}>{t('output')}</span>
                  <span className={css.colNum}>{t('cacheRead')}</span>
                  <span className={css.colNum}>{t('totalCost')}</span>
                </div>
                {logs.length === 0
                  ? <div className={css.tableRow}>{t('noData')}</div>
                  : logs.map((row, index) => (
                    <button
                      key={`${row.sessionId}:${row.t}:${index}`}
                      type="button"
                      className={css.logRow}
                      onClick={() => { openSession(row.sessionId); close() }}
                      title={row.sessionTitle}
                    >
                      <span className={css.colTime}>{clockLabel(row.t)}</span>
                      <span className={css.colSession}>{row.sessionTitle}</span>
                      <span className={css.colModel} title={row.model}>{row.model === '' ? '—' : row.model}</span>
                      <span className={css.colNum}>{row.i.toLocaleString()}</span>
                      <span className={css.colNum}>{row.o.toLocaleString()}</span>
                      <span className={css.colNum}>{row.r.toLocaleString()}</span>
                      <span className={css.colNum}>{formatCostExact(row.cost, 6)}</span>
                    </button>
                  ))}
              </div>
            )}

            {tab === 'projects' && (
              <div className={css.table}>
                <div className={css.tableHead}>
                  <span className={css.colProject}>{t('projectStats')}</span>
                  <span className={css.colNum}>{t('requests')}</span>
                  <span className={css.colNum}>{t('tokens')}</span>
                  <span className={css.colNum}>{t('totalCost')}</span>
                </div>
                {projects.length === 0
                  ? <div className={css.tableRow}>{t('noData')}</div>
                  : projects.map((row) => (
                    <div key={row.id} className={css.tableRow}>
                      <span className={css.colProject} title={row.title}>{row.title === 'ungrouped' ? t('ungrouped') : row.title}</span>
                      <span className={css.colNum}>{row.requests.toLocaleString()}</span>
                      <span className={css.colNum}>{(row.input + row.output).toLocaleString()}</span>
                      <span className={css.colNum}>{formatCostExact(row.cost, 4)}</span>
                    </div>
                  ))}
              </div>
            )}

            {tab === 'models' && (
              <div className={css.table}>
                <div className={css.tableHead}>
                  <span className={css.colModel}>{t('model')}</span>
                  <span className={css.colNum}>{t('requests')}</span>
                  <span className={css.colNum}>{t('tokens')}</span>
                  <span className={css.colNum}>{t('totalCost')}</span>
                  <span className={css.colNum}>{t('avgCost')}</span>
                </div>
                {models.length === 0
                  ? <div className={css.tableRow}>{t('noData')}</div>
                  : models.map((row) => (
                    <div key={row.model} className={css.tableRow}>
                      <span className={css.colModel} title={row.model}>{row.model}</span>
                      <span className={css.colNum}>{row.requests.toLocaleString()}</span>
                      <span className={css.colNum}>{row.totalTokens.toLocaleString()}</span>
                      <span className={css.colNum}>{formatCostExact(row.cost, 4)}</span>
                      <span className={css.colNum}>{formatCostExact(row.avgCost, 6)}</span>
                    </div>
                  ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
