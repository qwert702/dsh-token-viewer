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
/** Services required by the balance route and its settings namespace. */
export const inject = ['webServer', 'credentials', 'settings']

/** Resolved balance proxy configuration. */
interface BalanceConfig {
  apiKeyRef: string
  baseURL: string
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
