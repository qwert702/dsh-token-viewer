/**
 * BalanceChip: the compact balance readout in the sidebar foot
 * (`sidebar.footer.action`), beside Settings. It is the always-visible half of
 * the balance surface — the full figures stay in the Token panel and its
 * statistics drawer — so it renders one figure and refreshes on click.
 *
 * The owner share is `{ wide }`: the sidebar renders the wide row while
 * expanded and a 36px icon button in the collapsed rail, so the chip swaps
 * between the amount and a bare currency mark. Its kit is the root standard
 * set (`useSessions` / `useWorkspaces` / `usePanelInfo`), which carries no
 * projection hook — the balance is a fetch through the host proxy, not a
 * session projection, so none is needed.
 */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: pulls ui-sidebar's SlotMap merge (the sidebar.footer.action entry).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { useBalance } from './balance.ts'
import { currencySymbol, formatMoney } from './derive.ts'
import css from './BalanceChip.module.css'

/** Owner share supplied by the sidebar foot. */
export interface BalanceChipOwnerProps {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/** Full props of the balance chip: sidebar owner share + locale. */
export type BalanceChipProps = BalanceChipOwnerProps & PropsLocale<'tokenViewer'>

/**
 * Render the sidebar-foot balance chip.
 * @param props - sidebar column state and the locale seat.
 * @returns the chip element.
 */
export function BalanceChip({ wide, t }: BalanceChipProps) {
  const balance = useBalance()
  const symbol = balance.state.status === 'ok' ? currencySymbol(balance.state.balance.currency) : ''
  const amount = balance.state.status === 'ok' ? formatMoney(balance.state.balance.totalBalance) : null
  const label = balance.state.status === 'error'
    ? `${t('balance')}: ${t('balanceUnavailable')}`
    : `${t('balance')}: ${symbol}${amount ?? '—'}`
  return (
    <button
      type="button"
      className={wide ? css.action : css.rail}
      onClick={balance.refresh}
      title={label}
      aria-label={t('refresh')}
      data-token-viewer-balance
    >
      <span className={css.mark} aria-hidden="true">{symbol === '' ? '¥' : symbol}</span>
      {wide && (
        <span className={balance.state.status === 'error' ? css.amountError : css.amount}>
          {balance.state.status === 'error' ? `—` : amount ?? '…'}
        </span>
      )}
    </button>
  )
}
