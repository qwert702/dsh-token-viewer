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
  /** Context-breakdown projection value, reserved for tooltip detail. */
  breakdown?: ContextBreakdownProjection | null
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
    // Cost: per-model buckets priced at their own model's rate when the
    // session reports them, else the default table over the cumulative total.
    let cost = estimateCost(usage)
    const byModel = summary.projectionValues?.modelUsage?.byModel
    if (byModel !== undefined && Object.keys(byModel).length > 0) {
      cost = 0
      for (const [model, buckets] of Object.entries(byModel)) {
        cost += estimateRequestCost(buckets, model, summary.updatedAt)
      }
    }
    rows.push({
      id: summary.id,
      title: summary.displayTitle,
      input,
      output,
      cacheRead: usage.cacheReadTokens,
      total: input + output,
      cost,
      updatedAt: summary.updatedAt,
    })
  }
  rows.sort((a, b) => b.total - a.total)
  return rows
}

/** DeepSeek per-million-token prices in CNY (provider list price for v4-flash). */
export interface TokenPrices {
  /** Uncached input price per 1M tokens. */
  inputPerM: number
  outputPerM: number
  /** Cache-hit (read) price per 1M tokens. */
  cacheReadPerM: number
  cacheWritePerM: number
}

/** Default prices: DeepSeek V4-Flash off-peak list price, CNY per 1M tokens. */
export const DEFAULT_TOKEN_PRICES: TokenPrices = {
  inputPerM: 1.5,
  outputPerM: 4.5,
  cacheReadPerM: 0.05,
  cacheWritePerM: 1.5,
}

/**
 * Estimate cost (CNY) from one usage bucket under the given prices. Each
 * bucket bills exactly once: cache writes bill at their own price (the
 * cache-miss rate, matching DeepSeek's list pricing), not again at the
 * uncached input price.
 * @param usage - a token-usage projection value.
 * @param prices - per-million-token prices (defaults to V4-Flash off-peak).
 * @returns estimated cost in CNY.
 */
export function estimateCost(usage: TokenUsageProjection, prices: TokenPrices = DEFAULT_TOKEN_PRICES): number {
  return usage.uncachedInputTokens / 1e6 * prices.inputPerM
    + usage.outputTokens / 1e6 * prices.outputPerM
    + usage.cacheReadTokens / 1e6 * prices.cacheReadPerM
    + usage.cacheWriteTokens / 1e6 * prices.cacheWritePerM
}

/** Peak/off-peak price tiers for one model, CNY per 1M tokens. */
export interface ModelPricing {
  /** Off-peak (standard) prices. */
  offPeak: TokenPrices
  /** Peak-hour prices (Beijing 09:00–12:00 and 14:00–18:00). */
  peak: TokenPrices
}

/**
 * Per-model list prices from the provider's pricing page (V4-Flash-0731 and
 * V4-Pro-0813, CNY per 1M tokens; peak is double the off-peak rate).
 * Cache writes bill at the cache-miss (uncached input) rate.
 */
export const MODEL_PRICING: Readonly<Record<string, ModelPricing>> = {
  'deepseek-v4-flash': {
    offPeak: { inputPerM: 1.5, outputPerM: 4.5, cacheReadPerM: 0.05, cacheWritePerM: 1.5 },
    peak: { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 },
  },
  'deepseek-v4-pro': {
    offPeak: { inputPerM: 4.5, outputPerM: 13.5, cacheReadPerM: 0.15, cacheWritePerM: 4.5 },
    peak: { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 },
  },
}

/**
 * Whether a timestamp falls in the provider's peak window — Beijing time
 * 09:00–12:00 and 14:00–18:00, converted explicitly so hosts in other
 * timezones price correctly.
 * @param t - epoch ms.
 * @returns true inside a peak window.
 */
export function isPeakHour(t: number): boolean {
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', hourCycle: 'h23', hour: 'numeric' }).format(new Date(t)))
  return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18)
}

/**
 * Resolve the price table for one request: exact model id first, then the
 * longest table key the id starts with (versioned ids like
 * `deepseek-v4-flash-0731`), then the V4-Flash off-peak default.
 * @param model - the request's model id.
 * @param t - the request's commit time, selecting the peak or off-peak tier.
 * @returns the per-million-token prices to bill under.
 */
export function pricesForModel(model: string, t: number): TokenPrices {
  const key = model in MODEL_PRICING ? model
    : Object.keys(MODEL_PRICING)
      .filter((candidate) => model.startsWith(candidate))
      .sort((a, b) => b.length - a.length)[0]
  if (key === undefined) return DEFAULT_TOKEN_PRICES
  return isPeakHour(t) ? MODEL_PRICING[key].peak : MODEL_PRICING[key].offPeak
}

/**
 * Estimate one request's cost under its own model's peak/off-peak list
 * price — the per-model refinement of the four-bucket calculator.
 * @param usage - the request's token buckets.
 * @param model - the request's model id.
 * @param t - the request's commit time.
 * @returns estimated cost in CNY.
 */
export function estimateRequestCost(usage: TokenUsageProjection, model: string, t: number): number {
  return estimateCost(usage, pricesForModel(model, t))
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

// --------------------------------------------------------------------------------
// CC Switch statistics method: aggregates fold per-request usage records (the
// host `usageLog` projection), never cumulative session totals, so every
// figure below is exact — time bucketing uses each request's own commit time,
// ranges cut on true request time, and cost is the four per-bucket prices
// summed once per request (CC Switch's Claude-semantics calculator).
// --------------------------------------------------------------------------------

/** One per-request usage record, the client mirror of the host usageLog entry. */
export interface UsageLogEntry {
  /** Commit time (the assistant/message event's `time`, epoch ms). */
  t: number
  /** Model the request ran under. */
  m: string
  /** Fresh (uncached) input tokens. */
  i: number
  /** Output tokens. */
  o: number
  /** Cache-read tokens. */
  r: number
  /** Cache-write tokens. */
  w: number
}

/** The usageLog session projection value: one entry per reported assistant step. */
export interface UsageLogProjection {
  entries: UsageLogEntry[]
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Per-request usage log for the CC Switch-style statistics (host half). */
    usageLog: UsageLogProjection
  }
}

/** One billed request carrying its session identity and per-record cost. */
export interface RequestRecord {
  sessionId: SessionId
  sessionTitle: string
  model: string
  t: number
  /** Fresh (uncached) input tokens. */
  i: number
  o: number
  r: number
  w: number
  /** Four-bucket estimated cost (CNY) under the default prices. */
  cost: number
}

/** Milliseconds in one day. */
const DAY_MS = 24 * 60 * 60 * 1000

/** CC Switch range presets: the day, fixed lookback windows, everything. */
export type UsageRange = 'today' | '7d' | '14d' | '30d' | 'all'

/** Resolved range bounds in epoch ms. */
export interface ResolvedUsageRange {
  startDate: number
  endDate: number
}

/**
 * Resolve a preset to concrete bounds, exactly as CC Switch does: `today`
 * spans local midnight to now, the N-day presets start at the local midnight
 * of (N − 1) days back (so `7d` is seven calendar days including today), and
 * `all` has no lower bound.
 * @param range - selected preset.
 * @param nowMs - clock the range resolves against.
 * @returns inclusive start (0 for all) and exclusive end in epoch ms.
 */
export function resolveUsageRange(range: UsageRange, nowMs: number = Date.now()): ResolvedUsageRange {
  const midnight = (ms: number): number => {
    const d = new Date(ms)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  if (range === 'today') return { startDate: midnight(nowMs), endDate: nowMs }
  if (range !== 'all') {
    const days = range === '7d' ? 7 : range === '14d' ? 14 : 30
    return { startDate: midnight(nowMs - (days - 1) * DAY_MS), endDate: nowMs }
  }
  return { startDate: 0, endDate: nowMs }
}

/**
 * Collect every session's per-request records within the range. Sessions from
 * before this plugin's usageLog projection (no entries anywhere) fall back to
 * one synthesized record per session at its last activity, modeled from the
 * cumulative tokenUsage and the session's modelUsage model — the numbers stay
 * approximate only for that legacy tail.
 * @param byId - SessionListState.byId snapshot.
 * @param range - selected preset.
 * @param nowMs - clock the range resolves against.
 * @returns records with session identity, bucketed cost attached.
 */
export function collectRequestRecords(
  byId: Readonly<Record<SessionId, SessionSummary | undefined>>,
  range: UsageRange,
  nowMs: number = Date.now(),
): RequestRecord[] {
  const { startDate, endDate } = resolveUsageRange(range, nowMs)
  const inRange = (t: number): boolean => t >= startDate && t <= endDate
  const summaries: SessionSummary[] = []
  for (const key of Object.keys(byId)) {
    const summary = byId[key as SessionId]
    if (summary !== undefined) summaries.push(summary)
  }
  const records: RequestRecord[] = []
  const push = (summary: SessionSummary, entry: UsageLogEntry): void => {
    records.push({
      sessionId: summary.id,
      sessionTitle: summary.displayTitle,
      model: entry.m,
      t: entry.t,
      i: entry.i,
      o: entry.o,
      r: entry.r,
      w: entry.w,
      cost: estimateRequestCost({ uncachedInputTokens: entry.i, outputTokens: entry.o, cacheReadTokens: entry.r, cacheWriteTokens: entry.w }, entry.m, entry.t),
    })
  }
  const logged = summaries.some((summary) => (summary.projectionValues?.usageLog?.entries?.length ?? 0) > 0)
  if (logged) {
    for (const summary of summaries) {
      for (const entry of summary.projectionValues?.usageLog?.entries ?? []) {
        if (inRange(entry.t)) push(summary, entry)
      }
    }
    return records
  }
  for (const summary of summaries) {
    const usage = summary.projectionValues?.tokenUsage
    if (usage === undefined || usage === null) continue
    if (usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens <= 0) continue
    const models = Object.keys(summary.projectionValues?.modelUsage?.byModel ?? {})
    const entry: UsageLogEntry = {
      t: summary.updatedAt,
      m: models.length === 1 ? models[0] : '',
      i: usage.uncachedInputTokens,
      o: usage.outputTokens,
      r: usage.cacheReadTokens,
      w: usage.cacheWriteTokens,
    }
    if (inRange(entry.t)) push(summary, entry)
  }
  return records
}

/** CC Switch's UsageSummary: headline figures over a set of requests. */
export interface UsageSummary {
  requests: number
  cost: number
  /** Fresh (uncached) input tokens. */
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  /** input + output + cacheWrite + cacheRead — everything the model processed. */
  realTotal: number
  /** cacheRead / (input + cacheWrite + cacheRead), 0–1; 0 when nothing cacheable. */
  cacheHitRate: number
}

/**
 * Fold records into the CC Switch summary: realTotal counts all four buckets,
 * the hit rate denominates on the cacheable input side only.
 * @param records - per-request records in the range.
 * @returns the summary figures.
 */
export function usageSummary(records: readonly RequestRecord[]): UsageSummary {
  let requests = 0
  let cost = 0
  let input = 0
  let output = 0
  let cacheWrite = 0
  let cacheRead = 0
  for (const record of records) {
    requests += 1
    cost += record.cost
    input += record.i
    output += record.o
    cacheWrite += record.w
    cacheRead += record.r
  }
  const cacheable = input + cacheWrite + cacheRead
  return {
    requests,
    cost,
    input,
    output,
    cacheWrite,
    cacheRead,
    realTotal: input + output + cacheWrite + cacheRead,
    cacheHitRate: cacheable > 0 ? cacheRead / cacheable : 0,
  }
}

/** One trend bucket: hourly for the day preset, daily otherwise. */
export interface TrendBucket {
  /** Bucket start, epoch ms. */
  t: number
  /** `HH:00` for hourly buckets, `M/D` for daily ones. */
  label: string
  requests: number
  cost: number
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  /** input + output (CC Switch's total_tokens column). */
  total: number
}

/**
 * CC Switch usage trend: requests bucketed by their own commit time — hourly
 * when the range spans one day, daily otherwise — with every bucket in the
 * range materialized, empty ones zero-filled, so gaps show as real gaps.
 * @param records - per-request records.
 * @param range - selected preset.
 * @param nowMs - clock the range resolves against.
 * @returns the range's buckets in ascending time order.
 */
export function usageTrend(records: readonly RequestRecord[], range: UsageRange, nowMs: number = Date.now()): TrendBucket[] {
  const { startDate, endDate } = resolveUsageRange(range, nowMs)
  const bucketMs = range === 'today' ? 60 * 60 * 1000 : DAY_MS
  const bucketCount = range === 'today'
    ? Math.max(1, Math.ceil((endDate - startDate) / bucketMs))
    : Math.floor((endDate - startDate) / DAY_MS) + 1
  const buckets: TrendBucket[] = []
  for (let index = 0; index < bucketCount; index += 1) {
    const t = startDate + index * bucketMs
    const d = new Date(t)
    buckets.push({
      t,
      label: range === 'today' ? `${String(d.getHours()).padStart(2, '0')}:00` : `${d.getMonth() + 1}/${d.getDate()}`,
      requests: 0,
      cost: 0,
      input: 0,
      output: 0,
      cacheWrite: 0,
      cacheRead: 0,
      total: 0,
    })
  }
  for (const record of records) {
    if (record.t < startDate || record.t > endDate) continue
    const index = Math.min(bucketCount - 1, Math.floor((record.t - startDate) / bucketMs))
    const bucket = buckets[index]
    bucket.requests += 1
    bucket.cost += record.cost
    bucket.input += record.i
    bucket.output += record.o
    bucket.cacheWrite += record.w
    bucket.cacheRead += record.r
    bucket.total = bucket.input + bucket.output
  }
  return buckets
}

/** One row of the model-statistics table. */
export interface ModelStatRow {
  model: string
  requests: number
  /** Fresh input + output (CC Switch's total_tokens column). */
  totalTokens: number
  cost: number
  /** cost / requests (CC Switch shows six decimals). */
  avgCost: number
}

/**
 * Per-model rows in CC Switch's shape: request count, fresh-input-plus-output
 * tokens, total and average cost, ordered by total cost descending.
 * @param records - per-request records in the range.
 * @returns one row per model that billed in the range.
 */
export function modelStats(records: readonly RequestRecord[]): ModelStatRow[] {
  const acc = new Map<string, ModelStatRow>()
  for (const record of records) {
    const model = record.model === '' ? '—' : record.model
    const prev = acc.get(model)
    const next = prev ?? { model, requests: 0, totalTokens: 0, cost: 0, avgCost: 0 }
    next.requests += 1
    next.totalTokens += record.i + record.o
    next.cost += record.cost
    acc.set(model, next)
  }
  const rows = [...acc.values()]
  for (const row of rows) row.avgCost = row.requests > 0 ? row.cost / row.requests : 0
  rows.sort((a, b) => b.cost - a.cost)
  return rows
}

/** One row of the project (workspace) statistics table. */
export interface ProjectStatRow {
  id: WorkspaceId
  title: string
  requests: number
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
  cost: number
}

/** Stable pseudo-id for records outside every workspace. */
const UNGROUPED_RECORDS_ID = 'ungrouped' as WorkspaceId

/**
 * Per-workspace rows folded from per-request records, in workspace order with
 * an `ungrouped` row trailing for sessions that belong to no workspace.
 * @param workspaces - WorkspaceListState.items snapshot (host order).
 * @param records - per-request records in the range.
 * @returns rows with per-workspace requests, token buckets, and cost.
 */
export function projectStats(workspaces: readonly WorkspaceView[], records: readonly RequestRecord[]): ProjectStatRow[] {
  const rows: ProjectStatRow[] = []
  const bySession = new Map<SessionId, ProjectStatRow>()
  for (const workspace of workspaces) {
    const row: ProjectStatRow = { id: workspace.workspaceId, title: workspace.title || workspace.workspaceId, requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 }
    rows.push(row)
    for (const id of workspace.sessionIds) bySession.set(id, row)
  }
  const ungrouped: ProjectStatRow = { id: UNGROUPED_RECORDS_ID, title: 'ungrouped', requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 }
  for (const record of records) {
    const row = bySession.get(record.sessionId) ?? ungrouped
    row.requests += 1
    row.input += record.i
    row.output += record.o
    row.cacheWrite += record.w
    row.cacheRead += record.r
    row.cost += record.cost
  }
  if (ungrouped.requests > 0) rows.push(ungrouped)
  return rows.filter((row) => row.requests > 0)
}

/**
 * Request-log rows: every record in the range, newest first (CC Switch orders
 * by created_at descending).
 * @param records - per-request records in the range.
 * @returns records sorted by commit time descending.
 */
export function requestLogRows(records: readonly RequestRecord[]): RequestRecord[] {
  return [...records].sort((a, b) => b.t - a.t)
}

/**
 * CC Switch's compact token count. Chinese locale renders 万/亿 magnitudes;
 * the default renders K/M/B. `decimals` is 1 for card sub-figures and 2 for
 * the hero's precise chip.
 * @param value - token count.
 * @param zh - whether the active locale renders Chinese magnitudes.
 * @param decimals - fractional digits on the magnitude.
 * @returns the compact display string, `0` for non-positive values.
 */
export function formatTokensShort(value: number, zh: boolean, decimals: 1 | 2 = 1): string {
  if (!Number.isFinite(value) || value <= 0) return '0'
  if (zh) {
    if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`
    if (value >= 1e4) return `${(value / 1e4).toFixed(decimals)} 万`
    return value.toLocaleString()
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`
  return value.toLocaleString()
}

/**
 * Fixed-decimal cost for the CC Switch tables: totals render four decimals,
 * per-request averages six.
 * @param value - cost in CNY.
 * @param digits - fractional digits.
 * @returns the ¥-prefixed string, `¥--` for non-finite values.
 */
export function formatCostExact(value: number, digits: number): string {
  const n = Number(value)
  return Number.isFinite(n) ? `¥${n.toFixed(digits)}` : '¥--'
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
