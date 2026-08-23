// @vitest-environment jsdom
/**
 * TokenDock: the composer-dock strip — segments for billed input, output,
 * cache hit rate, and context occupancy, driven purely through props. Absent
 * usage renders nothing; a missing pressure or zero billed input drops the
 * matching segment. The hover tooltip carries the full billing breakdown.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { TokenDock } from '../src/client/TokenDock.tsx'
import { zh } from '../src/client/locales.ts'

const t: Parameters<typeof TokenDock>[0]['t'] = makeTranslate(zh, commonZh)

afterEach(cleanup)

/** Token-meter projection fixtures. */
function makeUsage(over: Partial<{ uncached: number; output: number; cacheRead: number; cacheWrite: number }> = {}) {
  return {
    uncachedInputTokens: over.uncached ?? 1200,
    outputTokens: over.output ?? 3450,
    cacheReadTokens: over.cacheRead ?? 11000,
    cacheWriteTokens: over.cacheWrite ?? 300,
  }
}

function makePressure(over: Partial<{ projected: number; pressure: number; window: number }> = {}) {
  return {
    projectedTokens: over.projected ?? 15200,
    pressureTokens: over.pressure ?? 14000,
    contextWindow: over.window ?? 64000,
  }
}

function dockProps(up: (key: string) => unknown) {
  return { useProjection: up, t } as unknown as Parameters<typeof TokenDock>[0]
}

describe('TokenDock', () => {
  it('renders nothing while usage is absent', () => {
    const view = render(<TokenDock {...dockProps(() => undefined)} />)
    expect(view.container.firstChild).toBeNull()
  })

  it('renders the billing segments and context occupancy', () => {
    const view = render(<TokenDock {...dockProps((key) => {
      if (key === 'tokenUsage') return makeUsage()
      if (key === 'contextPressure') return makePressure()
      return undefined
    })} />)
    expect(view.getByText('12.5K')).toBeTruthy() // billed input (uncached + cache read + cache write)
    expect(view.getByText('3.5K')).toBeTruthy() // output
    expect(view.getByText('88%')).toBeTruthy() // cache hit (11000 / 12500)
    expect(view.getByText('24%')).toBeTruthy() // occupancy (15200 / 64000)
    expect(view.container.querySelector('[data-token-viewer]')?.getAttribute('title')).toContain('未缓存 1.2K')
  })

  it('drops the cache-hit segment when no input was billed', () => {
    const view = render(<TokenDock {...dockProps((key) => {
      if (key === 'tokenUsage') return makeUsage({ uncached: 0, cacheRead: 0, cacheWrite: 0 })
      return undefined
    })} />)
    expect(view.queryByText(/缓存命中/)).toBeNull()
    expect(view.getByText('3.5K')).toBeTruthy()
  })

  it('drops the context segment until both numerator and capacity are known', () => {
    const withoutWindow = render(<TokenDock {...dockProps((key) => {
      if (key === 'tokenUsage') return makeUsage()
      if (key === 'contextPressure') return makePressure({ window: undefined })
      return undefined
    })} />)
    expect(withoutWindow.queryByText(/上下文/)).toBeNull()
    cleanup()

    const withoutPressure = render(<TokenDock {...dockProps((key) => key === 'tokenUsage' ? makeUsage() : undefined)} />)
    expect(withoutPressure.queryByText(/上下文/)).toBeNull()
  })

  it('falls back to the bare pressure sample for occupancy', () => {
    const view = render(<TokenDock {...dockProps((key) => {
      if (key === 'tokenUsage') return makeUsage()
      if (key === 'contextPressure') return makePressure({ projected: undefined, pressure: 16000 })
      return undefined
    })} />)
    // 16000 / 64000 = 25%; projectedTokens is absent so the sample drives it.
    expect(view.getByText('25%')).toBeTruthy()
  })

  it('clamps occupancy at 100 percent', () => {
    const view = render(<TokenDock {...dockProps((key) => {
      if (key === 'tokenUsage') return makeUsage()
      if (key === 'contextPressure') return makePressure({ projected: 200000 })
      return undefined
    })} />)
    expect(view.getByText('100%')).toBeTruthy()
  })

  it('renders nothing when the projection reports zero totals', () => {
    const view = render(<TokenDock {...dockProps((key) => key === 'tokenUsage' ? makeUsage({ uncached: 0, output: 0, cacheRead: 0, cacheWrite: 0 }) : undefined)} />)
    expect(view.container.firstChild).toBeNull()
  })
})
