// @vitest-environment jsdom
/**
 * TokenDetailPanel: the right-side usage statistics drawer porting CC
 * Switch's usage-dashboard method — every figure folds per-request usageLog
 * records: a hero of real consumption / requests / cost plus the four bucket
 * minis and the cache-hit bar, a request-time-bucketed trend chart, and three
 * tabs (request log newest first, per-project, per-model with average cost).
 * Range presets resolve exactly like CC Switch (local midnight, N-day
 * windows). The CC Switch aggregate helpers are covered directly.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { TokenDetailPanel } from '../src/client/TokenDetailPanel.tsx'
import {
  DEFAULT_TOKEN_PRICES, collectRequestRecords, estimateCost, formatCost, formatCostExact, formatTokensShort,
  modelStats, projectStats, requestLogRows, resolveUsageRange, usageSummary, usageTrend,
  type UsageLogEntry,
} from '../src/client/derive.ts'
import { zh } from '../src/client/locales.ts'

const t: Parameters<typeof TokenDetailPanel>[0]['t'] = makeTranslate(zh, commonZh)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const sid = (k: string): SessionId => k as SessionId

/** Fixed clock for helper tests: 2026-08-17 15:30 local. */
const NOW = new Date(2026, 7, 17, 15, 30).getTime()
/** Local midnight of the fixed clock's day. */
const MIDNIGHT = new Date(2026, 7, 17).getTime()
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function makeSummary(
  id: string,
  usageLog?: UsageLogEntry[],
  updatedAt = NOW,
): SessionSummary {
  return {
    id: sid(id),
    displayTitle: `会话${id.toUpperCase()}`,
    updatedAt,
    projectionValues: usageLog === undefined ? {} : { usageLog: { entries: usageLog } },
  } as SessionSummary
}

/** Two entries on session a (09:20, 15:05) and one on session b (15:05). */
const entryA1: UsageLogEntry = { t: MIDNIGHT + 9 * HOUR + 20 * 60 * 1000, m: 'deepseek-v4-flash', i: 1200, o: 3450, r: 11000, w: 300 }
const entryA2: UsageLogEntry = { t: MIDNIGHT + 15 * HOUR + 5 * 60 * 1000, m: 'deepseek-v4-flash', i: 1_000_000, o: 500_000, r: 1_000_000, w: 1_000_000 }
const entryB1: UsageLogEntry = { t: MIDNIGHT + 15 * HOUR + 5 * 60 * 1000, m: 'deepseek-v4-pro', i: 800, o: 500, r: 2000, w: 100 }

const loggedById: Record<string, SessionSummary | undefined> = {
  a: makeSummary('a', [entryA1, entryA2]),
  b: makeSummary('b', [entryB1]),
}

const workspaceItems = [
  { workspaceId: 'w1', title: '项目A', sessionIds: [sid('a')] },
  { workspaceId: 'w2', title: '项目B', sessionIds: [sid('b')] },
]

function panelProps(over: { open?: boolean; byId?: Record<string, SessionSummary | undefined>; items?: unknown[] } = {}) {
  const setOpen = vi.fn()
  const openSession = vi.fn()
  const props = {
    t,
    openSession,
    useStore: (sel: (s: { open: boolean }) => unknown) => sel({ open: over.open ?? true }),
    useSessions: (sel: (s: { byId: Record<string, SessionSummary | undefined> }) => unknown) => sel({ byId: over.byId ?? {} }),
    useWorkspaces: (sel: (s: { items: unknown[] }) => unknown) => sel({ items: over.items ?? [] }),
    actions: { setOpen },
  } as unknown as Parameters<typeof TokenDetailPanel>[0] & { openSession: ReturnType<typeof vi.fn>; actions: { setOpen: ReturnType<typeof vi.fn> } }
  return props
}

/** Live-clock fixtures: entries a minute ago land inside the panel's "today". */
function liveById(): Record<string, SessionSummary | undefined> {
  const now = Date.now()
  const e = (over: Partial<UsageLogEntry>): UsageLogEntry => ({ t: now, m: 'deepseek-v4-flash', i: 1200, o: 3450, r: 11000, w: 300, ...over })
  return {
    a: makeSummary('a', [e({}), e({ t: now - 60 * 1000, m: 'deepseek-v4-pro', i: 800, o: 500, r: 2000, w: 100 })]),
  }
}

describe('TokenDetailPanel', () => {
  it('renders nothing while closed', () => {
    const view = render(<TokenDetailPanel {...panelProps({ open: false })} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('shows the CC Switch hero, trend, and the three tabs when open', () => {
    render(<TokenDetailPanel {...panelProps({ byId: liveById(), items: [{ workspaceId: 'w1', title: '项目A', sessionIds: [sid('a')] }] })} />)
    expect(screen.getByText('真实消耗 Tokens')).toBeTruthy()
    expect(screen.getByText('请求数')).toBeTruthy()
    expect(screen.getByText('缓存命中率')).toBeTruthy()
    expect(screen.getAllByText('总成本').length).toBeGreaterThan(0) // hero side + legend + log head
    expect(screen.getAllByText('新增输入').length).toBeGreaterThan(0) // hero mini + legend + log head
    expect(screen.getByText('使用趋势')).toBeTruthy()
    expect(screen.getByRole('tab', { name: '请求日志' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '项目统计' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: '模型统计' })).toBeTruthy()
    expect(screen.getByText('deepseek-v4-flash')).toBeTruthy() // default logs tab: model column
    expect(screen.getByText('会话A')).toBeTruthy()
  })

  it('switches tabs to the model table and back to projects', () => {
    render(<TokenDetailPanel {...panelProps({ byId: liveById(), items: workspaceItems.slice(0, 1) })} />)
    fireEvent.click(screen.getByRole('tab', { name: '模型统计' }))
    expect(screen.getByText('平均成本')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '项目统计' }))
    expect(screen.getByText('项目A')).toBeTruthy()
  })

  it('opens a session and closes the panel on a request-log row click', () => {
    const props = panelProps({ byId: liveById() })
    render(<TokenDetailPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /会话A/ }))
    expect(props.openSession).toHaveBeenCalledWith(sid('a'))
    expect(props.actions.setOpen).toHaveBeenCalledWith(false)
  })

  it('closes on the close button and on a backdrop click', () => {
    const viaButton = panelProps({ byId: liveById() })
    render(<TokenDetailPanel {...viaButton} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(viaButton.actions.setOpen).toHaveBeenCalledWith(false)
    cleanup()

    const viaBackdrop = panelProps({ byId: liveById() })
    const view = render(<TokenDetailPanel {...viaBackdrop} />)
    fireEvent.click(view.container.querySelector('[data-token-detail]')!)
    expect(viaBackdrop.actions.setOpen).toHaveBeenCalledWith(false)
  })
})

describe('CC Switch statistics helpers', () => {
  it('estimateCost prices each bucket once under the default DeepSeek prices', () => {
    const usage = { uncachedInputTokens: 1000000, outputTokens: 500000, cacheReadTokens: 1000000, cacheWriteTokens: 1000000 }
    const expected = 1000000 / 1e6 * DEFAULT_TOKEN_PRICES.inputPerM
      + 500000 / 1e6 * DEFAULT_TOKEN_PRICES.outputPerM
      + 1000000 / 1e6 * DEFAULT_TOKEN_PRICES.cacheReadPerM
      + 1000000 / 1e6 * DEFAULT_TOKEN_PRICES.cacheWritePerM
    expect(estimateCost(usage)).toBeCloseTo(expected)
    expect(estimateCost(usage, { inputPerM: 2, outputPerM: 4, cacheReadPerM: 0.5, cacheWritePerM: 2 })).toBeCloseTo(6.5)
  })

  it('formatCost renders ¥ with two decimals at and above a cent', () => {
    expect(formatCost(1.5)).toBe('¥1.50')
    expect(formatCost(0.0024)).toBe('¥0.0024')
    expect(formatCost(Number.NaN)).toBe('¥—')
  })

  it('formatCostExact and formatTokensShort mirror CC Switch formatting', () => {
    expect(formatCostExact(1.234567, 4)).toBe('¥1.2346')
    expect(formatCostExact(0.0000004, 6)).toBe('¥0.000000')
    expect(formatCostExact(Number.NaN, 4)).toBe('¥--')
    expect(formatTokensShort(1234, false)).toBe('1.2K')
    expect(formatTokensShort(1234, true)).toBe('1234')
    expect(formatTokensShort(12345, true)).toBe('1.2 万')
    expect(formatTokensShort(123456789, true)).toBe('1.23 亿')
    expect(formatTokensShort(1250000, false, 2)).toBe('1.25M')
    expect(formatTokensShort(0, true)).toBe('0')
  })

  it('resolveUsageRange matches CC Switch presets: local midnight and N-day windows', () => {
    expect(resolveUsageRange('today', NOW)).toEqual({ startDate: MIDNIGHT, endDate: NOW })
    expect(resolveUsageRange('7d', NOW).startDate).toBe(new Date(2026, 7, 11).getTime())
    expect(resolveUsageRange('14d', NOW).startDate).toBe(new Date(2026, 7, 4).getTime())
    expect(resolveUsageRange('30d', NOW).startDate).toBe(new Date(2026, 6, 19).getTime())
    expect(resolveUsageRange('all', NOW)).toEqual({ startDate: 0, endDate: NOW })
  })

  it('collectRequestRecords reads usageLog entries and synthesizes the legacy tail', () => {
    const records = collectRequestRecords(loggedById, 'all', NOW)
    expect(records).toHaveLength(3)
    expect(records[0]).toMatchObject({ sessionId: sid('a'), sessionTitle: '会话A', model: 'deepseek-v4-flash', i: 1200, o: 3450, r: 11000, w: 300 })
    // per-record cost is the four-bucket estimate
    expect(records[1].cost).toBeCloseTo(3.2)
    const legacy: Record<string, SessionSummary | undefined> = {
      c: {
        id: sid('c'),
        displayTitle: '会话C',
        updatedAt: NOW - 1000,
        projectionValues: {
          tokenUsage: { uncachedInputTokens: 100, outputTokens: 200, cacheReadTokens: 10, cacheWriteTokens: 5 },
          modelUsage: { byModel: { 'deepseek-v4-pro': { uncachedInputTokens: 100, outputTokens: 200, cacheReadTokens: 10, cacheWriteTokens: 5, requests: 1 } } },
        },
      } as SessionSummary,
    }
    const synthesized = collectRequestRecords(legacy, 'all', NOW)
    expect(synthesized).toHaveLength(1)
    expect(synthesized[0]).toMatchObject({ sessionId: sid('c'), model: 'deepseek-v4-pro', t: NOW - 1000, i: 100, o: 200, r: 10, w: 5 })
  })

  it('usageSummary folds realTotal and the cache hit rate over the cacheable input', () => {
    const records = collectRequestRecords(loggedById, 'all', NOW)
    const summary = usageSummary(records)
    expect(summary.requests).toBe(3)
    expect(summary.input).toBe(1200 + 1000000 + 800)
    expect(summary.output).toBe(3450 + 500000 + 500)
    expect(summary.cacheWrite).toBe(300 + 1000000 + 100)
    expect(summary.cacheRead).toBe(11000 + 1000000 + 2000)
    expect(summary.realTotal).toBe(summary.input + summary.output + summary.cacheWrite + summary.cacheRead)
    const cacheable = summary.input + summary.cacheWrite + summary.cacheRead
    expect(summary.cacheHitRate).toBeCloseTo(summary.cacheRead / cacheable)
    expect(usageSummary([])).toMatchObject({ requests: 0, realTotal: 0, cacheHitRate: 0 })
  })

  it('usageTrend buckets hourly for today with zero-filled gaps, daily for lookbacks', () => {
    const records = collectRequestRecords(loggedById, 'today', NOW)
    const today = usageTrend(records, 'today', NOW)
    expect(today).toHaveLength(16) // 00:00 through the 15:00 bucket
    expect(today[9]).toMatchObject({ label: '09:00', requests: 1, input: 1200, output: 3450 })
    expect(today[15]).toMatchObject({ label: '15:00', requests: 2 })
    expect(today[0]).toMatchObject({ label: '00:00', requests: 0, total: 0 }) // zero-filled gap
    expect(today[9].total).toBe(1200 + 3450)

    const spread: Record<string, SessionSummary | undefined> = {
      a: makeSummary('a', [
        { t: MIDNIGHT - 6 * DAY + 2 * HOUR, m: 'm', i: 10, o: 5, r: 0, w: 0 }, // Aug 11
        { t: MIDNIGHT + 2 * HOUR, m: 'm', i: 7, o: 3, r: 0, w: 0 }, // Aug 17
        { t: MIDNIGHT + 3 * HOUR, m: 'm', i: 1, o: 1, r: 0, w: 0 }, // Aug 17
      ]),
    }
    const week = usageTrend(collectRequestRecords(spread, '7d', NOW), '7d', NOW)
    expect(week).toHaveLength(7) // Aug 11 through Aug 17, gaps included
    expect(week.map((b) => b.label)).toEqual(['8/11', '8/12', '8/13', '8/14', '8/15', '8/16', '8/17'])
    expect(week[0]).toMatchObject({ requests: 1, input: 10 })
    expect(week[2]).toMatchObject({ requests: 0, input: 0 }) // zero-filled gap
    expect(week[6]).toMatchObject({ requests: 2 })
  })

  it('modelStats sorts by total cost with CC Switch columns', () => {
    const records = collectRequestRecords(loggedById, 'all', NOW)
    const rows = modelStats(records)
    expect(rows.map((r) => r.model)).toEqual(['deepseek-v4-flash', 'deepseek-v4-pro']) // flash bills more
    const flash = rows[0]
    expect(flash.requests).toBe(2)
    expect(flash.totalTokens).toBe(1200 + 3450 + 1000000 + 500000) // fresh input + output
    expect(flash.avgCost).toBeCloseTo(flash.cost / 2)
  })

  it('projectStats folds per-request records per workspace with an ungrouped tail', () => {
    const records = collectRequestRecords({ ...loggedById, c: makeSummary('c', [entryB1]) }, 'all', NOW)
    const rows = projectStats(workspaceItems, records)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toMatchObject({ id: 'w1', title: '项目A', requests: 2 })
    expect(rows[2]).toMatchObject({ id: 'ungrouped', requests: 1 })
  })

  it('requestLogRows orders newest first', () => {
    const records = collectRequestRecords(loggedById, 'all', NOW)
    const logs = requestLogRows(records)
    expect(logs.map((r) => r.t)).toEqual([entryA2.t, entryB1.t, entryA1.t])
  })
})
