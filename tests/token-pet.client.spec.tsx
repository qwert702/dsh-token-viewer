// @vitest-environment jsdom
/**
 * TokenPet: the bottom-right whale-maid pet. The pet is asleep (moon badge,
 * 💤) through the off-peak windows and awake (lightning badge, sweat) through
 * the Beijing peak windows, driven by `isPeakHour` on a wall-clock sample —
 * the specs stub the clock onto both sides of a boundary. The tooltip carries
 * the tier, the countdown to the next boundary, and the flash prices; a click
 * opens the usage-statistics drawer through the shared token-detail store,
 * and the pet renders nothing while that drawer is open.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { TokenPet, formatCountdown, nextBoundaryMs } from '../src/client/TokenPet.tsx'
import { tokenDetailStore } from '../src/client/token-detail-store.ts'
import { zh } from '../src/client/locales.ts'

const t = makeTranslate(zh)

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  tokenDetailStore.setOpen(false)
})

const HOUR = 60 * 60 * 1000

/**
 * 2026-08-17 is a Monday; the clock is stubbed onto real epoch values, and
 * `isPeakHour`/`nextBoundaryMs` do their own Beijing conversion (UTC+8):
 * 03:00 UTC = 11:00 Beijing (peak), 07:00 UTC = 15:00 Beijing (peak),
 * 05:00 UTC = 13:00 Beijing (off-peak between the two windows).
 */
function stubClock(utcHour: number, utcMinute = 0): void {
  vi.useFakeTimers()
  const now = Date.UTC(2026, 7, 17, utcHour, utcMinute)
  vi.setSystemTime(now)
  vi.spyOn(Date, 'now').mockImplementation(() => now)
}

describe('TokenPet', () => {
  it('sleeps with the moon badge in the off-peak window (13:00 Beijing)', () => {
    stubClock(5, 1) // 13:01 Beijing — between the two peak windows
    const view = render(<TokenPet t={t} />)
    expect(view.container.querySelector('[data-token-pet]')?.getAttribute('data-pet-state')).toBe('off-peak')
    expect(screen.getByText('🌙')).toBeTruthy()
    expect(screen.getByText('💤')).toBeTruthy()
    expect(screen.queryByText('⚡')).toBeNull()
    expect(view.getByTitle(/谷时（标准牌价）/)).toBeTruthy()
    expect(view.getByTitle(/距峰时还有 59 分钟/)).toBeTruthy()
  })

  it('is awake with the lightning badge in the peak window (15:00 Beijing)', () => {
    stubClock(7) // 15:00 Beijing — inside the afternoon peak window
    const view = render(<TokenPet t={t} />)
    expect(view.container.querySelector('[data-token-pet]')?.getAttribute('data-pet-state')).toBe('peak')
    expect(screen.getByText('⚡')).toBeTruthy()
    expect(screen.getByText('💧')).toBeTruthy()
    expect(screen.queryByText('🌙')).toBeNull()
    expect(view.getByTitle(/峰时（牌价 ×2）/)).toBeTruthy()
    expect(view.getByTitle(/距谷时还有/)).toBeTruthy()
  })

  it('carries the currently applicable flash prices in the tooltip', () => {
    stubClock(7) // peak: flash peak prices are the doubled 3 / 9
    const view = render(<TokenPet t={t} />)
    expect(view.getByTitle(/输入 ¥3 · 输出 ¥9/)).toBeTruthy()
    cleanup()
    stubClock(5) // off-peak: 1.5 / 4.5
    const off = render(<TokenPet t={t} />)
    expect(off.getByTitle(/输入 ¥1.5 · 输出 ¥4.5/)).toBeTruthy()
  })

  it('opens the statistics drawer on click', () => {
    stubClock(7)
    tokenDetailStore.setOpen(false)
    const view = render(<TokenPet t={t} />)
    fireEvent.click(view.container.querySelector('[data-token-pet]')!)
    expect(tokenDetailStore.getSnapshot().open).toBe(true)
  })

  it('renders nothing while the statistics drawer is open', () => {
    stubClock(7)
    tokenDetailStore.setOpen(true)
    const view = render(<TokenPet t={t} />)
    expect(view.container.querySelector('[data-token-pet]')).toBeNull()
  })

  it('flips state across a boundary on the wall-clock ticker', async () => {
    vi.useFakeTimers()
    const start = Date.UTC(2026, 7, 17, 5, 59) // 13:59 Beijing — off-peak
    vi.setSystemTime(start)
    const nowSpy = vi.spyOn(Date, 'now').mockImplementation(() => start)
    const view = render(<TokenPet t={t} />)
    expect(view.container.querySelector('[data-token-pet]')?.getAttribute('data-pet-state')).toBe('off-peak')
    // 30s ticker samples 14:00 Beijing — the pet wakes up without a remount.
    nowSpy.mockImplementation(() => start + HOUR / 60)
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(view.container.querySelector('[data-token-pet]')?.getAttribute('data-pet-state')).toBe('peak')
  })
})

describe('pet helpers', () => {
  it('nextBoundaryMs counts to the next Beijing transition, crossing midnight', () => {
    const utcOf = (hour: number, minute = 0): number => Date.UTC(2026, 7, 17, hour, minute)
    // 11:00 Beijing: the 12:00 boundary is one hour away.
    expect(nextBoundaryMs(utcOf(3))).toBe(HOUR)
    // 13:00 Beijing: the 14:00 boundary is one hour away.
    expect(nextBoundaryMs(utcOf(5))).toBe(HOUR)
    // 17:30 Beijing: 18:00 is half an hour away.
    expect(nextBoundaryMs(utcOf(9, 30))).toBe(HOUR / 2)
    // 20:00 Beijing: the next transition is tomorrow's 09:00 — 13h away.
    expect(nextBoundaryMs(utcOf(12))).toBe(13 * HOUR)
  })

  it('formatCountdown renders compact zh and en strings', () => {
    expect(formatCountdown(133 * 60 * 1000, true)).toBe('2小时13分')
    expect(formatCountdown(41 * 60 * 1000, true)).toBe('41 分钟')
    expect(formatCountdown(133 * 60 * 1000, false)).toBe('2h 13m')
    expect(formatCountdown(60 * 1000, false)).toBe('1 minute')
  })
})
