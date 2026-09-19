/**
 * Shared open/close state for the token-usage detail drawer. The drawer is an
 * entry of `shell.overlay` (root scope) while the button that opens it lives
 * on the `main` panel page, so the two cannot share React state through a
 * common owner: this module is that common owner.
 *
 * It is deliberately dependency-free. The 0.1.6 standard kit does not hand a
 * `useStore` hook to either of those slots (`main` and `shell.overlay` receive
 * `useSessions` / `useWorkspaces` / `usePanelInfo` only), so the store is a
 * plain module singleton read through React's own `useSyncExternalStore`.
 * Nothing here touches the harness, which keeps the shared handle working
 * across harness releases.
 */
import { useSyncExternalStore } from 'react'

/** The drawer's observable state. */
export interface TokenDetailState {
  /** Whether the usage-statistics drawer is showing. */
  readonly open: boolean
}

/** Frozen snapshots, so `useSyncExternalStore` sees a stable reference. */
const OPEN: TokenDetailState = { open: true }
const CLOSED: TokenDetailState = { open: false }

/** The shared handle: read the snapshot, subscribe, and set the flag. */
export interface TokenDetailStore {
  /** @returns the current state (reference-stable until it changes). */
  getSnapshot(): TokenDetailState
  /**
   * @param listener - called on every state change.
   * @returns the unsubscribe function.
   */
  subscribe(listener: () => void): () => void
  /** Show or hide the drawer. */
  setOpen(open: boolean): void
}

/**
 * Create one detail-drawer store handle.
 * @returns the store handle.
 */
export function createTokenDetailStore(): TokenDetailStore {
  let state: TokenDetailState = CLOSED
  const listeners = new Set<() => void>()
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    setOpen: (open) => {
      if (state.open === open) return
      state = open ? OPEN : CLOSED
      for (const listener of [...listeners]) listener()
    },
  }
}

/** The one handle shared by the panel button and the overlay drawer. */
export const tokenDetailStore: TokenDetailStore = createTokenDetailStore()

/**
 * Subscribe to the drawer's open flag.
 * @returns whether the drawer is showing.
 */
export function useTokenDetailOpen(): boolean {
  return useSyncExternalStore(
    tokenDetailStore.subscribe,
    () => tokenDetailStore.getSnapshot().open,
    () => tokenDetailStore.getSnapshot().open,
  )
}
