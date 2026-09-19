// src/index.ts
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import z from "@deepseek-ai/schemastery";
import { z as zWire } from "zod";
var DEFAULT_API_KEY_REF = "DEEPSEEK_API_KEY";
var DEFAULT_BASE_URL = "https://api.deepseek.com";
var BALANCE_NAMESPACE = "dsh-token-viewer";
var BALANCE_SCHEMA = z.object({
  apiKeyRef: z.string().default(DEFAULT_API_KEY_REF),
  baseURL: z.string().default(DEFAULT_BASE_URL)
});
var bucketSchema = zWire.object({
  uncachedInputTokens: zWire.number().int().nonnegative(),
  outputTokens: zWire.number().int().nonnegative(),
  cacheReadTokens: zWire.number().int().nonnegative(),
  cacheWriteTokens: zWire.number().int().nonnegative(),
  requests: zWire.number().int().nonnegative()
}).strict();
var logEntrySchema = zWire.object({
  t: zWire.number(),
  m: zWire.string(),
  i: zWire.number().int().nonnegative(),
  o: zWire.number().int().nonnegative(),
  r: zWire.number().int().nonnegative(),
  w: zWire.number().int().nonnegative()
}).strict();
var modelUsageStateSchema = zWire.object({ byModel: zWire.record(zWire.string(), bucketSchema) }).strict();
var modelUsageWireSchema = modelUsageStateSchema;
var usageLogStateSchema = zWire.object({ entries: zWire.array(logEntrySchema) }).strict();
var usageLogWireSchema = usageLogStateSchema;
function modelUsageApply(state, event) {
  if (event.type !== "assistant/message") return state;
  const usage = event.data.usage;
  if (usage === void 0) return state;
  const model = event.data.message.source?.model;
  if (model === void 0 || model === "") return state;
  const billed = usage.inputTokens + usage.outputTokens + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
  if (billed <= 0) return state;
  const prev = state.byModel[model] ?? {
    uncachedInputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    requests: 0
  };
  return {
    ...state,
    byModel: {
      ...state.byModel,
      [model]: {
        uncachedInputTokens: prev.uncachedInputTokens + usage.inputTokens,
        outputTokens: prev.outputTokens + usage.outputTokens,
        cacheReadTokens: prev.cacheReadTokens + (usage.cacheReadTokens ?? 0),
        cacheWriteTokens: prev.cacheWriteTokens + (usage.cacheWriteTokens ?? 0),
        requests: prev.requests + 1
      }
    }
  };
}
function usageLogApply(state, event) {
  if (event.type !== "assistant/message") return state;
  const usage = event.data.usage;
  if (usage === void 0) return state;
  const model = event.data.message.source?.model;
  if (model === void 0 || model === "") return state;
  const r = usage.cacheReadTokens ?? 0;
  const w = usage.cacheWriteTokens ?? 0;
  if (usage.inputTokens + usage.outputTokens + r + w <= 0) return state;
  return { entries: [...state.entries, { t: event.time, m: model, i: usage.inputTokens, o: usage.outputTokens, r, w }] };
}
function installUsageProjections(ctx) {
  ctx.inject(["sessionProjections"], (projectionCtx) => {
    projectionCtx.sessionProjections.register({
      key: "modelUsage",
      stateSchema: modelUsageStateSchema,
      stateVersion: 1,
      init: () => ({ byModel: {} }),
      apply: modelUsageApply,
      wire: {
        viewSchema: modelUsageWireSchema,
        view: (state) => state
      }
    });
    projectionCtx.sessionProjections.register({
      key: "usageLog",
      stateSchema: usageLogStateSchema,
      stateVersion: 1,
      init: () => ({ entries: [] }),
      apply: usageLogApply,
      wire: {
        viewSchema: usageLogWireSchema,
        view: (state) => state
      }
    });
  });
}
async function handleBalance(req, res, ctx, source) {
  const config = source();
  const resolved = await ctx.credentials.resolve(credentialRef(config.apiKeyRef)).catch(() => void 0);
  const apiKey = (resolved?.value ?? "").trim();
  if (apiKey === "") {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: false,
      error: { code: "no-api-key", message: `${config.apiKeyRef} is not configured in the harness credentials` }
    }));
    return;
  }
  try {
    const response = await fetch(`${config.baseURL}/user/balance`, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        accept: "application/json"
      },
      signal: AbortSignal.timeout(15e3)
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      res.writeHead(response.status, { "content-type": "application/json" });
      res.end(JSON.stringify({
        ok: false,
        error: { code: "provider-error", status: response.status, message: detail.slice(0, 300) }
      }));
      return;
    }
    const data = await response.json();
    const first = Array.isArray(data.balance_infos) ? data.balance_infos[0] : void 0;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: true,
      isAvailable: data.is_available === true,
      currency: first?.currency ?? null,
      totalBalance: first?.total_balance ?? null,
      grantedBalance: first?.granted_balance ?? null,
      toppedUpBalance: first?.topped_up_balance ?? null
    }));
  } catch (error) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({
      ok: false,
      error: { code: "provider-error", message: error instanceof Error ? error.message : String(error) }
    }));
  }
}
function parsePricingPage(html) {
  try {
    const rows = {};
    const modelPatterns = [
      { re: /V4-Flash/i, key: "deepseek-v4-flash", col: 0 },
      { re: /V4-Pro/i, key: "deepseek-v4-pro", col: 1 }
    ];
    for (const pattern of modelPatterns) {
      const idx = html.search(pattern.re);
      if (idx < 0) continue;
      const block = html.slice(idx, idx + 8e3);
      const rowLines = block.split("</tr>");
      const rowNums = (label) => {
        for (const line of rowLines) {
          if (!line.includes(label)) continue;
          const nums = [];
          const re = /([0-9]+(?:\.[0-9]+)?)\s*元/g;
          let m = null;
          while ((m = re.exec(line)) !== null) nums.push(Number(m[1]));
          if (nums.length > 0) return nums;
        }
        return null;
      };
      const hitNums = rowNums("缓存命中");
      const missNums = rowNums("缓存未命中");
      const outNums = rowNums("输出");
      if (hitNums === null || missNums === null || outNums === null) continue;
      const cacheHit = hitNums[pattern.col];
      const cacheMiss = missNums[pattern.col];
      const output = outNums[pattern.col];
      if (cacheHit === void 0 || cacheMiss === void 0 || output === void 0) continue;
      if (cacheHit <= 0 || cacheMiss <= cacheHit || output <= 0 || cacheMiss > 100) continue;
      rows[pattern.key] = {
        offPeak: { inputPerM: cacheMiss, outputPerM: output, cacheReadPerM: cacheHit, cacheWritePerM: cacheMiss },
        peak: {
          inputPerM: cacheMiss * 2,
          outputPerM: output * 2,
          cacheReadPerM: cacheHit * 2,
          cacheWritePerM: cacheMiss * 2
        }
      };
    }
    return Object.keys(rows).length > 0 ? rows : null;
  } catch {
    return null;
  }
}
var PRICING_FALLBACK = {
  "deepseek-v4-flash": {
    offPeak: { inputPerM: 1.5, outputPerM: 4.5, cacheReadPerM: 0.05, cacheWritePerM: 1.5 },
    peak: { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 }
  },
  "deepseek-v4-pro": {
    offPeak: { inputPerM: 4.5, outputPerM: 13.5, cacheReadPerM: 0.15, cacheWritePerM: 4.5 },
    peak: { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 }
  }
};
var PRICING_URL = "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/";
var PRICING_TTL_MS = 15 * 60 * 1e3;
var pricingCache = null;
async function handlePricing(req, res) {
  const send = (source, rows) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, source, rows, fetchedAt: Date.now() }));
  };
  const now = Date.now();
  if (pricingCache !== null && now - pricingCache.at < PRICING_TTL_MS) {
    send(pricingCache.source, pricingCache.rows);
    return;
  }
  try {
    const response = await fetch(PRICING_URL, { signal: AbortSignal.timeout(15e3) });
    if (!response.ok) throw new Error("pricing page http " + response.status);
    const html = await response.text();
    const parsed = parsePricingPage(html);
    if (parsed === null) throw new Error("pricing page shape changed");
    pricingCache = { at: Date.now(), source: "official", rows: parsed };
    send("official", parsed);
  } catch {
    pricingCache = { at: now, source: "builtin", rows: PRICING_FALLBACK };
    send("builtin", PRICING_FALLBACK);
  }
}
function apply(ctx) {
  installUsageProjections(ctx);
  let source = () => ({ apiKeyRef: DEFAULT_API_KEY_REF, baseURL: DEFAULT_BASE_URL });
  ctx.inject(["settings"], (settingsCtx) => {
    const scope = settingsCtx.settings.register(BALANCE_NAMESPACE, BALANCE_SCHEMA);
    source = () => scope.get();
  });
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: "/api/billing/balance",
      handler: (req, res) => handleBalance(req, res, ctx, source)
    }),
    "dsh-token-viewer: balance route"
  );
  ctx.effect(
    () => ctx.webServer.register({
      kind: "exact",
      path: "/api/billing/pricing",
      handler: handlePricing
    }),
    "dsh-token-viewer: pricing route"
  );
}
var name = "dsh-token-viewer-host";
var inject = ["webServer", "credentials", "settings", "sessionProjections"];
export {
  PRICING_FALLBACK,
  apply,
  inject,
  name,
  parsePricingPage
};
