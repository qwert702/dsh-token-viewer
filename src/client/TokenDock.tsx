/**
 * TokenDock: a slim live strip docked above the composer showing what the
 * current session has consumed — billed input (uncached + cache read +
 * cache write), cache hit rate, output, and approximate context occupancy
 * with a mini progress bar. Renders nothing until a provider reports usage.
 * Live state arrives as the projected whole snapshots; the strip carries no
 * store and no wire.
 */
import { useMemo, type ReactElement } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-conversation's SlotMap merge (the input.dock entry).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the token-meter SessionProjectionMap merge (typed reads of
// 'tokenUsage' / 'contextPressure' / 'contextBreakdown').
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { deriveTokenView, formatTokens } from './derive.ts'
import css from './TokenDock.module.css'

/** Full props of the dock entry: session standard kit + the locale seat. */
export type TokenDockProps = PropsRuntime<'conversation.input.dock'> & PropsLocale<'tokenViewer'>

/** One dock segment plus its optional leading separator. */
interface Segment {
  key: string
  node: ReactElement
}

/** Compose the strip's segments; empty views return nothing. */
function dockSegments(view: NonNullable<ReturnType<typeof deriveTokenView>>, t: TokenDockProps['t']): Segment[] {
  const segments: Segment[] = []
  const push = (key: string, node: ReactElement): void => { segments.push({ key, node }) }
  if (view.input > 0) {
    push('input', <span className={css.seg}>{t('input')} <strong>{formatTokens(view.input)}</strong></span>)
  }
  if (view.output > 0) {
    push('output', <span className={css.seg}>{t('output')} <strong>{formatTokens(view.output)}</strong></span>)
  }
  if (view.cacheHit !== null) {
    push('cacheHit', <span className={css.seg}>{t('cacheHit')} <strong>{view.cacheHit}%</strong></span>)
  }
  if (view.occupancy !== null) {
    push('context', (
      <span className={css.seg}>
        {t('context')} <strong>{view.occupancy.percent}%</strong>
        <span className={css.occ}>
          <span className={css.track}>
            <span className={css.fill} style={{ width: `${view.occupancy.percent}%` }} />
          </span>
        </span>
      </span>
    ))
  }
  return segments
}

/** The strip's hover detail: the full billing breakdown plus occupancy. */
function dockTooltip(view: NonNullable<ReturnType<typeof deriveTokenView>>, t: TokenDockProps['t']): string {
  const lines = [
    `${t('input')}: ${formatTokens(view.input)} ${t('tokens')} (${t('uncached')} ${formatTokens(view.uncached)} · ${t('cacheRead')} ${formatTokens(view.cacheRead)} · ${t('cacheWrite')} ${formatTokens(view.cacheWrite)})`,
    `${t('output')}: ${formatTokens(view.output)} ${t('tokens')}`,
  ]
  if (view.cacheHit !== null) lines.push(`${t('cacheHit')}: ${view.cacheHit}%`)
  if (view.occupancy !== null) {
    lines.push(`${t('context')}: ${formatTokens(view.occupancy.usedTokens)} / ${formatTokens(view.occupancy.contextWindow)} ${t('tokens')} (${view.occupancy.percent}%)`)
  }
  return lines.join('\n')
}

/**
 * Dock adapter: reads the host-computed token projections; absent usage
 * renders nothing.
 */
export function TokenDock({ useProjection, t }: TokenDockProps) {
  const usage = useProjection('tokenUsage')
  const pressure = useProjection('contextPressure')
  const breakdown = useProjection('contextBreakdown')
  const view = useMemo(() => deriveTokenView(usage, pressure, breakdown), [usage, pressure, breakdown])
  if (view === null) return null
  const segments = dockSegments(view, t)
  return (
    <div className={css.dock} data-token-viewer title={dockTooltip(view, t)}>
      <div className={css.bar}>
        {segments.map((segment, index) => (
          <span key={segment.key} className={css.segRow}>
            {index > 0 && <span className={css.sep}>·</span>}
            {segment.node}
          </span>
        ))}
      </div>
    </div>
  )
}
