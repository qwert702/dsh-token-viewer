/**
 * Balance fetch state for the sidebar card. The browser never sees the API
 * key: the host route /api/billing/balance resolves it server-side and maps
 * the provider response to this stable view.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { setPricingTable, type ModelPricing } from './derive.ts'

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

/** Host route serving the provider pricing table (official page or builtin rows). */
const PRICING_URL = '/api/billing/pricing'

/** Time-to-live of the fetched pricing table, matching the host's own cache. */
const PRICING_TTL_MS = 15 * 60 * 1000

/** Module-level pricing cache, shared by every surface that bills. */
let pricingCache: { at: number; rows: Record<string, ModelPricing> } | null = null
/** In-flight pricing fetch, so concurrent surfaces share one request. */
let pricingInFlight: Promise<Record<string, ModelPricing> | null> | null = null

/**
 * Fetch the provider pricing table from the host route, with a module-level
 * TTL cache. Any failure resolves null and leaves the built-in fallback table
 * active — the route only ever sharpens the estimate, never zeroes it.
 * @returns pricing rows keyed by model id, or null when unavailable.
 */
export function fetchPricingTable(): Promise<Record<string, ModelPricing> | null> {
  if (pricingCache !== null && Date.now() - pricingCache.at < PRICING_TTL_MS) return Promise.resolve(pricingCache.rows)
  if (pricingInFlight !== null) return pricingInFlight
  pricingInFlight = (async () => {
    try {
      const response = await fetch(PRICING_URL)
      const body = await response.json().catch(() => null) as { ok?: boolean; rows?: Record<string, ModelPricing> } | null
      if (body === null || body.ok !== true || body.rows === null || typeof body.rows !== 'object') return null
      pricingCache = { at: Date.now(), rows: body.rows }
      return body.rows
    } catch {
      return null
    } finally {
      pricingInFlight = null
    }
  })()
  return pricingInFlight
}

/**
 * Subscribe the calling surface to the pricing table: fetches it once (shared
 * TTL cache) and installs it as the active billing table. Returns the rows so
 * the caller can key its cost memos on them; null means the built-in fallback
 * is still active.
 * @returns the fetched rows, or null until one lands.
 */
export function usePricingTable(): Record<string, ModelPricing> | null {
  const [rows, setRows] = useState<Record<string, ModelPricing> | null>(pricingCache?.rows ?? null)
  useEffect(() => {
    let alive = true
    void fetchPricingTable().then((fetched) => {
      if (!alive || fetched === null) return
      setPricingTable(fetched)
      setRows(fetched)
    })
    return () => { alive = false }
  }, [])
  return rows
}

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
