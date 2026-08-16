// @vitest-environment jsdom
/**
 * TokenDetailPanel: the right-side usage statistics drawer styled after CC
 * Switch's usage page — time-range filter, hero summary cards (real usage,
 * estimated cost, cache hit rate, session count, balance), per-workspace
 * (project) statistics, and a per-conversation log table. Clicking a
 * conversation row opens that session and closes the panel; the backdrop or
 * close button closes it. Cost estimation and range helpers are covered
 * directly.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { TokenDetailPanel } from '../src/client/TokenDetailPanel.tsx'
import {
  DEFAULT_TOKEN_PRICES, derivePerModel, derivePerSession, derivePerWorkspace, deriveSidebarTotals, deriveUsageTrend,
  estimateCost, formatCost, rangeSinceMs, trendBucketMs,
} from '../src/client/derive.ts'
import { zh } from '../src/client/locales.ts'

const t: Parameters<typeof TokenDetailPanel>[0]['t'] = makeTranslate(zh, commonZh)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const sid = (k: string): SessionId => k as SessionId

const NOW = 1755000000000

function makeSummary(
  id: string,
  usage: { uncached: number; output: number; cacheRead: number; cacheWrite: number } | undefined,
  updatedAt = NOW,
  modelUsage?: { byModel: Record<string, { uncachedInputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; requests: number }> },
): SessionSummary {
  return {
    id: sid(id),
    displayTitle: `会话${id.toUpperCase()}`,
    updatedAt,
    projectionValues: {
      ...(usage === undefined ? {} : { tokenUsage: usage }),
      ...(modelUsage === undefined ? {} : { modelUsage }),
    },
  } as SessionSummary
}

const usageA = { uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }
const usageB = { uncached: 800, output: 500, cacheRead: 2000, cacheWrite: 100 }

function panelProps(over: { open?: boolean; byId?: Record<string, SessionSummary | undefined>; items?: unknown[] } = {}) {
  const setOpen = vi.fn()
  const openSession = vi.fn()
  const props = {
    t,
    openSession,
    getDefaultModel: () => 'deepseek-v4-flash',
    useStore: (sel: (s: { open: boolean }) => unknown) => sel({ open: over.open ?? true }),
    useSessions: (sel: (s: { byId: Record<string, SessionSummary | undefined> }) => unknown) => sel({ byId: over.byId ?? {} }),
    useWorkspaces: (sel: (s: { items: unknown[] }) => unknown) => sel({ items: over.items ?? [] }),
    actions: { setOpen },
  } as unknown as Parameters<typeof TokenDetailPanel>[0] & { openSession: ReturnType<typeof vi.fn>; actions: { setOpen: ReturnType<typeof vi.fn> } }
  return props
}

const fullById: Record<string, SessionSummary | undefined> = {
  a: makeSummary('a', usageA, NOW, { byModel: { 'deepseek-v4-flash': { uncachedInputTokens: 1200, outputTokens: 3450, cacheReadTokens: 11000, cacheWriteTokens: 300, requests: 1 } } }),
  b: makeSummary('b', usageB, NOW, { byModel: { 'deepseek-v4-pro': { uncachedInputTokens: 800, outputTokens: 500, cacheReadTokens: 2000, cacheWriteTokens: 100, requests: 1 } } }),
}

const workspaceItems = [
  { workspaceId: 'w1', title: '项目A', sessionIds: [sid('a')] },
  { workspaceId: 'w2', title: '项目B', sessionIds: [sid('b')] },
]

function stubBalanceOk() {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, isAvailable: true, currency: 'CNY', totalBalance: '12.34', grantedBalance: '0', toppedUpBalance: '12.34' }),
  })))
}

describe('TokenDetailPanel', () => {
  it('renders nothing while closed', () => {
    const view = render(<TokenDetailPanel {...panelProps({ open: false })} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('shows hero cards, trend, model stats, project statistics, and the conversation log when open', () => {
    stubBalanceOk()
    render(<TokenDetailPanel {...panelProps({ byId: fullById, items: workspaceItems })} />)
    expect(screen.getByText('真实消耗')).toBeTruthy()
    expect(screen.getByText('估算费用')).toBeTruthy()
    expect(screen.getByText('缓存命中率')).toBeTruthy()
    expect(screen.getByText('使用趋势')).toBeTruthy()
    expect(screen.getByText('模型统计')).toBeTruthy()
    expect(screen.getByText('deepseek-v4-flash')).toBeTruthy()
    expect(screen.getByText('deepseek-v4-pro')).toBeTruthy()
    expect(screen.getByText('按项目')).toBeTruthy()
    expect(screen.getByText('项目A')).toBeTruthy()
    expect(screen.getByText('项目B')).toBeTruthy()
    expect(screen.getByText('按对话')).toBeTruthy()
    expect(screen.getByText('会话A')).toBeTruthy()
    expect(screen.getByText('会话B')).toBeTruthy()
    expect(screen.getByText('今日')).toBeTruthy() // range segmented control
    expect(screen.getByText('近7天')).toBeTruthy()
  })

  it('trails usage sessions outside every workspace in an ungrouped row', () => {
    stubBalanceOk()
    const ungrouped: Record<string, SessionSummary | undefined> = {
      ...fullById,
      c: makeSummary('c', { uncached: 100, output: 200, cacheRead: 0, cacheWrite: 0 }),
    }
    render(<TokenDetailPanel {...panelProps({ byId: ungrouped, items: workspaceItems })} />)
    expect(screen.getByText('未分组')).toBeTruthy()
  })

  it('opens a session and closes the panel on a conversation row click', () => {
    stubBalanceOk()
    const props = panelProps({ byId: fullById, items: workspaceItems })
    render(<TokenDetailPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /会话A/ }))
    expect(props.openSession).toHaveBeenCalledWith(sid('a'))
    expect(props.actions.setOpen).toHaveBeenCalledWith(false)
  })

  it('closes on the close button and on a backdrop click', () => {
    stubBalanceOk()
    const viaButton = panelProps({ byId: fullById })
    render(<TokenDetailPanel {...viaButton} />)
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(viaButton.actions.setOpen).toHaveBeenCalledWith(false)
    cleanup()

    const viaBackdrop = panelProps({ byId: fullById })
    const view = render(<TokenDetailPanel {...viaBackdrop} />)
    fireEvent.click(view.container.querySelector('[data-token-detail]')!)
    expect(viaBackdrop.actions.setOpen).toHaveBeenCalledWith(false)
  })
})

describe('usage statistics helpers', () => {
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

  it('rangeSinceMs returns day/7-day bounds and 0 for all', () => {
    expect(rangeSinceMs('all')).toBe(0)
    expect(rangeSinceMs('7d')).toBeGreaterThan(0)
    const today = rangeSinceMs('today')
    const d = new Date(today)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
  })

  it('derivePerSession filters by range, carries cacheRead/cost, and sorts by total', () => {
    const rows = derivePerSession(fullById)
    expect(rows[0]).toMatchObject({ id: sid('a'), input: 12500, output: 3450, cacheRead: 11000 })
    expect(rows[0].cost).toBeGreaterThan(0)
    const stale: Record<string, SessionSummary | undefined> = { ...fullById, a: makeSummary('a', usageA, 1) }
    const filtered = derivePerSession(stale, rangeSinceMs('7d'))
    expect(filtered.map((r) => r.id)).not.toContain(sid('a'))
  })

  it('deriveSidebarTotals and derivePerWorkspace honor the range', () => {
    const stale: Record<string, SessionSummary | undefined> = { ...fullById, a: makeSummary('a', usageA, 1) }
    expect(deriveSidebarTotals(stale, rangeSinceMs('7d')).sessions).toBe(1)
    const rows = derivePerWorkspace(workspaceItems, stale, rangeSinceMs('7d'))
    expect(rows.find((r) => r.id === 'w1')).toBeUndefined()
    expect(rows.find((r) => r.id === 'w2')).toMatchObject({ input: 2900, output: 500 })
  })

  it('trendBucketMs is hourly for today and daily otherwise', () => {
    expect(trendBucketMs('today')).toBe(60 * 60 * 1000)
    expect(trendBucketMs('7d')).toBe(24 * 60 * 60 * 1000)
    expect(trendBucketMs('all')).toBe(24 * 60 * 60 * 1000)
  })

  it('deriveUsageTrend buckets sessions by last activity and sums buckets', () => {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const ds = dayStart.getTime()
    const hour = 60 * 60 * 1000
    const byId: Record<string, SessionSummary | undefined> = {
      a: makeSummary('a', usageA, ds + 10 * hour),
      b: makeSummary('b', usageB, ds + 11 * hour),
    }
    const hourly = deriveUsageTrend(byId, 'today')
    expect(hourly).toHaveLength(2)
    const newest = hourly[hourly.length - 1]
    expect(newest).toMatchObject({ input: usageB.uncached + usageB.cacheWrite, output: usageB.output, cacheRead: usageB.cacheRead })
    const daily = deriveUsageTrend(byId, '7d')
    expect(daily).toHaveLength(1)
    expect(daily[0]).toMatchObject({ input: usageA.uncached + usageA.cacheWrite + usageB.uncached + usageB.cacheWrite })
  })

  it('derivePerModel aggregates modelUsage across sessions and sorts by total', () => {
    const rows = derivePerModel(fullById)
    expect(rows).toHaveLength(2)
    const flash = rows.find((r) => r.model === 'deepseek-v4-flash')
    expect(flash).toMatchObject({ sessions: 1, uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 })
    const pro = rows.find((r) => r.model === 'deepseek-v4-pro')
    expect(pro).toMatchObject({ sessions: 1, uncached: 800, output: 500 })
    // flash total > pro total, so it sorts first
    expect(rows[0].model).toBe('deepseek-v4-flash')
    // range filter drops stale sessions
    const stale: Record<string, SessionSummary | undefined> = { ...fullById, a: makeSummary('a', usageA, 1, fullById.a!.projectionValues!.modelUsage) }
    const filtered = derivePerModel(stale, rangeSinceMs('7d'))
    expect(filtered.map((r) => r.model)).not.toContain('deepseek-v4-flash')
    expect(filtered.map((r) => r.model)).toContain('deepseek-v4-pro')
  })
})
