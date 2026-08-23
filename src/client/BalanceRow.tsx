/**
 * BalanceRow: the account-balance seat in the sidebar card's title row — the
 * currency figure with a refresh control, or an error-retry control when the
 * host proxy reported a failure. Loading renders nothing (the card still
 * shows usage while it resolves).
 */
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { BalanceState } from './balance.ts'
import { currencySymbol, formatMoney } from './derive.ts'
import type { TokenKey } from './locales.ts'
import css from './BalanceRow.module.css'

/** Full props of the balance row: fetch state, refresh verb, and locale seat. */
export type BalanceRowProps = {
  balance: BalanceState
  onRefresh: () => void
} & PropsLocale<'tokenViewer'>

/**
 * Render the balance row.
 * @param props - balance fetch state, refresh verb, and locale seat.
 * @returns the balance row element, or null while loading.
 */
export function BalanceRow({ balance, onRefresh, t }: BalanceRowProps) {
  if (balance.status === 'ok' && balance.balance !== null) {
    return (
      <span
        className={css.balance}
        title={`${t('balance')}: ${currencySymbol(balance.balance.currency)}${formatMoney(balance.balance.totalBalance)}`}
      >
        {currencySymbol(balance.balance.currency)}{formatMoney(balance.balance.totalBalance)}
        <button type="button" className={css.refresh} onClick={onRefresh} aria-label={t('refresh')}>⟳</button>
      </span>
    )
  }
  if (balance.status === 'error') {
    return (
      <button type="button" className={css.balanceError} onClick={onRefresh} title={balance.error}>
        {t('balanceUnavailable')} ⟳
      </button>
    )
  }
  return null
}

export type { TokenKey }
