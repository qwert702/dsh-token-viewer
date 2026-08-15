// @vitest-environment jsdom
/**
 * SidebarTokenPanel + BalanceRow + PerSessionList: the card above the
 * workspaces region — the balance row (fetched through the host proxy), the
 * aggregate consumption line, and the expandable per-conversation list with
 * open-on-click. Derive helpers are covered directly for the sort/filter and
 * currency branches.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { BalanceRow } from '../src/client/BalanceRow.tsx'
import { PerSessionList } from '../src/client/PerSessionList.tsx'
import { SidebarTokenPanel } from '../src/client/SidebarTokenPanel.tsx'
import { currencySymbol, derivePerSession, formatMoney } from '../src/client/derive.ts'
import { zh } from '../src/client/locales.ts'

const t: Parameters<typeof SidebarTokenPanel>[0]['t'] = makeTranslate(zh, commonZh)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const sid = (k: string): SessionId => k as SessionId

function makeSummary(id: string, usage: { uncached: number; output: number; cacheRead: number; cacheWrite: number } | undefined): SessionSummary {
  return {
    id: sid(id),
    displayTitle: `会话${id.toUpperCase()}`,
    updatedAt: 1,
    projectionValues: usage === undefined ? {} : { tokenUsage: usage },
  } as SessionSummary
}

function panelProps(byId: Record<string, SessionSummary | undefined>, wide = true) {
  const openSession = vi.fn()
  const setOpen = vi.fn()
  return {
    wide,
    t,
    openSession,
    useStore: (sel: (s: { open: boolean }) => unknown) => sel({ open: false }),
    actions: { setOpen },
    useSessions: (sel: (state: { byId: Record<string, SessionSummary | undefined> }) => unknown) => sel({ byId }),
  } as unknown as Parameters<typeof SidebarTokenPanel>[0] & { openSession: ReturnType<typeof vi.fn>; actions: { setOpen: ReturnType<typeof vi.fn> } }
}

function stubBalanceOk() {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, isAvailable: true, currency: 'CNY', totalBalance: '170.37', grantedBalance: '0.00', toppedUpBalance: '170.37' }),
  })))
}

describe('derive helpers', () => {
  it('derivePerSession filters zero-usage sessions and sorts by total descending', () => {
    const byId: Record<string, SessionSummary | undefined> = {
      a: makeSummary('a', { uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
      b: makeSummary('b', { uncached: 800, output: 500, cacheRead: 2000, cacheWrite: 100 }),
      c: makeSummary('c', undefined),
      d: makeSummary('d', { uncached: 0, output: 0, cacheRead: 0, cacheWrite: 0 }),
    }
    const rows = derivePerSession(byId)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: sid('a'), title: '会话A', input: 12500, output: 3450, total: 15950 })
    expect(rows[1]).toMatchObject({ id: sid('b'), title: '会话B', total: 3400 })
  })

  it('currencySymbol and formatMoney cover their branches', () => {
    expect(currencySymbol('CNY')).toBe('¥')
    expect(currencySymbol('USD')).toBe('$')
    expect(currencySymbol('EUR')).toBe('€')
    expect(currencySymbol('JPY')).toBe('JPY ')
    expect(currencySymbol(null)).toBe('')
    expect(currencySymbol(undefined)).toBe('')
    expect(formatMoney('170.37')).toBe('170.37')
    expect(formatMoney(5)).toBe('5.00')
    expect(formatMoney(Number.NaN)).toBe('—')
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
  })
})

describe('BalanceRow', () => {
  it('renders the currency figure with a refresh control when ok', () => {
    render(<BalanceRow balance={{ status: 'ok', balance: { ok: true, isAvailable: true, currency: 'CNY', totalBalance: 12.34, grantedBalance: 0, toppedUpBalance: 12.34 } }} onRefresh={() => {}} t={t} />)
    expect(screen.getByText('¥12.34')).toBeTruthy()
    expect(screen.getByRole('button', { name: '刷新余额' })).toBeTruthy()
  })

  it('renders the error-retry control and nothing while loading', () => {
    const onRefresh = vi.fn()
    render(<BalanceRow balance={{ status: 'error', error: 'no-api-key' }} onRefresh={onRefresh} t={t} />)
    const retry = screen.getByRole('button', { name: /余额不可用/ })
    fireEvent.click(retry)
    expect(onRefresh).toHaveBeenCalledOnce()
    cleanup()
    const loading = render(<BalanceRow balance={{ status: 'loading' }} onRefresh={() => {}} t={t} />)
    expect(loading.container.firstChild).toBeNull()
  })
})

describe('PerSessionList', () => {
  const rows = [
    { id: sid('a'), title: '会话A', input: 12500, output: 3450, cacheRead: 11000, total: 15950, cost: 0.1, updatedAt: 1 },
    { id: sid('b'), title: '会话B', input: 2900, output: 500, cacheRead: 2000, total: 3400, cost: 0.02, updatedAt: 1 },
  ]

  it('renders nothing for an empty list', () => {
    const view = render(<PerSessionList rows={[]} open onToggle={() => {}} t={t} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('toggles the per-session rows and opens a session on row click', () => {
    const onToggle = vi.fn()
    const onOpen = vi.fn()
    render(<PerSessionList rows={rows} open={false} onToggle={onToggle} onOpen={onOpen} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: /按会话查看/ }))
    expect(onToggle).toHaveBeenCalledOnce()
    cleanup()

    render(<PerSessionList rows={rows} open onToggle={onToggle} onOpen={onOpen} t={t} />)
    fireEvent.click(screen.getByRole('button', { name: /会话A/ }))
    expect(onOpen).toHaveBeenCalledWith(sid('a'))
    expect(screen.getByText(/↑12.5K/)).toBeTruthy()
  })
})

describe('SidebarTokenPanel', () => {
  it('aggregates usage and renders the per-session toggle while balance loads', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Promise(() => {}))) // balance stays loading
    const props = panelProps({
      a: makeSummary('a', { uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
      b: makeSummary('b', { uncached: 800, output: 500, cacheRead: 2000, cacheWrite: 100 }),
      c: makeSummary('c', undefined),
    })
    const view = render(<SidebarTokenPanel {...props} />)
    expect(view.getByText('15.4K')).toBeTruthy()
    expect(view.getByText('4K')).toBeTruthy()
    expect(view.getByRole('button', { name: /按会话查看/ })).toBeTruthy()
    expect(view.queryByText(/¥/)).toBeNull()
  })

  it('renders the resolved balance once the host proxy answers', async () => {
    stubBalanceOk()
    const props = panelProps({
      a: makeSummary('a', { uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
    })
    render(<SidebarTokenPanel {...props} />)
    await waitFor(() => expect(screen.getByText('¥170.37')).toBeTruthy())
  })

  it('opens a session from the per-conversation list', async () => {
    stubBalanceOk()
    const props = panelProps({
      a: makeSummary('a', { uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
    })
    render(<SidebarTokenPanel {...props} />)
    await waitFor(() => expect(screen.getByText('¥170.37')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /按会话查看/ }))
    fireEvent.click(screen.getByRole('button', { name: /会话A/ }))
    expect(props.openSession).toHaveBeenCalledWith(sid('a'))
  })

  it('opens the detail panel from the detail button', () => {
    const props = panelProps({
      a: makeSummary('a', { uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
    })
    render(<SidebarTokenPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /用量详情/ }))
    expect(props.actions.setOpen).toHaveBeenCalledWith(true)
  })

  it('renders nothing in the collapsed rail and nothing without usage when balance fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
    const withUsage = panelProps({
      a: makeSummary('a', { uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
    }, false)
    const rail = render(<SidebarTokenPanel {...withUsage} />)
    expect(rail.container.firstChild).toBeNull()
    cleanup()

    const noUsage = panelProps({ a: makeSummary('a', undefined) })
    render(<SidebarTokenPanel {...noUsage} />)
    await waitFor(() => expect(screen.queryByText('Token 消耗')).toBeNull())
  })
})
