// @vitest-environment jsdom
/**
 * SidebarTokenPanel: the card above the workspaces region aggregating
 * `tokenUsage` across every session row's projection values. Driven purely
 * through props — the useSessions selector stub returns the byId map. The
 * card renders nothing in the collapsed rail and nothing until a session
 * reports usage; the session-count segment only appears past one session.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import type { SessionId, SessionSummary } from '@deepseek-ai/dsh-client-runtime/client'
import { SidebarTokenPanel } from '../src/client/SidebarTokenPanel.tsx'
import { zh } from '../src/client/locales.ts'

const t: Parameters<typeof SidebarTokenPanel>[0]['t'] = makeTranslate(zh, commonZh)

afterEach(cleanup)

const sid = (k: string): SessionId => k as SessionId

function makeSummary(usage: { uncached: number; output: number; cacheRead: number; cacheWrite: number } | undefined): SessionSummary {
  return {
    sessionId: sid('s'),
    updatedAt: 1,
    completed: false,
    depth: 0,
    projectionValues: usage === undefined ? {} : { tokenUsage: usage },
  } as SessionSummary
}

function panelProps(byId: Record<string, SessionSummary | undefined>, wide = true) {
  return {
    wide,
    t,
    useSessions: (sel: (state: { byId: Record<string, SessionSummary | undefined> }) => unknown) => sel({ byId }),
  } as unknown as Parameters<typeof SidebarTokenPanel>[0]
}

describe('SidebarTokenPanel', () => {
  it('aggregates billed input, output, cache hit, and session count', () => {
    const view = render(<SidebarTokenPanel {...panelProps({
      a: makeSummary({ uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
      b: makeSummary({ uncached: 800, output: 500, cacheRead: 2000, cacheWrite: 100 }),
      c: makeSummary(undefined),
    })} />)
    expect(view.getByText('15.4K')).toBeTruthy() // 12500 + 2900
    expect(view.getByText('4K')).toBeTruthy() // 3450 + 500
    expect(view.getByText('84%')).toBeTruthy() // 13000 / 15400
    expect(view.getByText('2')).toBeTruthy() // two sessions reported usage
    expect(view.container.querySelector('[data-token-viewer-sidebar]')?.getAttribute('title')).toContain('会话: 2')
  })

  it('hides the session-count segment for a single reporting session', () => {
    const view = render(<SidebarTokenPanel {...panelProps({
      a: makeSummary({ uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
    })} />)
    expect(view.getByText('12.5K')).toBeTruthy()
    expect(view.queryByText('2')).toBeNull()
  })

  it('drops the cache-hit segment when no input was billed', () => {
    const view = render(<SidebarTokenPanel {...panelProps({
      a: makeSummary({ uncached: 0, output: 100, cacheRead: 0, cacheWrite: 0 }),
    })} />)
    expect(view.queryByText(/缓存命中/)).toBeNull()
    expect(view.getByText('100')).toBeTruthy()
  })

  it('renders nothing in the collapsed rail', () => {
    const view = render(<SidebarTokenPanel {...panelProps({
      a: makeSummary({ uncached: 1200, output: 3450, cacheRead: 11000, cacheWrite: 300 }),
    }, false)} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('renders nothing until a session reports usage', () => {
    const empty = render(<SidebarTokenPanel {...panelProps({})} />)
    expect(empty.container.firstChild).toBeNull()
    cleanup()
    const noUsage = render(<SidebarTokenPanel {...panelProps({ a: makeSummary(undefined) })} />)
    expect(noUsage.container.firstChild).toBeNull()
  })
})
