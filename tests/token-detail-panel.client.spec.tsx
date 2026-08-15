// @vitest-environment jsdom
/**
 * TokenDetailPanel: the right-side usage drawer — renders nothing while
 * closed, and while open shows total usage, per-workspace (project) usage,
 * and per-conversation usage; clicking a conversation row opens that session
 * and closes the panel; clicking the backdrop or close button closes it.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { TokenDetailPanel } from '../src/client/TokenDetailPanel.tsx'
import { derivePerWorkspace } from '../src/client/derive.ts'
import { zh } from '../src/client/locales.ts'

const t: Parameters<typeof TokenDetailPanel>[0]['t'] = makeTranslate(zh, commonZh)

afterEach(cleanup)

const sid = (k: string): SessionId => k as SessionId

function makeSummary(id: string, usage: { uncached: number; output: number; cacheRead: number; cacheWrite: number } | undefined): SessionSummary {
  return {
    id: sid(id),
    displayTitle: `会话${id.toUpperCase()}`,
    updatedAt: 1,
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

describe('TokenDetailPanel', () => {
  it('renders nothing while closed', () => {
    const view = render(<TokenDetailPanel {...panelProps({ open: false })} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('shows totals, per-workspace usage, and per-conversation usage when open', () => {
    render(<TokenDetailPanel {...panelProps({ byId: fullById, items: workspaceItems })} />)
    expect(screen.getByText('总用量')).toBeTruthy()
    expect(screen.getByText('15.4K')).toBeTruthy() // billed input
    expect(screen.getByText('4K')).toBeTruthy() // output
    expect(screen.getByText('按项目')).toBeTruthy()
    expect(screen.getByText('项目A')).toBeTruthy()
    expect(screen.getByText('项目B')).toBeTruthy()
    expect(screen.getByText('按对话')).toBeTruthy()
    expect(screen.getByText('会话A')).toBeTruthy()
    expect(screen.getByText('会话B')).toBeTruthy()
  })

  it('trails usage sessions outside every workspace in an ungrouped row', () => {
    const ungrouped: Record<string, SessionSummary | undefined> = {
      ...fullById,
      c: makeSummary('c', { uncached: 100, output: 200, cacheRead: 0, cacheWrite: 0 }),
    }
    render(<TokenDetailPanel {...panelProps({ byId: ungrouped, items: workspaceItems })} />)
    expect(screen.getByText('未分组')).toBeTruthy()
  })

  it('opens a session and closes the panel on a conversation row click', () => {
    const props = panelProps({ byId: fullById, items: workspaceItems })
    render(<TokenDetailPanel {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /会话A/ }))
    expect(props.openSession).toHaveBeenCalledWith(sid('a'))
    expect(props.actions.setOpen).toHaveBeenCalledWith(false)
  })

  it('closes on the close button and on a backdrop click', () => {
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

describe('derivePerWorkspace', () => {
  it('sums member sessions and orders rows by total descending', () => {
    const rows = derivePerWorkspace(workspaceItems, fullById)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ id: 'w1', title: '项目A', input: 12500, output: 3450, sessions: 1 })
    expect(rows[1]).toMatchObject({ id: 'w2', title: '项目B', input: 2900, output: 500, sessions: 1 })
  })

  it('skips workspaces without usage and emits an ungrouped row for the rest', () => {
    const withEmpty = [...workspaceItems, { workspaceId: 'w3', title: '项目C', sessionIds: [sid('zz')] }]
    const rows = derivePerWorkspace(withEmpty, fullById)
    expect(rows.find((r) => r.id === 'w3')).toBeUndefined()
    const extra: Record<string, SessionSummary | undefined> = { ...fullById, c: makeSummary('c', { uncached: 100, output: 200, cacheRead: 0, cacheWrite: 0 }) }
    const withUngrouped = derivePerWorkspace(workspaceItems, extra)
    expect(withUngrouped.find((r) => r.title === 'ungrouped')).toMatchObject({ input: 100, output: 200, sessions: 1 })
  })
})
