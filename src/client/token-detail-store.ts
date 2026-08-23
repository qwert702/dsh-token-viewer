/**
 * Shared open/close state for the token-usage detail panel. Declared once in
 * apply() and passed to both the sidebar card (opens it) and the
 * shell.overlay panel (renders while open), so the two entries share one
 * handle without module-level state.
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client'

/** Token-usage detail panel store factory (declared store, shared handle). */
export function createTokenDetailStore() {
  return defineStore({
    init: () => ({ open: false }),
    actions: {
      /** Open or close the detail panel. */
      setOpen: (d: { open: boolean }, open: boolean) => { d.open = open },
    },
  })
}

/** The detail panel's store handle (type-only consumer face). */
export type TokenDetailStore = ReturnType<typeof createTokenDetailStore>
