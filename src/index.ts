/**
 * Token viewer plugin, node half. Hosts the DeepSeek account-balance endpoint
 * and the provider pricing table the browser half renders, plus the two
 * session projections (`modelUsage`, `usageLog`) its surfaces fold.
 *
 * `GET /api/billing/balance` reads its configuration from the plugin's
 * `Config` export (the credential reference and provider base URL), applied
 * per profile entry by the loader (`apply(ctx, config)`), resolves the API key
 * through the credentials service (the harness-managed secret store), and
 * proxies the provider's `/user/balance` response without ever exposing the
 * key. `GET /api/billing/pricing` serves the provider's list prices, fetched
 * from the official pricing page with a short TTL and falling back to the
 * built-in table.
 *
 * Config note: the 0.1.7+ settings service (`SettingsForms`) no longer hosts
 * `settings.register()`; the `Config` export is the sanctioned config channel
 * on 0.1.7 and 0.2.0 alike.
 *
 * The browser half ships via exports["./client"], discovered through the
 * package.json dsh.client declaration.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webServer Context merge (ctx.webServer).
import type {} from '@deepseek-ai/dsh-host-webserver'
// Type-only: pulls the credentials Context merge (ctx.credentials).
import type {} from '@deepseek-ai/dsh-credentials'
// Type-only: pulls the sessionProjections Context merge.
import type {} from '@deepseek-ai/dsh-session-projection'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import z from '@deepseek-ai/schemastery'
import { z as zWire } from 'zod'

/** Credential reference holding the DeepSeek API key (adapter default). */
const DEFAULT_API_KEY_REF = 'DEEPSEEK_API_KEY'
/** DeepSeek API base URL (adapter default). */
const DEFAULT_BASE_URL = 'https://api.deepseek.com'

/** Schema: the credential reference resolving to the API key, and the provider base URL. */
const BALANCE_SCHEMA = z.object({
  apiKeyRef: z.string().default(DEFAULT_API_KEY_REF),
  baseURL: z.string().default(DEFAULT_BASE_URL),
})

/**
 * The plugin's config schema, read from the profile entry by the loader and
 * handed to `apply(ctx, config)` (the 0.1.7+/0.2.0 config channel).
 */
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Config = BALANCE_SCHEMA

/** Resolved balance proxy configuration. */
interface BalanceConfig {
  apiKeyRef: string
  baseURL: string
}

/** Per-model usage buckets folded from the session log. */
interface ModelUsageBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  /** Number of assistant steps reported under this model. */
  requests: number
}

/** State of the modelUsage projection: one bucket row per model id. */
interface ModelUsageState {
  byModel: Record<string, ModelUsageBuckets>
}

/**
 * One per-request usage record in the usageLog projection, in CC Switch's
 * request-log shape. Field names are compact because the array grows with
 * every billed assistant step: `t` commit time (event.time, epoch ms), `m`
 * model, `i` fresh (uncached) input, `o` output, `r` cache read, `w` cache
 * write.
 */
export interface UsageLogEntry {
  t: number
  m: string
  i: number
  o: number
  r: number
  w: number
}

/** State of the usageLog projection: one entry per reported assistant step. */
interface UsageLogState {
  entries: UsageLogEntry[]
}

/**
 * Retention cap on the usageLog projection. The fold publishes the whole
 * entries array on every billed step, so an uncapped log makes each publish
 * (and its immutable copy) grow without bound. Beyond the cap the oldest
 * entries drop, newest-first retention: the statistics panel's widest preset
 * covers 30 days, and 10k requests far exceeds any honest window. stateVersion
 * bumps to 2 so persisted projection caches fold again under the cap.
 */
const MAX_USAGE_LOG_ENTRIES = 10_000

declare module '@deepseek-ai/dsh-session-projection' {
  interface SessionProjectionMap {
    /** Per-model consumption buckets (the sidebar's aggregate fallback face). */
    modelUsage: ModelUsageState
    /** Per-request usage records with their own commit times (the statistics face). */
    usageLog: UsageLogState
  }
  interface SessionProjectionStateMap {
    modelUsage: ModelUsageState
    usageLog: UsageLogState
  }
}

/** One model bucket row, shared by the state and wire schemas. */
const bucketSchema = zWire.object({
  uncachedInputTokens: zWire.number().int().nonnegative(),
  outputTokens: zWire.number().int().nonnegative(),
  cacheReadTokens: zWire.number().int().nonnegative(),
  cacheWriteTokens: zWire.number().int().nonnegative(),
  requests: zWire.number().int().nonnegative(),
}).strict()

/** One per-request usage record, shared by the state and wire schemas. */
const logEntrySchema = zWire.object({
  t: zWire.number(),
  m: zWire.string(),
  i: zWire.number().int().nonnegative(),
  o: zWire.number().int().nonnegative(),
  r: zWire.number().int().nonnegative(),
  w: zWire.number().int().nonnegative(),
}).strict()

/** State schema for the modelUsage unit: validated before it seeds a fold. */
const modelUsageStateSchema = zWire.object({ byModel: zWire.record(zWire.string(), bucketSchema) }).strict()
/** Wire view schema for the modelUsage unit (what the browser may read). */
const modelUsageWireSchema = modelUsageStateSchema
/** State schema for the usageLog unit: validated before it seeds a fold. */
const usageLogStateSchema = zWire.object({ entries: zWire.array(logEntrySchema) }).strict()
/** Wire view schema for the usageLog unit (what the browser may read). */
const usageLogWireSchema = usageLogStateSchema

/**
 * Fold one committed event into the per-model usage state. Only
 * `assistant/message` events with provider usage attribute their buckets to
 * the message's model (`message.source.model`) — the same authoritative
 * per-step sample token-meter uses.
 * @param state - the state covering all prior events.
 * @param event - one committed session event.
 * @returns the next state (unchanged reference for uninterested events).
 */
function modelUsageApply(state: ModelUsageState, event: SessionEvent): ModelUsageState {
  if (event.type !== 'assistant/message') return state
  const usage = event.data.usage
  if (usage === undefined) return state
  const model = event.data.message.source?.model
  if (model === undefined || model === '') return state
  const billed = usage.inputTokens + usage.outputTokens
    + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
  if (billed <= 0) return state
  const prev = state.byModel[model] ?? {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    requests: 0,
  }
  return {
    ...state,
    byModel: {
      ...state.byModel,
      [model]: {
        uncachedInputTokens: prev.uncachedInputTokens + usage.inputTokens,
        outputTokens: prev.outputTokens + usage.outputTokens,
        cacheReadTokens: prev.cacheReadTokens + (usage.cacheReadTokens ?? 0),
        cacheWriteTokens: prev.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
        requests: prev.requests + 1,
      },
    },
  }
}

/**
 * Fold one committed event into the per-request usage log. Mirrors
 * modelUsage's admission rule (assistant steps carrying provider usage and a
 * model) but keeps every record separately with its commit timestamp, so the
 * browser half can bucket by true request time — the CC Switch statistics
 * method — instead of by session last-activity.
 * @param state - the state covering all prior events.
 * @param event - one committed session event.
 * @returns the next state (unchanged reference for uninterested events).
 */
function usageLogApply(state: UsageLogState, event: SessionEvent): UsageLogState {
  if (event.type !== 'assistant/message') return state
  const usage = event.data.usage
  if (usage === undefined) return state
  const model = event.data.message.source?.model
  if (model === undefined || model === '') return state
  const r = usage.cacheReadTokens ?? 0
  const w = usage.cacheWriteTokens ?? 0
  if (usage.inputTokens + usage.outputTokens + r + w <= 0) return state
  const entries = [...state.entries, { t: event.time, m: model, i: usage.inputTokens, o: usage.outputTokens, r, w }]
  return { entries: entries.length > MAX_USAGE_LOG_ENTRIES ? entries.slice(entries.length - MAX_USAGE_LOG_ENTRIES) : entries }
}

/**
 * Register the modelUsage and usageLog session projections. Both declare a
 * `wire` view, which is what makes them readable as `projectionValues` in the
 * browser — a unit without one stays host-only. Each view returns the state
 * object itself, so the registry's `Object.is` gate publishes nothing when a
 * fold produced no new reference.
 * @param ctx - host context carrying the sessionProjections service.
 */
function installUsageProjections(ctx: Context): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register({
      key: 'modelUsage',
      stateSchema: modelUsageStateSchema,
      stateVersion: 1,
      init: (): ModelUsageState => ({ byModel: {} }),
      apply: modelUsageApply,
      wire: {
        viewSchema: modelUsageWireSchema,
        view: (state: ModelUsageState): ModelUsageState => state,
      },
    })
    projectionCtx.sessionProjections.register({
      key: 'usageLog',
      stateSchema: usageLogStateSchema,
      stateVersion: 2,
      init: (): UsageLogState => ({ entries: [] }),
      apply: usageLogApply,
      wire: {
        viewSchema: usageLogWireSchema,
        view: (state: UsageLogState): UsageLogState => state,
      },
    })
  })
}

/**
 * Proxy the provider balance endpoint. The response carries only balance
 * figures — never the API key. Failures map to stable codes the browser
 * half can render without parsing provider wording.
 * @param req - incoming request (unused; the route is a bare GET).
 * @param res - response the handler fully owns.
 * @param ctx - host context carrying the credentials service.
 * @param source - settings resolver for the balance proxy configuration.
 */
async function handleBalance(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: Context,
  source: () => BalanceConfig,
): Promise<void> {
  const config = source()
  const resolved = await ctx.credentials.resolve(credentialRef(config.apiKeyRef)).catch(() => undefined)
  const apiKey = (resolved?.value ?? '').trim()
  if (apiKey === '') {
    res.writeHead(503, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: false,
      error: { code: 'no-api-key', message: `${config.apiKeyRef} is not configured in the harness credentials` },
    }))
    return
  }
  try {
    const response = await fetch(`${config.baseURL}/user/balance`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      res.writeHead(response.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        ok: false,
        error: { code: 'provider-error', status: response.status, message: detail.slice(0, 300) },
      }))
      return
    }
    const data = await response.json() as {
      is_available?: boolean
      balance_infos?: Array<{ currency?: string; total_balance?: number; granted_balance?: number; topped_up_balance?: number }>
    }
    const first = Array.isArray(data.balance_infos) ? data.balance_infos[0] : undefined
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      isAvailable: data.is_available === true,
      currency: first?.currency ?? null,
      totalBalance: first?.total_balance ?? null,
      grantedBalance: first?.granted_balance ?? null,
      toppedUpBalance: first?.topped_up_balance ?? null,
    }))
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json' })
    res.end(JSON.stringify({
      ok: false,
      error: { code: 'provider-error', message: error instanceof Error ? error.message : String(error) },
    }))
  }
}

/** One model's price tier, CNY per million tokens. */
export interface ModelPrice {
  inputPerM: number
  outputPerM: number
  cacheReadPerM: number
  cacheWritePerM: number
}

/** One model's off-peak and peak price rows. */
export interface ModelPricing {
  offPeak: ModelPrice
  peak: ModelPrice
}

/** Parsed pricing table keyed by canonical model id. */
export type PricingTable = Record<string, ModelPricing>

/**
 * Parse the provider pricing page into the pricing-table shape: one row per
 * model with off-peak (standard) and peak tiers per million tokens. The page
 * lists cache-hit / cache-miss / output prices per model; cache writes bill
 * at the cache-miss rate, and the peak tier is the off-peak double. Returns
 * null when the page is unreachable or its shape changed.
 * @param html - the pricing page HTML.
 * @returns pricing rows keyed by model id, or null when unparseable.
 */
export function parsePricingPage(html: string): PricingTable | null {
  try {
    const rows: PricingTable = {}
    const modelPatterns = [
      { re: /V4-Flash/i, key: 'deepseek-v4-flash', col: 0 },
      { re: /V4-Pro/i, key: 'deepseek-v4-pro', col: 1 },
    ]
    for (const pattern of modelPatterns) {
      const idx = html.search(pattern.re)
      if (idx < 0) continue
      // wide enough to cover both models' side-by-side columns and the
      // long-context rows below them; a narrow window truncates the pro column
      const block = html.slice(idx, idx + 24000)
      // the price table lists models side by side: each row carries one
      // "N元" figure per model (flash first, then pro). Collect every row's
      // figures and pick the model's column.
      const rowLines = block.split('</tr>')
      const rowNums = (label: string): number[] | null => {
        for (const line of rowLines) {
          if (!line.includes(label)) continue
          const nums: number[] = []
          const re = /([0-9]+(?:\.[0-9]+)?)\s*元/g
          let m: RegExpExecArray | null = null
          while ((m = re.exec(line)) !== null) nums.push(Number(m[1]))
          if (nums.length > 0) return nums
        }
        return null
      }
      const hitNums = rowNums('缓存命中')
      const missNums = rowNums('缓存未命中')
      const outNums = rowNums('输出')
      if (hitNums === null || missNums === null || outNums === null) continue
      const cacheHit = hitNums[pattern.col]
      const cacheMiss = missNums[pattern.col]
      const output = outNums[pattern.col]
      if (cacheHit === undefined || cacheMiss === undefined || output === undefined) continue
      if (cacheHit <= 0 || cacheMiss <= cacheHit || output <= 0 || cacheMiss > 100) continue
      rows[pattern.key] = {
        offPeak: { inputPerM: cacheMiss, outputPerM: output, cacheReadPerM: cacheHit, cacheWritePerM: cacheMiss },
        peak: {
          inputPerM: cacheMiss * 2,
          outputPerM: output * 2,
          cacheReadPerM: cacheHit * 2,
          cacheWritePerM: cacheMiss * 2,
        },
      }
    }
    return Object.keys(rows).length > 0 ? rows : null
  } catch {
    return null
  }
}

/** Built-in fallback pricing (provider list prices, CNY per 1M tokens). */
export const PRICING_FALLBACK: PricingTable = {
  'deepseek-v4-flash': {
    offPeak: { inputPerM: 1.5, outputPerM: 4.5, cacheReadPerM: 0.05, cacheWritePerM: 1.5 },
    peak: { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 },
  },
  'deepseek-v4-pro': {
    offPeak: { inputPerM: 4.5, outputPerM: 13.5, cacheReadPerM: 0.15, cacheWritePerM: 4.5 },
    peak: { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 },
  },
}

/** URL of the provider's pricing page. */
const PRICING_URL = 'https://api-docs.deepseek.com/zh-cn/quick_start/pricing/'

/** Time-to-live of the fetched pricing table. */
const PRICING_TTL_MS = 15 * 60 * 1000

/** Module-level pricing cache: null until the first request resolves it. */
let pricingCache: { at: number; source: 'official' | 'builtin'; rows: PricingTable } | null = null

/**
 * Serve the provider pricing table: fetched from the official page with a
 * 15-minute cache, falling back to the built-in table on any failure. The
 * response marks the source so the browser can decide how loudly to trust it.
 * @param req - incoming request (unused; a bare GET).
 * @param res - response the handler fully owns.
 */
async function handlePricing(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const send = (source: 'official' | 'builtin', rows: PricingTable): void => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, source, rows, fetchedAt: Date.now() }))
  }
  const now = Date.now()
  if (pricingCache !== null && now - pricingCache.at < PRICING_TTL_MS) {
    send(pricingCache.source, pricingCache.rows)
    return
  }
  try {
    const response = await fetch(PRICING_URL, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) throw new Error('pricing page http ' + response.status)
    const html = await response.text()
    const parsed = parsePricingPage(html)
    if (parsed === null) throw new Error('pricing page shape changed')
    pricingCache = { at: Date.now(), source: 'official', rows: parsed }
    send('official', parsed)
  } catch {
    pricingCache = { at: now, source: 'builtin', rows: PRICING_FALLBACK }
    send('builtin', PRICING_FALLBACK)
  }
}

/**
 * Register the usage projections, and the balance and pricing routes for the
 * browser half. The balance route reads the loader-applied entry config
 * (`apiKeyRef`, `baseURL`), falling back to the adapter defaults when the
 * entry carries no config.
 * @param ctx - host context carrying the webServer, credentials, and sessionProjections services.
 * @param config - the profile entry's validated config (absent when mounted bare).
 */
export function apply(ctx: Context, config?: Partial<BalanceConfig>): void {
  installUsageProjections(ctx)
  const resolved: BalanceConfig = {
    apiKeyRef: config?.apiKeyRef ?? DEFAULT_API_KEY_REF,
    baseURL: config?.baseURL ?? DEFAULT_BASE_URL,
  }
  const source = (): BalanceConfig => resolved
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: '/api/billing/balance',
      handler: (req, res) => handleBalance(req, res, ctx, source),
    }),
    'dsh-token-viewer: balance route',
  )
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: '/api/billing/pricing',
      handler: handlePricing,
    }),
    'dsh-token-viewer: pricing route',
  )
}

/** Cordis plugin name for the host half. */
export const name = 'dsh-token-viewer-host'
/** Services required by the balance route and the usage projections. */
export const inject = ['webServer', 'credentials', 'sessionProjections']
