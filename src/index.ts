/**
 * Token viewer plugin, node half. Hosts the DeepSeek account-balance endpoint
 * the browser half renders: `GET /api/billing/balance` reads its configuration
 * from the harness settings namespace `dsh-token-viewer` (which credential
 * reference and provider base URL to use), resolves the API key through the
 * credentials service (the same secret store the LLM adapter uses), and
 * proxies the provider's `/user/balance` response without ever exposing the
 * key. The browser half ships via exports["./client"], discovered through the
 * package.json dsh.client declaration.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the webServer Context merge (ctx.webServer).
import type {} from '@deepseek-ai/dsh-host-webserver'
// Type-only: pulls the credentials Context merge (ctx.credentials).
import type {} from '@deepseek-ai/dsh-credentials'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import z from '@deepseek-ai/schemastery'

/** Credential reference holding the DeepSeek API key (adapter default). */
const DEFAULT_API_KEY_REF = 'DEEPSEEK_API_KEY'
/** DeepSeek API base URL (adapter default). */
const DEFAULT_BASE_URL = 'https://api.deepseek.com'

/** Settings namespace holding the balance proxy configuration. */
const BALANCE_NAMESPACE = settingsNamespace('dsh-token-viewer')
/** Schema: the credential reference resolving to the API key, and the provider base URL. */
const BALANCE_SCHEMA = z.object({
  apiKeyRef: z.string().default(DEFAULT_API_KEY_REF),
  baseURL: z.string().default(DEFAULT_BASE_URL),
})

/** Composition-layer defaults for the balance proxy (below the user settings layer). */
export const Config = z.object({
  apiKeyRef: z.string().default(DEFAULT_API_KEY_REF),
  baseURL: z.string().default(DEFAULT_BASE_URL),
})

/** Cordis plugin name for the host half. */
export const name = 'dsh-token-viewer-host'
/** Services required by the balance route, its settings namespace, and the model-usage projection. */
export const inject = ['webServer', 'credentials', 'settings', 'sessionProjections']

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

/** Zero bucket for a model that has not reported yet. */
const zeroModelUsage = (): ModelUsageBuckets => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  requests: 0,
})

/** Wire schema for the modelUsage projection value. */
const modelUsageSchema = z.object({
  byModel: z.record(z.string(), z.object({
    uncachedInputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    cacheReadTokens: z.number().int().nonnegative(),
    cacheWriteTokens: z.number().int().nonnegative(),
    requests: z.number().int().nonnegative(),
  })),
})

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

/** Wire schema for the usageLog projection value. */
const usageLogSchema = z.object({
  entries: z.array(z.object({
    t: z.number(),
    m: z.string(),
    i: z.number().int().nonnegative(),
    o: z.number().int().nonnegative(),
    r: z.number().int().nonnegative(),
    w: z.number().int().nonnegative(),
  })),
})

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
  return {
    entries: [...state.entries, { t: event.time, m: model, i: usage.inputTokens, o: usage.outputTokens, r, w }],
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
function modelUsageApply(state: ModelUsageState, event: SessionEvent): ModelUsageState {
  if (event.type !== 'assistant/message') return state
  const usage = event.data.usage
  if (usage === undefined) return state
  const model = event.data.message.source?.model
  if (model === undefined || model === '') return state
  const input = usage.inputTokens + (usage.cacheWriteTokens ?? 0)
  if (input + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0) <= 0) return state
  const prev = state.byModel[model] ?? zeroModelUsage()
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
 * Register the modelUsage and usageLog session projections: cumulative
 * per-model consumption for the sidebar's fallback row, and the per-request
 * usage log the detail panel's CC Switch-style statistics aggregate. The
 * projection registry is provided by the host.
 * @param ctx - host context carrying the sessionProjections service.
 */
function installModelUsageProjection(ctx: Context): void {
  ctx.inject(['sessionProjections'], (projectionCtx) => {
    projectionCtx.sessionProjections.register({
      key: 'modelUsage',
      schema: modelUsageSchema,
      init: (): ModelUsageState => ({ byModel: {} }),
      apply: modelUsageApply,
      view: (state: ModelUsageState): ModelUsageState => state,
      stateVersion: 1,
    })
    projectionCtx.sessionProjections.register({
      key: 'usageLog',
      schema: usageLogSchema,
      init: (): UsageLogState => ({ entries: [] }),
      apply: usageLogApply,
      view: (state: UsageLogState): UsageLogState => state,
      stateVersion: 1,
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

/**
 * Register the settings namespace and the balance route for the browser half.
 * @param ctx - host context carrying the webServer, credentials, and settings services.
 */
export function apply(ctx: Context): void {
  installModelUsageProjection(ctx)
  let source: () => BalanceConfig = () => ({ apiKeyRef: DEFAULT_API_KEY_REF, baseURL: DEFAULT_BASE_URL })
  installSettingsSection(ctx, BALANCE_NAMESPACE, BALANCE_SCHEMA, ctx.config, {
    setSource: (current) => { source = current },
    onChange: () => {},
  })
  ctx.effect(
    () => ctx.webServer.register({
      kind: 'exact',
      path: '/api/billing/balance',
      handler: (req, res) => handleBalance(req, res, ctx, source),
    }),
    'dsh-token-viewer: balance route',
  )
}
