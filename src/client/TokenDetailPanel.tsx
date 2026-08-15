/**
 * TokenDetailPanel: the right-side usage detail drawer opened from the
 * sidebar card. Shows total usage, per-workspace (project) usage, and
 * per-conversation usage; clicking a conversation row opens that session and
 * closes the panel. Registered into shell.overlay, renders nothing while
 * closed (click-through), and takes over pointer events only when open.
 */
import { useMemo } from 'react'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls ui-layout's SlotMap merge (the shell.overlay entry).
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
// Type-only: pulls the token-meter SessionProjectionMap merge.
import type {} from '@deepseek-ai/dsh-token-meter/client'
import { derivePerSession, derivePerWorkspace, deriveSidebarTotals, formatTokens } from './derive.ts'
import type { TokenDetailStore } from './token-detail-store.ts'
import css from './TokenDetailPanel.module.css'

/** Business face injected by the client plugin body: open a session by id. */
export interface TokenDetailPanelInjected {
  openSession: (sessionId: SessionId) => void
}

/** Full props of the detail panel: global seat + shared store + open verb + locale. */
export type TokenDetailPanelProps = PropsRuntime<'shell.overlay'> & PropsStore<TokenDetailStore> & TokenDetailPanelInjected & PropsLocale<'tokenViewer'>

/**
 * Render the right-side detail drawer.
 * @param props - global seat, shared open store, session-open verb, locale.
 * @returns the drawer, or nothing while closed.
 */
export function TokenDetailPanel({ useStore, useSessions, useWorkspaces, actions, t, openSession }: TokenDetailPanelProps) {
  const open = useStore((state) => state.open)
  const byId = useSessions((state) => state.byId)
  const workspaceItems = useWorkspaces((state) => state.items)
  const totals = useMemo(() => deriveSidebarTotals(byId), [byId])
  const perWorkspace = useMemo(() => derivePerWorkspace(workspaceItems, byId), [workspaceItems, byId])
  const perSession = useMemo(() => derivePerSession(byId), [byId])
  if (!open) return null
  const input = totals.uncached + totals.cacheRead + totals.cacheWrite
  const cacheHit = input > 0 ? Math.round((totals.cacheRead / input) * 100) : null
  const close = () => { actions.setOpen(false) }
  return (
    <div className={css.backdrop} onClick={close} data-token-detail>
      <div className={css.panel} role="dialog" aria-label={t('title')} onClick={(e) => { e.stopPropagation() }}>
        <div className={css.header}>
          <div className={css.headerTitle}>{t('title')}</div>
          <button type="button" className={css.close} onClick={close} aria-label={t('close')}>✕</button>
        </div>
        <div className={css.body}>
          <section className={css.section}>
            <div className={css.sectionTitle}>{t('total')}</div>
            <div className={css.totalRow}>
              <span className={css.seg}>{t('input')} <strong>{formatTokens(input)}</strong></span>
              <span className={css.seg}>{t('output')} <strong>{formatTokens(totals.output)}</strong></span>
              {cacheHit !== null && <span className={css.seg}>{t('cacheHit')} <strong>{cacheHit}%</strong></span>}
              <span className={css.seg}>{t('sessions')} <strong>{totals.sessions}</strong></span>
            </div>
          </section>
          <section className={css.section}>
            <div className={css.sectionTitle}>{t('byProject')}</div>
            <div className={css.rows}>
              {perWorkspace.map((row) => (
                <div key={row.id} className={css.row}>
                  <span className={css.rowTitle}>{row.title === 'ungrouped' ? t('ungrouped') : row.title}</span>
                  <span className={css.rowTokens}>↑{formatTokens(row.input)} · ↓{formatTokens(row.output)}</span>
                </div>
              ))}
            </div>
          </section>
          <section className={css.section}>
            <div className={css.sectionTitle}>{t('byConversation')}</div>
            <div className={css.rows}>
              {perSession.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  className={css.rowButton}
                  onClick={() => { openSession(row.id); close() }}
                  title={row.title}
                >
                  <span className={css.rowTitle}>{row.title}</span>
                  <span className={css.rowTokens}>↑{formatTokens(row.input)} · ↓{formatTokens(row.output)}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
