/**
 * TokenPet: the bottom-right whale-maid pet. An original inline-SVG chibi
 * whale in a maid headband — no third-party artwork — that shows which
 * DeepSeek pricing tier is active right now: asleep and drifting (with a moon
 * badge and rising Z's) through the off-peak windows, awake and sweating
 * (with a lightning badge) through the Beijing peak windows. The tooltip
 * carries the tier, the countdown to the next window boundary, and the
 * currently applicable flash prices; clicking the pet opens the usage
 * statistics drawer through the shared token-detail store.
 *
 * The state rides `isPeakHour` (the same Beijing-window logic the billing
 * uses), recomputed on a wall-clock ticker — nothing else re-renders on a
 * clock change. The pet hides itself while the drawer is open so the two
 * never stack on the same corner.
 */
import { useEffect, useState } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-layout's SlotMap merge (the shell.overlay entry).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { isPeakHour, pricesForModel } from './derive.ts'
import { tokenDetailStore, useTokenDetailOpen } from './token-detail-store.ts'
import css from './TokenPet.module.css'

/** Full props of the pet entry: the locale seat only (the pet reads no kit hooks). */
export type TokenPetProps = PropsLocale<'tokenViewer'>

/** Wall-clock recheck interval: cheap, and the countdown label stays honest. */
const TICK_MS = 30_000

/** Beijing-time tier transitions: 09:00 / 12:00 / 14:00 / 18:00, ms from Beijing midnight. */
const BOUNDARIES_BJT = [9 * 3600 * 1000, 12 * 3600 * 1000, 14 * 3600 * 1000, 18 * 3600 * 1000]

/** Fallback tier for the tooltip price line (the flash row the billing uses for unknowns). */
const TOOLTIP_MODEL = 'deepseek-v4-flash'

/**
 * Milliseconds from `now` to the next Beijing tier boundary (a window opening
 * or closing). After 18:00 the next transition is the following day's 09:00.
 * @param now - epoch ms.
 * @returns ms until the next boundary, always positive.
 */
export function nextBoundaryMs(now: number): number {
  const DAY_MS = 24 * 60 * 60 * 1000
  const bjtNow = (((now + 8 * 3600 * 1000) % DAY_MS) + DAY_MS) % DAY_MS
  for (const boundary of BOUNDARIES_BJT) {
    if (boundary > bjtNow) return boundary - bjtNow
  }
  return BOUNDARIES_BJT[0]! + DAY_MS - bjtNow
}

/**
 * Compact countdown for the tooltip.
 * @param ms - remaining time.
 * @param zh - whether the active locale renders Chinese.
 * @returns e.g. `2小时13分` / `41 分钟` / `1h 5m`.
 */
export function formatCountdown(ms: number, zh: boolean): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return zh ? `${minutes} 分钟` : minutes === 1 ? '1 minute' : `${minutes} minutes`
  return zh ? `${hours}小时${String(minutes).padStart(2, '0')}分` : `${hours}h ${String(minutes).padStart(2, '0')}m`
}

/**
 * Wall-clock ticker: re-renders the pet on an interval so the tier flips at
 * the Beijing boundaries without any session activity.
 * @returns the last sampled clock.
 */
function useWallClock(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()) }, TICK_MS)
    return () => { clearInterval(timer) }
  }, [])
  return now
}

/**
 * The bottom-right pet entry of `shell.overlay`. Renders nothing while the
 * statistics drawer is open.
 * @param props - the locale seat.
 * @returns the pet, or nothing while the drawer is open.
 */
export function TokenPet(props: TokenPetProps) {
  const { t } = props
  const drawerOpen = useTokenDetailOpen()
  const now = useWallClock()
  if (drawerOpen) return null
  const peak = isPeakHour(now)
  const isZh = t('today') === '当天'
  const price = pricesForModel(TOOLTIP_MODEL, now)
  const countdown = formatCountdown(nextBoundaryMs(now), isZh)
  const tooltip = [
    `${t(peak ? 'petPeak' : 'petOffPeak')} · ${t(peak ? 'petUntilOffPeak' : 'petUntilPeak')} ${countdown}`,
    `${t('input')} ¥${price.inputPerM} · ${t('output')} ¥${price.outputPerM} ${t('petPerM')}`,
  ].join('\n')
  return (
    <button
      type="button"
      className={css.pet}
      data-token-pet
      data-pet-state={peak ? 'peak' : 'off-peak'}
      title={tooltip}
      aria-label={tooltip.replace('\n', ' ')}
      onClick={() => { tokenDetailStore.setOpen(true) }}
    >
      <svg className={css.svg} viewBox="0 0 120 120" aria-hidden="true">
        {/* tail flukes */}
        <path className={css.tail} d="M88 58 q20 -8 24 -28 q6 20 -12 34 q-6 5 -12 4 z" fill="#4a7bd4" />
        {/* body */}
        <ellipse cx="58" cy="74" rx="40" ry="31" fill="#5b8def" />
        {/* belly */}
        <ellipse cx="58" cy="86" rx="27" ry="15" fill="#dceaff" />
        {/* side fin */}
        <path d="M44 94 q-6 14 8 17 q-2 -10 6 -14 z" fill="#4a7bd4" />
        {/* blowhole droplets */}
        <circle className={css.drop} cx="54" cy="30" r="2.6" fill="#9cc3ff" />
        <circle className={css.dropSlow} cx="66" cy="24" r="2" fill="#9cc3ff" />
        {/* maid headband frill */}
        <path d="M26 52 q32 -30 66 -2 l-5 9 q-28 -22 -56 1 z" fill="#ffffff" stroke="#c9d6ea" strokeWidth="1.4" />
        {/* headband ribbon bow */}
        <path d="M30 50 l-10 -7 1 10 z" fill="#5b8def" />
        <path d="M31 51 l-3 11 9 -3 z" fill="#5b8def" />
        <circle cx="29" cy="52" r="2.6" fill="#3b6cc4" />
        {peak ? (
          <>
            {/* awake eyes */}
            <circle cx="44" cy="70" r="3.8" fill="#1e2a3a" />
            <circle cx="66" cy="70" r="3.8" fill="#1e2a3a" />
            <circle cx="45.3" cy="68.7" r="1.2" fill="#ffffff" />
            <circle cx="67.3" cy="68.7" r="1.2" fill="#ffffff" />
            {/* worried mouth */}
            <path d="M52 82 q4 -4 8 0" stroke="#1e2a3a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            {/* sleeping eyes */}
            <path d="M40 70 q4 4 8 0" stroke="#1e2a3a" strokeWidth="2" strokeLinecap="round" fill="none" />
            <path d="M62 70 q4 4 8 0" stroke="#1e2a3a" strokeWidth="2" strokeLinecap="round" fill="none" />
            {/* content smile */}
            <path d="M52 80 q4 4 8 0" stroke="#1e2a3a" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          </>
        )}
        {/* blush */}
        <ellipse cx="36" cy="78" rx="4" ry="2.4" fill="#ffb3c1" opacity="0.75" />
        <ellipse cx="74" cy="78" rx="4" ry="2.4" fill="#ffb3c1" opacity="0.75" />
      </svg>
      <span className={css.badge} aria-hidden="true">{peak ? '⚡' : '🌙'}</span>
      {peak
        ? <span className={css.sweat} aria-hidden="true">💧</span>
        : <span className={css.zzz} aria-hidden="true">💤</span>}
    </button>
  )
}
