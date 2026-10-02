/**
 * TokenPet: the bottom-right whale-maid pet. The artwork is the community's
 * chibi DeepSeek whale-maid (`assets/whale-maid.png`, resized; CC BY-NC-SA
 * 4.0, see README credits — non-commercial use only). The pet shows which
 * DeepSeek pricing tier is active right now: drifting half-asleep with a moon
 * badge and rising Z's through the off-peak windows, wiggling awake with a
 * lightning badge and a sweat drop through the Beijing peak windows. The
 * tooltip carries the tier, the countdown to the next window boundary, and
 * the currently applicable flash prices; clicking the pet opens the usage
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
import whaleMaidSrc from './assets/whale-maid.png'
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
      <img className={css.maid} src={whaleMaidSrc} alt="" draggable={false} />
      <span className={css.badge} aria-hidden="true">{peak ? '⚡' : '🌙'}</span>
      {peak
        ? <span className={css.sweat} aria-hidden="true">💧</span>
        : <span className={css.zzz} aria-hidden="true">💤</span>}
    </button>
  )
}
