/**
 * Host half of ui-token-viewer: the `GET /api/billing/balance` route reads its
 * configuration from the `dsh-token-viewer` settings namespace and proxies
 * DeepSeek `/user/balance` through the credentials service. Covers the
 * no-key, mapped-ok, settings-config, provider-error passthrough, and
 * network-error paths.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject, name } from '../src/index.ts'

/** Capture the route registered by apply() and run its handler with fakes. */
function bench(over: {
  resolveKey?: () => Promise<{ value: string } | undefined>
  config?: { apiKeyRef: string; baseURL: string }
} = {}) {
  let route: { kind: string; path: string; handler: (req: unknown, res: { writeHead: (s: number) => void; end: (b: string) => void }) => Promise<void> } | undefined
  const balanceConfig = over.config ?? { apiKeyRef: 'DEEPSEEK_API_KEY', baseURL: 'https://api.deepseek.com' }
  const ctx = {
    effect(fn: () => void) { fn() },
    inject(_services: string[], cb: (sctx: { settings: { register: () => { get: () => typeof balanceConfig } }; effect: (fn: () => void) => void }) => void) {
      cb({
        settings: { register: () => ({ get: () => balanceConfig }) },
        effect: (fn: () => void) => fn(),
      })
    },
    config: balanceConfig,
    webServer: { register(r: typeof route) { route = r; return () => {} } },
    credentials: { resolve: () => (over.resolveKey ?? (async () => ({ value: 'sk-test', source: 'credentials.yaml' })))() },
  } as unknown as Context
  apply(ctx)
  if (route === undefined) throw new Error('balance route not registered')
  const fakeRes = () => {
    let status = 0
    let body = ''
    return {
      res: { writeHead(s: number) { status = s }, end(b: string) { body = b } },
      status: () => status,
      body: () => body,
    }
  }
  return {
    route,
    run: async () => {
      const f = fakeRes()
      await route!.handler({}, f.res)
      return { status: f.status(), json: JSON.parse(f.body()) as Record<string, unknown> }
    },
  }
}

describe('dsh-token-viewer host balance route', () => {
  it('declares the webserver, credentials, and settings services', () => {
    expect(name).toBe('dsh-token-viewer-host')
    expect(inject).toContain('webServer')
    expect(inject).toContain('credentials')
    expect(inject).toContain('settings')
  })

  it('answers 503 no-api-key when the credential is unconfigured', async () => {
    const b = bench({ resolveKey: async () => undefined })
    const { status, json } = await b.run()
    expect(status).toBe(503)
    expect(json).toMatchObject({ ok: false, error: { code: 'no-api-key' } })
  })

  it('maps the provider balance response without exposing the key', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: 12.34, granted_balance: 0, topped_up_balance: 12.34 }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const b = bench()
    const { status, json } = await b.run()
    expect(status).toBe(200)
    expect(json).toMatchObject({ ok: true, isAvailable: true, currency: 'CNY', totalBalance: 12.34 })
    const requestUrl = fetchMock.mock.calls[0]?.[0] as string
    expect(requestUrl).toBe('https://api.deepseek.com/user/balance')
    expect(requestUrl).not.toContain('sk-test')
    vi.unstubAllGlobals()
  })

  it('honors the settings namespace configuration', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ is_available: true, balance_infos: [{ currency: 'USD', total_balance: 5, granted_balance: 0, topped_up_balance: 5 }] }),
    }))
    vi.stubGlobal('fetch', fetchMock)
    const b = bench({ config: { apiKeyRef: 'MY_KEY', baseURL: 'https://custom.example.com' } })
    const { status, json } = await b.run()
    expect(status).toBe(200)
    expect(json).toMatchObject({ ok: true, currency: 'USD' })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://custom.example.com/user/balance')
    vi.unstubAllGlobals()
  })

  it('passes through provider HTTP errors with a stable code', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, text: async () => 'unauthorized' })))
    const b = bench()
    const { status, json } = await b.run()
    expect(status).toBe(401)
    expect(json).toMatchObject({ ok: false, error: { code: 'provider-error', status: 401 } })
    vi.unstubAllGlobals()
  })

  it('answers 502 provider-error when the provider call rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom') }))
    const b = bench()
    const { status, json } = await b.run()
    expect(status).toBe(502)
    expect(json).toMatchObject({ ok: false, error: { code: 'provider-error' } })
    vi.unstubAllGlobals()
  })
})
