/**
 * Pure display folds over the token-meter session projections
 * (`tokenUsage` / `contextPressure` / `contextBreakdown`). Nothing here
 * touches the wire or the meter service: the numbers are the host-computed
 * projection values as published to the browser.
 */
import type {
  ContextBreakdownProjection,
  ContextPressureProjection,
  TokenUsageProjection,
} from '@deepseek-ai/dsh-token-meter/client'
import type { SessionId, SessionSummary, WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-client-runtime/client'

/**
 * Compact token count: 517 / 12.2K / 517K / 1.2M (one decimal under three digits).
 * @param n - token count.
 * @returns display string.
 */
export function formatTokens(n: number): string {
  const scaled = (v: number): string => v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10)
  if (n < 1e3) return String(n)
  if (n < 1e6) return `${scaled(n / 1e3)}K`
  return `${scaled(n / 1e6)}M`
}

/**
 * Sum the three disjoint prompt-side billing buckets.
 * @param usage - the session's token-usage projection value.
 * @returns billed input tokens.
 */
export function billedInputTokens(usage: TokenUsageProjection): number {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/**
 * Cache-hit share of prompt-side input over the whole durable log.
 * @param usage - the session's token-usage projection value.
 * @returns rounded integer percent, or null when no input was billed.
 */
export function cacheHitPercent(usage: TokenUsageProjection): number | null {
  const input = billedInputTokens(usage)
  return input === 0 ? null : Math.round((usage.cacheReadTokens / input) * 100)
}

/** Approximate context occupancy for the status display. */
export interface ContextOccupancy {
  /** Rounded percent, upper-clamped at 100. */
  percent: number
  /** Numerator: provider sample carried forward over surface movement. */
  usedTokens: number
  /** Denominator: newest known route capacity. */
  contextWindow: number
}

/**
 * Approximate context occupancy. The numerator is `projectedTokens` (the
 * provider sample carried forward over the surface's movement since, so
 * compaction shows immediately), falling back to the bare `pressureTokens`
 * sample; denominator is the newest known route capacity. This is a
 * user-facing reference figure, not a billing or gating input (see the
 * token-meter README).
 * @param pressure - the session's context-pressure projection value.
 * @returns occupancy with its numerator and denominator, or null until both are known.
 */
export function contextOccupancy(pressure: ContextPressureProjection | null | undefined): ContextOccupancy | null {
  if (pressure === undefined || pressure === null) return null
  const usedTokens = pressure.projectedTokens ?? pressure.pressureTokens
  if (usedTokens === undefined || pressure.contextWindow === undefined) return null
  return {
    percent: Math.min(100, Math.round((usedTokens / pressure.contextWindow) * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow,
  }
}

/** One display snapshot for the composer-dock strip. */
export interface TokenDockView {
  /** Billed input: uncached + cache read + cache write. */
  input: number
  uncached: number
  cacheRead: number
  cacheWrite: number
  output: number
  /** Rounded cache-hit percent, or null when no input was billed. */
  cacheHit: number | null
  /** Context occupancy, or null until both numerator and capacity are known. */
  occupancy: ContextOccupancy | null
}

/**
 * Fold the three token-meter projections into one display snapshot.
 * @param usage - tokenUsage projection value (undefined before any usage).
 * @param pressure - contextPressure projection value.
 * @param breakdown - contextBreakdown projection value (reserved for tooltip detail).
 * @returns display snapshot, or null when there is nothing to show.
 */
export function deriveTokenView(
  usage: TokenUsageProjection | null | undefined,
  pressure: ContextPressureProjection | null | undefined,
  breakdown: ContextBreakdownProjection | null | undefined,
): TokenDockView | null {
  if (usage === undefined || usage === null) return null
  const input = billedInputTokens(usage)
  if (input <= 0 && usage.outputTokens <= 0) return null
  return {
    input,
    uncached: usage.uncachedInputTokens,
    cacheRead: usage.cacheReadTokens,
    cacheWrite: usage.cacheWriteTokens,
    output: usage.outputTokens,
    cacheHit: cacheHitPercent(usage),
    occupancy: contextOccupancy(pressure),
    breakdown,
  }
}

/** Aggregate token consumption across every session row. */
export interface SidebarTokenTotals {
  uncached: number
  cacheRead: number
  cacheWrite: number
  output: number
  /** Number of sessions that reported usage. */
  sessions: number
}

/**
 * Aggregate `tokenUsage` across every session row's projection values.
 * @param byId - SessionListState.byId snapshot.
 * @param sinceMs - optional lower bound on last activity (0 = all sessions).
 * @returns summed buckets and the number of sessions that reported usage.
 */
export function deriveSidebarTotals(byId: Readonly<Record<SessionId, SessionSummary | undefined>>, sinceMs = 0): SidebarTokenTotals {
  let uncached = 0
  let cacheRead = 0
  let cacheWrite = 0
  let output = 0
  let sessions = 0
  for (const key of Object.keys(byId)) {
    const summary = byId[key as SessionId]
    if (summary === undefined) continue
    if (sinceMs > 0 && summary.updatedAt < sinceMs) continue
    const usage = summary.projectionValues?.tokenUsage
    if (usage === undefined || usage === null) continue
    uncached += usage.uncachedInputTokens
    cacheRead += usage.cacheReadTokens
    cacheWrite += usage.cacheWriteTokens
    output += usage.outputTokens
    sessions += 1
  }
  return { uncached, cacheRead, cacheWrite, output, sessions }
}

/** One per-conversation row in the sidebar's expandable list. */
export interface PerSessionRow {
  id: SessionId
  /** Human-facing label: durable title, project basename, then session id. */
  title: string
  /** Billed input tokens (uncached + cache read + cache write). */
  input: number
  output: number
  /** Cache-read tokens (the log table's cache column). */
  cacheRead: number
  /** Billed input + output; the list sorts by this descending. */
  total: number
  /** Estimated cost (CNY) under the default DeepSeek prices. */
  cost: number
  /** Last activity timestamp, used by the detail panel's time-range filter. */
  updatedAt: number
}

/**
 * Per-session rows for the expandable list: one row per session that reported
 * usage, ordered by total consumption (highest first).
 * @param byId - SessionListState.byId snapshot.
 * @param sinceMs - optional lower bound on last activity (0 = all sessions).
 * @returns rows with display title and billed input/output totals.
 */
export function derivePerSession(byId: Readonly<Record<SessionId, SessionSummary | undefined>>, sinceMs = 0): PerSessionRow[] {
  const rows: PerSessionRow[] = []
  for (const key of Object.keys(byId)) {
    const summary = byId[key as SessionId]
    if (summary === undefined) continue
    if (sinceMs > 0 && summary.updatedAt < sinceMs) continue
    const usage = summary.projectionValues?.tokenUsage
    if (usage === undefined || usage === null) continue
    const input = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const output = usage.outputTokens
    if (input <= 0 && output <= 0) continue
    rows.push({
      id: summary.id,
      title: summary.displayTitle,
      input,
      output,
      cacheRead: usage.cacheReadTokens,
      total: input + output,
      cost: estimateCost(usage),
      updatedAt: summary.updatedAt,
    })
  }
  rows.sort((a, b) => b.total - a.total)
  return rows
}

/** DeepSeek per-million-token prices in CNY (provider list price for v4-flash). */
export interface TokenPrices {
  /** Uncached + cache-write input price per 1M tokens. */
  inputPerM: number
  outputPerM: number
  /** Cache-hit (read) price per 1M tokens. */
  cacheReadPerM: number
  cacheWritePerM: number
}

/** Default prices: DeepSeek v4-flash, CNY per 1M tokens. */
export const DEFAULT_TOKEN_PRICES: TokenPrices = {
  inputPerM: 1,
  outputPerM: 2,
  cacheReadPerM: 0.2,
  cacheWritePerM: 1,
}

/**
 * Estimate cost (CNY) from one usage bucket under the given prices. Cache
 * writes bill at their own price (defaults to the input price, matching
 * DeepSeek's list pricing for cache misses).
 * @param usage - a token-usage projection value.
 * @param prices - per-million-token prices (defaults to DeepSeek v4-flash).
 * @returns estimated cost in CNY.
 */
export function estimateCost(usage: TokenUsageProjection, prices: TokenPrices = DEFAULT_TOKEN_PRICES): number {
  return (usage.uncachedInputTokens + usage.cacheWriteTokens) / 1e6 * prices.inputPerM
    + usage.outputTokens / 1e6 * prices.outputPerM
    + usage.cacheReadTokens / 1e6 * prices.cacheReadPerM
    + usage.cacheWriteTokens / 1e6 * prices.cacheWritePerM
}

/**
 * Compact CNY cost: two decimals at and above ¥0.01, four below.
 * @param value - cost in CNY.
 * @returns display string with the ¥ symbol.
 */
export function formatCost(value: number): string {
  const n = Number(value)
  if (!Number.isFinite(n)) return '¥—'
  return n >= 0.01 ? `¥${n.toFixed(2)}` : `¥${n.toFixed(4)}`
}

/** Time-range presets for the detail panel. */
export type UsageRange = 'all' | 'today' | '7d'

/**
 * Lower bound (ms) for a detail-panel range: today at 00:00, seven days back,
 * or 0 for everything.
 * @param range - selected range.
 * @returns the lower bound timestamp in ms.
 */
export function rangeSinceMs(range: UsageRange): number {
  const now = Date.now()
  if (range === 'today') {
    const d = new Date(now)
    d.setHours(0, 0, 0, 0)
    return d.getTime()
  }
  if (range === '7d') return now - 7 * 24 * 60 * 60 * 1000
  return 0
}

/** One bucket of the usage-trend chart. */
export interface TrendPoint {
  /** Bucket label: `HH:00` for hourly, `M/D` for daily. */
  label: string
  /** Bucket key (epoch ms of the bucket start) for hover grouping. */
  key: number
  input: number
  output: number
  cacheRead: number
}

/** Bucket size for a range: hourly for today, daily otherwise. */
export function trendBucketMs(range: UsageRange): number {
  return range === 'today' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
}

/**
 * Approximate usage trend: each session's cumulative usage is bucketed by its
 * last activity time (the harness projects cumulative totals, not per-request
 * usage, so the trend is by last activity — see the panel's note).
 * @param byId - SessionListState.byId snapshot.
 * @param range - selected range (today = hourly, 7d/all = daily).
 * @returns ordered trend points for the range's buckets with any usage.
 */
export function deriveUsageTrend(byId: Readonly<Record<SessionId, SessionSummary | undefined>>, range: UsageRange): TrendPoint[] {
  const sinceMs = rangeSinceMs(range)
  const bucketMs = trendBucketMs(range)
  const buckets = new Map<number, TrendPoint>()
  const now = Date.now()
  const hourLabel = (ts: number): string => `${new Date(ts).getHours()}:00`
  const dayLabel = (ts: number): string => {
    const d = new Date(ts)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }
  const labelOf = (ts: number): string => (range === 'today' ? hourLabel(ts) : dayLabel(ts))
  for (const key of Object.keys(byId)) {
    const summary = byId[key as SessionId]
    if (summary === undefined) continue
    if (sinceMs > 0 && summary.updatedAt < sinceMs) continue
    const usage = summary.projectionValues?.tokenUsage
    if (usage === undefined || usage === null) continue
    if (usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens <= 0) continue
    const ts = Math.min(summary.updatedAt, now)
    const bucketStart = Math.floor(ts / bucketMs) * bucketMs
    const point = buckets.get(bucketStart) ?? { label: labelOf(bucketStart), key: bucketStart, input: 0, output: 0, cacheRead: 0 }
    point.input += usage.uncachedInputTokens + usage.cacheWriteTokens
    point.output += usage.outputTokens
    point.cacheRead += usage.cacheReadTokens
    buckets.set(bucketStart, point)
  }
  const points = [...buckets.values()]
  points.sort((a, b) => a.key - b.key)
  return points
}

/**
 * Currency symbol for the balance row; falls back to the ISO code.
 * @param currency - ISO 4217 code from the provider.
 * @returns display symbol.
 */
export function currencySymbol(currency: string | null | undefined): string {
  if (currency === 'CNY') return '¥'
  if (currency === 'USD') return '$'
  if (currency === 'EUR') return '€'
  return currency === null || currency === undefined ? '' : `${currency} `
}

/**
 * Two-decimal money formatting for balance figures.
 * @param value - balance amount (the provider returns strings).
 * @returns fixed two-decimal string, or an em dash for non-finite values.
 */
export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(2) : '—'
}

/** One per-workspace row in the detail panel's project breakdown. */
export interface PerWorkspaceRow {
  id: WorkspaceId
  /** Human-facing label: workspace title, falling back to its id. */
  title: string
  /** Billed input tokens (uncached + cache read + cache write). */
  input: number
  output: number
  /** Number of member sessions that reported usage. */
  sessions: number
  /** Estimated cost (CNY) under the default DeepSeek prices. */
  cost: number
}

/**
 * Per-workspace rows for the detail panel: one row per workspace whose member
 * sessions reported usage, ordered by total consumption (highest first). Usage
 * sessions that belong to no workspace trail in an `ungrouped` row.
 * @param workspaces - WorkspaceListState.items snapshot (Host order).
 * @param byId - SessionListState.byId snapshot.
 * @param sinceMs - optional lower bound on last activity (0 = all sessions).
 * @returns rows with workspace title and summed billed input/output.
 */
export function derivePerWorkspace(
  workspaces: readonly WorkspaceView[],
  byId: Readonly<Record<SessionId, SessionSummary | undefined>>,
  sinceMs = 0,
): PerWorkspaceRow[] {
  const rows: PerWorkspaceRow[] = []
  const covered = new Set<SessionId>()
  for (const workspace of workspaces) {
    let input = 0
    let output = 0
    let sessions = 0
    let cost = 0
    for (const id of workspace.sessionIds) {
      covered.add(id)
      const summary = byId[id]
      if (summary === undefined) continue
      if (sinceMs > 0 && summary.updatedAt < sinceMs) continue
      const usage = summary.projectionValues?.tokenUsage
      if (usage === undefined || usage === null) continue
      input += usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
      output += usage.outputTokens
      sessions += 1
      cost += estimateCost(usage)
    }
    if (input <= 0 && output <= 0) continue
    rows.push({ id: workspace.workspaceId, title: workspace.title || workspace.workspaceId, input, output, sessions, cost })
  }
  let ungroupedInput = 0
  let ungroupedOutput = 0
  let ungroupedSessions = 0
  let ungroupedCost = 0
  for (const key of Object.keys(byId)) {
    const id = key as SessionId
    if (covered.has(id)) continue
    const summary = byId[id]
    if (summary === undefined) continue
    if (sinceMs > 0 && summary.updatedAt < sinceMs) continue
    const usage = summary.projectionValues?.tokenUsage
    if (usage === undefined || usage === null) continue
    ungroupedInput += usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    ungroupedOutput += usage.outputTokens
    ungroupedSessions += 1
    ungroupedCost += estimateCost(usage)
  }
  if (ungroupedInput > 0 || ungroupedOutput > 0) {
    rows.push({ id: UNGROUPED_ID, title: 'ungrouped', input: ungroupedInput, output: ungroupedOutput, sessions: ungroupedSessions, cost: ungroupedCost })
  }
  rows.sort((a, b) => (b.input + b.output) - (a.input + a.output))
  return rows
}

/** Stable pseudo-id for the ungrouped row in the project breakdown. */
const UNGROUPED_ID = 'ungrouped' as WorkspaceId

/** Per-model usage buckets folded host-side from the session log. */
export interface ModelUsageBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** Number of assistant steps reported under this model. */
  requests: number
}

/** The modelUsage session projection value: one bucket row per model id. */
export interface ModelUsageProjection {
  byModel: Record<string, ModelUsageBuckets>
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Per-model consumption folded from assistant usage (host half). */
    modelUsage: ModelUsageProjection
  }
}

/** One row in the model-statistics table. */
export interface PerModelRow {
  model: string
  /** Number of sessions that reported usage under this model. */
  sessions: number
  uncached: number
  output: number
  cacheRead: number
  cacheWrite: number
  /** Estimated cost (CNY) under the default DeepSeek prices. */
  cost: number
  /** Uncached + cache write + output; sorts the table descending. */
  total: number
}

/**
 * Aggregate the per-session `modelUsage` projection values into per-model
 * rows, ordered by total consumption (highest first).
 * @param byId - SessionListState.byId snapshot.
 * @param sinceMs - optional lower bound on last activity (0 = all sessions).
 * @returns one row per model that reported usage.
 */
export function derivePerModel(byId: Readonly<Record<SessionId, SessionSummary | undefined>>, sinceMs = 0): PerModelRow[] {
  const acc = new Map<string, PerModelRow>()
  for (const key of Object.keys(byId)) {
    const summary = byId[key as SessionId]
    if (summary === undefined) continue
    if (sinceMs > 0 && summary.updatedAt < sinceMs) continue
    const usage = summary.projectionValues?.modelUsage
    if (usage === undefined || usage === null) continue
    for (const [model, buckets] of Object.entries(usage.byModel)) {
      const prev = acc.get(model)
      const next: PerModelRow = prev ?? { model, sessions: 0, uncached: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, total: 0 }
      next.sessions += 1
      next.uncached += buckets.uncachedInputTokens
      next.output += buckets.outputTokens
      next.cacheRead += buckets.cacheReadTokens
      next.cacheWrite += buckets.cacheWriteTokens
      next.cost += estimateCost(buckets)
      next.total = next.uncached + next.cacheRead + next.cacheWrite + next.output
      acc.set(model, next)
    }
  }
  const rows = [...acc.values()]
  rows.sort((a, b) => b.total - a.total)
  return rows
}
