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
 * @returns summed buckets and the number of sessions that reported usage.
 */
export function deriveSidebarTotals(byId: Readonly<Record<SessionId, SessionSummary | undefined>>): SidebarTokenTotals {
  let uncached = 0
  let cacheRead = 0
  let cacheWrite = 0
  let output = 0
  let sessions = 0
  for (const key of Object.keys(byId)) {
    const usage = byId[key as SessionId]?.projectionValues?.tokenUsage
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
  /** Billed input + output; the list sorts by this descending. */
  total: number
}

/**
 * Per-session rows for the expandable list: one row per session that reported
 * usage, ordered by total consumption (highest first).
 * @param byId - SessionListState.byId snapshot.
 * @returns rows with display title and billed input/output totals.
 */
export function derivePerSession(byId: Readonly<Record<SessionId, SessionSummary | undefined>>): PerSessionRow[] {
  const rows: PerSessionRow[] = []
  for (const key of Object.keys(byId)) {
    const summary = byId[key as SessionId]
    const usage = summary?.projectionValues?.tokenUsage
    if (usage === undefined || usage === null) continue
    const input = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    const output = usage.outputTokens
    if (input <= 0 && output <= 0) continue
    rows.push({
      id: summary.id,
      title: summary.displayTitle,
      input,
      output,
      total: input + output,
    })
  }
  rows.sort((a, b) => b.total - a.total)
  return rows
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
}

/**
 * Per-workspace rows for the detail panel: one row per workspace whose member
 * sessions reported usage, ordered by total consumption (highest first). Usage
 * sessions that belong to no workspace trail in an `ungrouped` row.
 * @param workspaces - WorkspaceListState.items snapshot (Host order).
 * @param byId - SessionListState.byId snapshot.
 * @returns rows with workspace title and summed billed input/output.
 */
export function derivePerWorkspace(
  workspaces: readonly WorkspaceView[],
  byId: Readonly<Record<SessionId, SessionSummary | undefined>>,
): PerWorkspaceRow[] {
  const rows: PerWorkspaceRow[] = []
  const covered = new Set<SessionId>()
  for (const workspace of workspaces) {
    let input = 0
    let output = 0
    let sessions = 0
    for (const id of workspace.sessionIds) {
      covered.add(id)
      const usage = byId[id]?.projectionValues?.tokenUsage
      if (usage === undefined || usage === null) continue
      input += usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
      output += usage.outputTokens
      sessions += 1
    }
    if (input <= 0 && output <= 0) continue
    rows.push({ id: workspace.workspaceId, title: workspace.title || workspace.workspaceId, input, output, sessions })
  }
  let ungroupedInput = 0
  let ungroupedOutput = 0
  let ungroupedSessions = 0
  for (const key of Object.keys(byId)) {
    const id = key as SessionId
    if (covered.has(id)) continue
    const usage = byId[id]?.projectionValues?.tokenUsage
    if (usage === undefined || usage === null) continue
    ungroupedInput += usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
    ungroupedOutput += usage.outputTokens
    ungroupedSessions += 1
  }
  if (ungroupedInput > 0 || ungroupedOutput > 0) {
    rows.push({ id: UNGROUPED_ID, title: 'ungrouped', input: ungroupedInput, output: ungroupedOutput, sessions: ungroupedSessions })
  }
  rows.sort((a, b) => (b.input + b.output) - (a.input + a.output))
  return rows
}

/** Stable pseudo-id for the ungrouped row in the project breakdown. */
const UNGROUPED_ID = 'ungrouped' as WorkspaceId
