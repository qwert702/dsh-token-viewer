/**
 * Balance fetch state for the sidebar card. The browser never sees the API
 * key: the host route /api/billing/balance resolves it server-side and maps
 * the provider response to this stable view.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Projected balance figure returned by the host proxy. */
export interface BalanceView {
  ok: true
  isAvailable: boolean
  currency: string | null
  totalBalance: number | null
  grantedBalance: number | null
  toppedUpBalance: number | null
}

/** Fetch state machine for the balance row. */
export type BalanceState =
  | { status: 'loading' }
  | { status: 'ok'; balance: BalanceView }
  | { status: 'error'; error: string }

/** Host route serving the proxied DeepSeek balance. */
const BALANCE_URL = '/api/billing/balance'

/**
 * One-shot balance fetch with a refresh verb. Component-internal hook:
 * subscribes to nothing external; the host route is the data source.
 * @returns the fetch state machine plus the refresh callback.
 */
export function useBalance(): { state: BalanceState; refresh: () => void } {
  const [state, setState] = useState<BalanceState>({ status: 'loading' })
  const inFlight = useRef(false)
  const load = useCallback(() => {
    if (inFlight.current) return
    inFlight.current = true
    setState({ status: 'loading' })
    fetch(BALANCE_URL)
      .then(async (response) => {
        const body = await response.json().catch(() => null)
        if (response.ok && body !== null && body.ok === true) {
          setState({ status: 'ok', balance: body as BalanceView })
        } else {
          const error = body === null || body.error === undefined ? 'provider-error' : body.error.code as string
          setState({ status: 'error', error })
        }
      })
      .catch(() => { setState({ status: 'error', error: 'network' }) })
      .finally(() => { inFlight.current = false })
  }, [])
  useEffect(() => { load() }, [load])
  return { state, refresh: load }
}
