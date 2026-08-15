/**
 * PerSessionList: the expandable per-conversation section of the sidebar
 * card — a toggle row plus, when open, one row per session (display title +
 * billed input/output, highest total first). Clicking a row opens that
 * session.
 */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import { formatTokens, type PerSessionRow } from './derive.ts'
import type { TokenKey } from './locales.ts'
import css from './PerSessionList.module.css'

/** Full props of the per-conversation list: rows, open flag, verbs, locale. */
export type PerSessionListProps = {
  rows: readonly PerSessionRow[]
  open: boolean
  onToggle: () => void
  onOpen?: (sessionId: SessionId) => void
} & PropsLocale<'tokenViewer'>

/**
 * Render the per-conversation toggle and, when open, the session rows.
 * @param props - rows, open flag, toggle/open verbs, and the locale seat.
 * @returns nothing for an empty list; otherwise the toggle plus rows.
 */
export function PerSessionList({ rows, open, onToggle, onOpen, t }: PerSessionListProps) {
  if (rows.length === 0) return null
  return (
    <div>
      <button type="button" className={css.toggle} onClick={onToggle}>
        {open ? t('collapse') : t('expand')} {t('perSession')} ({rows.length})
      </button>
      {open && (
        <div className={css.rows}>
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              className={css.row}
              onClick={() => { if (onOpen !== undefined) onOpen(row.id) }}
              title={row.title}
            >
              <span className={css.rowTitle}>{row.title}</span>
              <span className={css.rowTokens}>↑{formatTokens(row.input)} · ↓{formatTokens(row.output)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export type { TokenKey }
