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
  const projectionRegistrations: unknown[] = []
  const ctx = {
    effect(fn: () => void) { fn() },
    inject(_services: string[], cb: (sctx: {
      settings: { register: () => { get: () => typeof balanceConfig } }
      sessionProjections: { register: (def: unknown) => void }
      effect: (fn: () => void) => void
    }) => void) {
      cb({
        settings: { register: () => ({ get: () => balanceConfig }) },
        sessionProjections: { register: (def: unknown) => { projectionRegistrations.push(def) } },
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
    projectionRegistrations,
  }
}

describe('dsh-token-viewer host balance route', () => {
  it('declares the webserver, credentials, settings, and sessionProjections services', () => {
    expect(name).toBe('dsh-token-viewer-host')
    expect(inject).toContain('webServer')
    expect(inject).toContain('credentials')
    expect(inject).toContain('settings')
    expect(inject).toContain('sessionProjections')
  })

  it('registers the modelUsage and usageLog projection units', () => {
    const b = bench()
    expect(b.projectionRegistrations).toHaveLength(2)
    const keys = b.projectionRegistrations.map((def) => (def as { key: string }).key)
    expect(keys).toEqual(['modelUsage', 'usageLog'])
    const modelUsage = b.projectionRegistrations[0] as { init: () => unknown }
    const usageLog = b.projectionRegistrations[1] as { init: () => unknown }
    expect(modelUsage.init()).toEqual({ byModel: {} })
    expect(usageLog.init()).toEqual({ entries: [] })
  })

  it('folds assistant usage into per-model buckets', () => {
    const b = bench()
    const def = b.projectionRegistrations[0] as { apply: (s: { byModel: Record<string, unknown> }, e: unknown) => unknown }
    const event = (model: string, usage: unknown) => ({ type: 'assistant/message', data: { message: { source: { model } }, usage } })
    let state = { byModel: {} }
    state = def.apply(state, event('deepseek-v4-flash', { inputTokens: 1000, outputTokens: 2000, cacheReadTokens: 500, cacheWriteTokens: 100 })) as typeof state
    state = def.apply(state, event('deepseek-v4-flash', { inputTokens: 400, outputTokens: 600 })) as typeof state
    state = def.apply(state, event('deepseek-v4-pro', { inputTokens: 10, outputTokens: 20 })) as typeof state
    state = def.apply(state, event('deepseek-v4-pro', undefined)) as typeof state // no usage: ignored
    const unchanged = state
    state = def.apply(state, { type: 'turn/start', data: {} }) as typeof state // uninterested: same ref
    expect(state).toBe(unchanged)
    expect(state.byModel['deepseek-v4-flash']).toEqual({ uncachedInputTokens: 1400, outputTokens: 2600, cacheReadTokens: 500, cacheWriteTokens: 100, requests: 2 })
    expect(state.byModel['deepseek-v4-pro']).toEqual({ uncachedInputTokens: 10, outputTokens: 20, cacheReadTokens: 0, cacheWriteTokens: 0, requests: 1 })
  })

  it('appends one timestamped usageLog entry per reported assistant step', () => {
    const b = bench()
    const def = b.projectionRegistrations[1] as { apply: (s: { entries: unknown[] }, e: unknown) => unknown }
    const event = (time: number, model: string, usage: unknown) => ({ type: 'assistant/message', time, data: { message: { source: { model } }, usage } })
    let state = { entries: [] }
    state = def.apply(state, event(1755000000000, 'deepseek-v4-flash', { inputTokens: 1000, outputTokens: 2000, cacheReadTokens: 500, cacheWriteTokens: 100 })) as typeof state
    state = def.apply(state, event(1755000600000, 'deepseek-v4-flash', { inputTokens: 400, outputTokens: 600 })) as typeof state
    state = def.apply(state, event(1755001200000, 'deepseek-v4-pro', { inputTokens: 10, outputTokens: 20, cacheReadTokens: 5, cacheWriteTokens: 2 })) as typeof state
    state = def.apply(state, event(1755001800000, 'deepseek-v4-pro', undefined)) as typeof state // no usage: ignored
    state = def.apply(state, event(1755002400000, '', { inputTokens: 1, outputTokens: 1 })) as typeof state // no model: ignored
    state = def.apply(state, event(1755003000000, 'deepseek-v4-pro', { inputTokens: 0, outputTokens: 0 })) as typeof state // zero usage: ignored
    const unchanged = state
    state = def.apply(state, { type: 'turn/start', time: 1755003600000, data: {} }) as typeof state // uninterested: same ref
    expect(state).toBe(unchanged)
    expect(state.entries).toEqual([
      { t: 1755000000000, m: 'deepseek-v4-flash', i: 1000, o: 2000, r: 500, w: 100 },
      { t: 1755000600000, m: 'deepseek-v4-flash', i: 400, o: 600, r: 0, w: 0 },
      { t: 1755001200000, m: 'deepseek-v4-pro', i: 10, o: 20, r: 5, w: 2 },
    ])
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
