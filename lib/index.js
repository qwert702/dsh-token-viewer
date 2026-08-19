//#region lib/index.js
/**
* Token viewer plugin, node half. Hosts the DeepSeek account-balance endpoint
* the browser half renders: `GET /api/billing/balance` reads its configuration
* from the harness settings namespace `dsh-token-viewer` (which credential
* reference and provider base URL to use), resolves the API key through the
* credentials service (the harness-managed secret store), and proxies the
* provider's `/user/balance` response without ever exposing the key. The
* browser half ships via exports["./client"], discovered through the
* package.json dsh.client declaration.
*/
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'
import { z as zProjection } from 'zod'

const name = 'dsh-token-viewer-host'
const inject = ['webServer', 'credentials', 'settings', 'sessionProjections']

/** Settings namespace holding the balance proxy configuration. */
const BALANCE_NAMESPACE = settingsNamespace('dsh-token-viewer')
/** Schema: the credential reference resolving to the API key, and the provider base URL. */
const BALANCE_SCHEMA = z.object({
  apiKeyRef: z.string().default('DEEPSEEK_API_KEY'),
  baseURL: z.string().default('https://api.deepseek.com'),
})
/** Composition defaults when the settings namespace is absent. */
const BALANCE_DEFAULTS = { apiKeyRef: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com' }

/**
* Proxy the provider balance endpoint. The response carries only balance
* figures — never the API key. Failures map to stable codes the browser
* half can render without parsing provider wording.
* @param req - incoming request (unused; the route is a bare GET).
* @param res - response the handler fully owns.
* @param ctx - host context carrying the credentials service.
* @param source - settings resolver for the balance proxy configuration.
*/
async function handleBalance(req, res, ctx, source) {
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
    const data = await response.json()
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
      error: { code: 'provider-error', message: String(error instanceof Error ? error.message : error) },
    }))
  }
}

/**
* Fold one committed event into the per-model usage state. Only
* `assistant/message` events with provider usage attribute their buckets to
* the message's model (`message.source.model`) — the same authoritative
* per-step sample token-meter uses.
* @param state - the state covering all prior events.
* @param event - one committed session event.
* @returns the next state (unchanged reference for uninterested events).
*/
function modelUsageApply(state, event) {
  if (event.type !== 'assistant/message') return state
  const usage = event.data.usage
  if (usage === undefined) return state
  const model = event.data.message?.source?.model
  if (model === undefined || model === '') return state
  const total = usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0)
  if (total <= 0) return state
  const prev = state.byModel[model] ?? { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, requests: 0 }
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
* Fold one committed event into the per-request usage log, the CC Switch
* statistics method's data source. Mirrors modelUsage's admission rule
* (assistant steps carrying provider usage and a model) but keeps every
* record separately with its commit timestamp, so the browser half can bucket
* by true request time instead of by session last-activity. Compact field
* names: t commit time (event.time, epoch ms), m model, i fresh input,
* o output, r cache read, w cache write.
* @param state - the state covering all prior events.
* @param event - one committed session event.
* @returns the next state (unchanged reference for uninterested events).
*/
function usageLogApply(state, event) {
  if (event.type !== 'assistant/message') return state
  const usage = event.data.usage
  if (usage === undefined) return state
  const model = event.data.message?.source?.model
  if (model === undefined || model === '') return state
  const r = usage.cacheReadTokens ?? 0
  const w = usage.cacheWriteTokens ?? 0
  if (usage.inputTokens + usage.outputTokens + r + w <= 0) return state
  return { entries: [...state.entries, { t: event.time, m: model, i: usage.inputTokens, o: usage.outputTokens, r, w }] }
}

/**
* Register the modelUsage and usageLog session projections: cumulative
* per-model buckets for the legacy fallback tail, and the per-request usage
* log the detail panel's CC Switch-style statistics aggregate. The projection
* registry is provided by the host.
* @param ctx - host context carrying the sessionProjections service.
*/
function installModelUsageProjection(ctx) {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register({
      key: 'modelUsage',
      schema: zProjection.object({
        byModel: zProjection.record(
          zProjection.object({
            uncachedInputTokens: zProjection.number().int().nonnegative(),
            outputTokens: zProjection.number().int().nonnegative(),
            cacheReadTokens: zProjection.number().int().nonnegative(),
            cacheWriteTokens: zProjection.number().int().nonnegative(),
            requests: zProjection.number().int().nonnegative(),
          }),
        ),
      }),
      init: () => ({ byModel: {} }),
      apply: modelUsageApply,
      view: (state) => state,
      stateVersion: 1,
    })
    projectionCtx.sessionProjections.register({
      key: 'usageLog',
      schema: zProjection.object({
        entries: zProjection.array(zProjection.object({
          t: zProjection.number(),
          m: zProjection.string(),
          i: zProjection.number().int().nonnegative(),
          o: zProjection.number().int().nonnegative(),
          r: zProjection.number().int().nonnegative(),
          w: zProjection.number().int().nonnegative(),
        })),
      }),
      init: () => ({ entries: [] }),
      apply: usageLogApply,
      view: (state) => state,
      stateVersion: 1,
    })
  })
}

/**
* Parse the provider pricing page into the MODEL_PRICING shape: one row per
* model with off-peak (standard) and peak tiers per million tokens. The page
* lists cache-hit / cache-miss / output prices per model; cache writes bill
* at the cache-miss rate, and the peak tier is the off-peak double. Returns
* null when the page is unreachable or its shape changed.
* @param html - the pricing page HTML.
* @returns pricing rows keyed by model id, or null when unparseable.
*/
function parsePricingPage(html) {
  try {
    const rows = {}
    const modelPatterns = [
      { re: /V4-Flash/i, key: 'deepseek-v4-flash' },
      { re: /V4-Pro/i, key: 'deepseek-v4-pro' },
    ]
    for (const pattern of modelPatterns) {
      const idx = html.search(pattern.re)
      if (idx < 0) continue
      const block = html.slice(idx, idx + 8000)
      // each price row reads "类别 | 空闲 | 高峰"; split on </tr> so the
      // row's first "N元" figure is the off-peak price whatever the order
      const rowLines = block.split('</tr>')
      const rowNum = (label) => {
        for (const line of rowLines) {
          if (!line.includes(label)) continue
          const m = line.match(/([0-9]+(?:\.[0-9]+)?)\s*元/)
          return m === null ? null : Number(m[1])
        }
        return null
      }
      const cacheHit = rowNum('缓存命中')
      const cacheMiss = rowNum('缓存未命中')
      const output = rowNum('输出')
      if (cacheHit === null || cacheMiss === null || output === null) continue
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
const PRICING_FALLBACK = {
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

/**
* Serve the provider pricing table: fetched from the official page with a
* 15-minute cache, falling back to the built-in table on any failure. The
* response marks the source so the browser can decide how loudly to trust it.
* @param req - incoming request (unused; a bare GET).
* @param res - response the handler fully owns.
*/
async function handlePricing(req, res) {
  const send = (source, rows) => {
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

/** Module-level pricing cache: { at, source, rows }. */
let pricingCache = null

/**
* Register the settings namespace, the balance route, and the pricing route
* for the browser half.
* @param ctx - host context carrying the webServer, credentials, and settings services.
*/
function apply(ctx) {
  installModelUsageProjection(ctx)
  let source = () => BALANCE_DEFAULTS
  ctx.inject(['settings'], (sctx) => {
    const scope = sctx.settings.register(BALANCE_NAMESPACE, BALANCE_SCHEMA)
    source = () => scope.get()
  })
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
//#endregion
export { apply, inject, name };

