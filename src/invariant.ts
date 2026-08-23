/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-token-viewer`.
 * @module @deepseek-ai/dsh-client-ui-token-viewer/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-token-viewer'

/** Cordis companion plugin name. */
export const name = 'client-ui-token-viewer-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: two slot registrations (the composer-dock strip and
 * the sidebar header card) whose disposal is proven by the HMR-safety spec —
 * the plugin owns no store (state arrives on the token-meter projections),
 * emits no cordis events, and holds no cross-plugin mutable state.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
