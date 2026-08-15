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
  DEFAULT_TOKEN_PRICES, derivePerSession, derivePerWorkspace, deriveSidebarTotals,
  estimateCost, formatCost, rangeSinceMs,
} from '../src/client/derive.ts'
import { zh } from '../src/client/locales.ts'

const t: Parameters<typeof TokenDetailPanel>[0]['t'] = makeTranslate(zh, commonZh)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const sid = (k: string): SessionId => k as SessionId

const NOW = 1755000000000

function makeSummary(id: string, usage: { uncached: number; output: number; cacheRead: number; cacheWrite: number } | undefined, updatedAt = NOW): SessionSummary {
  return {
    id: sid(id),
    displayTitle: `会话${id.toUpperCase()}`,
    updatedAt,
    projectionValues: usage === undefined ? {} : { tokenUsage: usage },
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
    useStore: (sel: (s: { open: boolean }) => unknown) => sel({ open: over.open ?? true }),
    useSessions: (sel: (s: { byId: Record<string, SessionSummary | undefined> }) => unknown) => sel({ byId: over.byId ?? {} }),
    useWorkspaces: (sel: (s: { items: unknown[] }) => unknown) => sel({ items: over.items ?? [] }),
    actions: { setOpen },
  } as unknown as Parameters<typeof TokenDetailPanel>[0] & { openSession: ReturnType<typeof vi.fn>; actions: { setOpen: ReturnType<typeof vi.fn> } }
  return props
}

const fullById: Record<string, SessionSummary | undefined> = {
  a: makeSummary('a', usageA),
  b: makeSummary('b', usageB),
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

  it('shows hero cards, project statistics, and the conversation log when open', () => {
    stubBalanceOk()
    render(<TokenDetailPanel {...panelProps({ byId: fullById, items: workspaceItems })} />)
    expect(screen.getByText('真实消耗')).toBeTruthy()
    expect(screen.getByText('估算费用')).toBeTruthy()
    expect(screen.getByText('缓存命中率')).toBeTruthy()
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
  it('estimateCost prices each bucket under the default DeepSeek prices', () => {
    const usage = { uncachedInputTokens: 1000000, outputTokens: 500000, cacheReadTokens: 1000000, cacheWriteTokens: 1000000 }
    const expected = (1000000 + 1000000) / 1e6 * DEFAULT_TOKEN_PRICES.inputPerM
      + 500000 / 1e6 * DEFAULT_TOKEN_PRICES.outputPerM
      + 1000000 / 1e6 * DEFAULT_TOKEN_PRICES.cacheReadPerM
      + 1000000 / 1e6 * DEFAULT_TOKEN_PRICES.cacheWritePerM
    expect(estimateCost(usage)).toBeCloseTo(expected)
    expect(estimateCost(usage, { inputPerM: 2, outputPerM: 4, cacheReadPerM: 0.5, cacheWritePerM: 2 })).toBeCloseTo(8.5)
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
})
