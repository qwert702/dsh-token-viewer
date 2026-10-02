window.__ModuleLoader__.load({
	id: "dsh-token-viewer",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/SidebarTokenPanel.tsx
var import_react3 = require("react");

// src/client/balance.ts
var import_react = require("react");

// src/client/derive.ts
function formatTokens(n) {
  const scaled = (v) => v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
  if (n < 1e3) return String(n);
  if (n < 1e6) return `${scaled(n / 1e3)}K`;
  return `${scaled(n / 1e6)}M`;
}
function billedInputTokens(usage) {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
}
function cacheHitPercent(usage) {
  const input = billedInputTokens(usage);
  return input === 0 ? null : Math.round(usage.cacheReadTokens / input * 100);
}
function contextOccupancy(pressure) {
  if (pressure === void 0 || pressure === null) return null;
  const usedTokens = pressure.projectedTokens ?? pressure.pressureTokens;
  if (usedTokens === void 0 || pressure.contextWindow === void 0) return null;
  return {
    percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow
  };
}
function deriveTokenView(usage, pressure, breakdown) {
  if (usage === void 0 || usage === null) return null;
  const input = billedInputTokens(usage);
  if (input <= 0 && usage.outputTokens <= 0) return null;
  return {
    input,
    uncached: usage.uncachedInputTokens,
    cacheRead: usage.cacheReadTokens,
    cacheWrite: usage.cacheWriteTokens,
    output: usage.outputTokens,
    cacheHit: cacheHitPercent(usage),
    occupancy: contextOccupancy(pressure),
    breakdown
  };
}
function deriveSidebarTotals(byId, sinceMs = 0) {
  let uncached = 0;
  let cacheRead = 0;
  let cacheWrite = 0;
  let output = 0;
  let sessions = 0;
  for (const key of Object.keys(byId)) {
    const summary = byId[key];
    if (summary === void 0) continue;
    if (sinceMs > 0 && summary.updatedAt < sinceMs) continue;
    const usage = summary.projectionValues?.tokenUsage;
    if (usage === void 0 || usage === null) continue;
    uncached += usage.uncachedInputTokens;
    cacheRead += usage.cacheReadTokens;
    cacheWrite += usage.cacheWriteTokens;
    output += usage.outputTokens;
    sessions += 1;
  }
  return { uncached, cacheRead, cacheWrite, output, sessions };
}
function derivePerSession(byId, sinceMs = 0) {
  const rows = [];
  for (const key of Object.keys(byId)) {
    const summary = byId[key];
    if (summary === void 0) continue;
    if (sinceMs > 0 && summary.updatedAt < sinceMs) continue;
    const usage = summary.projectionValues?.tokenUsage;
    if (usage === void 0 || usage === null) continue;
    const input = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
    const output = usage.outputTokens;
    if (input <= 0 && output <= 0) continue;
    rows.push({
      id: summary.id,
      title: summary.displayTitle,
      input,
      output,
      cacheRead: usage.cacheReadTokens,
      total: input + output,
      cost: estimateCost(usage),
      updatedAt: summary.updatedAt
    });
  }
  rows.sort((a, b) => b.total - a.total);
  return rows;
}
var MODEL_PRICING_FALLBACK = {
  "deepseek-v4-flash": {
    offPeak: { inputPerM: 1.5, outputPerM: 4.5, cacheReadPerM: 0.05, cacheWritePerM: 1.5 },
    peak: { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 }
  },
  "deepseek-v4-pro": {
    offPeak: { inputPerM: 4.5, outputPerM: 13.5, cacheReadPerM: 0.15, cacheWritePerM: 4.5 },
    peak: { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 }
  }
};
var FLASH_OFF_PEAK = MODEL_PRICING_FALLBACK["deepseek-v4-flash"].offPeak;
var DEFAULT_TOKEN_PRICES = FLASH_OFF_PEAK;
var pricingTable = MODEL_PRICING_FALLBACK;
function setPricingTable(rows) {
  if (rows === null || rows === void 0 || typeof rows !== "object") return;
  const valid = Object.entries(rows).filter(([, row]) => {
    return row !== null && typeof row === "object" && isFinitePrice(row.offPeak) && isFinitePrice(row.peak);
  });
  if (valid.length === 0) return;
  pricingTable = Object.fromEntries(valid);
}
function isFinitePrice(p) {
  return p !== null && typeof p === "object" && [p.inputPerM, p.outputPerM, p.cacheReadPerM, p.cacheWritePerM].every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0);
}
var PEAK_WINDOWS_BJT = [
  [9 * 3600 * 1e3, 12 * 3600 * 1e3],
  [14 * 3600 * 1e3, 18 * 3600 * 1e3]
];
function isPeakHour(t) {
  const bjt = ((t + 8 * 3600 * 1e3) % 864e5 + 864e5) % 864e5;
  return PEAK_WINDOWS_BJT.some(([start, end]) => bjt >= start && bjt < end);
}
function pricesForModel(model, t) {
  const id = model.toLowerCase();
  let best = null;
  for (const key of Object.keys(pricingTable)) {
    if (id.startsWith(key.toLowerCase()) && (best === null || key.length > best.length)) best = key;
  }
  if (best === null) return FLASH_OFF_PEAK;
  return isPeakHour(t) ? pricingTable[best].peak : pricingTable[best].offPeak;
}
function estimateRequestCost(usage, model, t) {
  return estimateCost(usage, pricesForModel(model, t));
}
function estimateCost(usage, prices = DEFAULT_TOKEN_PRICES) {
  return usage.uncachedInputTokens / 1e6 * prices.inputPerM + usage.outputTokens / 1e6 * prices.outputPerM + usage.cacheReadTokens / 1e6 * prices.cacheReadPerM + usage.cacheWriteTokens / 1e6 * prices.cacheWritePerM;
}
var DAY_MS = 24 * 60 * 60 * 1e3;
function resolveUsageRange(range, nowMs = Date.now()) {
  const midnight = (ms) => {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  if (range === "today") return { startDate: midnight(nowMs), endDate: nowMs };
  if (range !== "all") {
    const days = range === "7d" ? 7 : range === "14d" ? 14 : 30;
    return { startDate: midnight(nowMs - (days - 1) * DAY_MS), endDate: nowMs };
  }
  return { startDate: 0, endDate: nowMs };
}
function collectRequestRecords(byId, range, nowMs = Date.now()) {
  const { startDate, endDate } = resolveUsageRange(range, nowMs);
  const inRange = (t) => t >= startDate && t <= endDate;
  const summaries = [];
  for (const key of Object.keys(byId)) {
    const summary = byId[key];
    if (summary !== void 0) summaries.push(summary);
  }
  const records = [];
  const push = (summary, entry) => {
    records.push({
      sessionId: summary.id,
      sessionTitle: summary.displayTitle,
      model: entry.m,
      t: entry.t,
      i: entry.i,
      o: entry.o,
      r: entry.r,
      w: entry.w,
      cost: estimateRequestCost(
        { uncachedInputTokens: entry.i, outputTokens: entry.o, cacheReadTokens: entry.r, cacheWriteTokens: entry.w },
        entry.m,
        entry.t
      )
    });
  };
  const logged = summaries.some((summary) => (summary.projectionValues?.usageLog?.entries?.length ?? 0) > 0);
  if (logged) {
    for (const summary of summaries) {
      for (const entry of summary.projectionValues?.usageLog?.entries ?? []) {
        if (inRange(entry.t)) push(summary, entry);
      }
    }
    return records;
  }
  for (const summary of summaries) {
    const usage = summary.projectionValues?.tokenUsage;
    if (usage === void 0 || usage === null) continue;
    if (usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens <= 0) continue;
    const models = Object.keys(summary.projectionValues?.modelUsage?.byModel ?? {});
    const entry = {
      t: summary.updatedAt,
      m: models.length === 1 ? models[0] : "",
      i: usage.uncachedInputTokens,
      o: usage.outputTokens,
      r: usage.cacheReadTokens,
      w: usage.cacheWriteTokens
    };
    if (inRange(entry.t)) push(summary, entry);
  }
  return records;
}
function usageSummary(records) {
  let requests = 0;
  let cost = 0;
  let input = 0;
  let output = 0;
  let cacheWrite = 0;
  let cacheRead = 0;
  for (const record of records) {
    requests += 1;
    cost += record.cost;
    input += record.i;
    output += record.o;
    cacheWrite += record.w;
    cacheRead += record.r;
  }
  const cacheable = input + cacheWrite + cacheRead;
  return {
    requests,
    cost,
    input,
    output,
    cacheWrite,
    cacheRead,
    realTotal: input + output + cacheWrite + cacheRead,
    cacheHitRate: cacheable > 0 ? cacheRead / cacheable : 0
  };
}
function usageTrend(records, range, nowMs = Date.now()) {
  const { startDate, endDate } = resolveUsageRange(range, nowMs);
  const bucketMs = range === "today" ? 60 * 60 * 1e3 : DAY_MS;
  const bucketCount = range === "today" ? Math.max(1, Math.ceil((endDate - startDate) / bucketMs)) : Math.floor((endDate - startDate) / DAY_MS) + 1;
  const buckets = [];
  for (let index = 0; index < bucketCount; index += 1) {
    const t = startDate + index * bucketMs;
    const d = new Date(t);
    buckets.push({
      t,
      label: range === "today" ? `${String(d.getHours()).padStart(2, "0")}:00` : `${d.getMonth() + 1}/${d.getDate()}`,
      requests: 0,
      cost: 0,
      input: 0,
      output: 0,
      cacheWrite: 0,
      cacheRead: 0,
      total: 0
    });
  }
  for (const record of records) {
    if (record.t < startDate || record.t > endDate) continue;
    const index = Math.min(bucketCount - 1, Math.floor((record.t - startDate) / bucketMs));
    const bucket = buckets[index];
    bucket.requests += 1;
    bucket.cost += record.cost;
    bucket.input += record.i;
    bucket.output += record.o;
    bucket.cacheWrite += record.w;
    bucket.cacheRead += record.r;
    bucket.total = bucket.input + bucket.output;
  }
  return buckets;
}
function modelStats(records) {
  const acc = /* @__PURE__ */ new Map();
  for (const record of records) {
    const model = record.model === "" ? "—" : record.model;
    const prev = acc.get(model);
    const next = prev ?? { model, requests: 0, totalTokens: 0, cost: 0, avgCost: 0 };
    next.requests += 1;
    next.totalTokens += record.i + record.o;
    next.cost += record.cost;
    acc.set(model, next);
  }
  const rows = [...acc.values()];
  for (const row of rows) row.avgCost = row.requests > 0 ? row.cost / row.requests : 0;
  rows.sort((a, b) => b.cost - a.cost);
  return rows;
}
var UNGROUPED_RECORDS_ID = "ungrouped";
function projectStats(workspaces, records) {
  const rows = [];
  const bySession = /* @__PURE__ */ new Map();
  for (const workspace of workspaces) {
    const row = { id: workspace.workspaceId, title: workspace.title || workspace.workspaceId, requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
    rows.push(row);
    for (const id of workspace.sessionIds) bySession.set(id, row);
  }
  const ungrouped = { id: UNGROUPED_RECORDS_ID, title: "ungrouped", requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
  for (const record of records) {
    const row = bySession.get(record.sessionId) ?? ungrouped;
    row.requests += 1;
    row.input += record.i;
    row.output += record.o;
    row.cacheWrite += record.w;
    row.cacheRead += record.r;
    row.cost += record.cost;
  }
  if (ungrouped.requests > 0) rows.push(ungrouped);
  return rows.filter((row) => row.requests > 0);
}
function requestLogRows(records) {
  return [...records].sort((a, b) => b.t - a.t);
}
function formatTokensShort(value, zh2, decimals = 1) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (zh2) {
    if (value >= 1e8) return `${(value / 1e8).toFixed(2)} 亿`;
    if (value >= 1e4) return `${(value / 1e4).toFixed(decimals)} 万`;
    return String(value);
  }
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(decimals)}K`;
  return String(value);
}
function formatCostExact(value, digits) {
  const n = Number(value);
  return Number.isFinite(n) ? `¥${n.toFixed(digits)}` : "¥--";
}
function currencySymbol(currency) {
  if (currency === "CNY") return "¥";
  if (currency === "USD") return "$";
  if (currency === "EUR") return "€";
  return currency === null || currency === void 0 ? "" : `${currency} `;
}
function formatMoney(value) {
  if (value === null || value === void 0) return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}

// src/client/balance.ts
var BALANCE_URL = "/api/billing/balance";
var PRICING_URL = "/api/billing/pricing";
var PRICING_TTL_MS = 15 * 60 * 1e3;
var pricingCache = null;
var pricingInFlight = null;
function fetchPricingTable() {
  if (pricingCache !== null && Date.now() - pricingCache.at < PRICING_TTL_MS) return Promise.resolve(pricingCache.rows);
  if (pricingInFlight !== null) return pricingInFlight;
  pricingInFlight = (async () => {
    try {
      const response = await fetch(PRICING_URL);
      const body = await response.json().catch(() => null);
      if (body === null || body.ok !== true || body.rows === null || typeof body.rows !== "object") return null;
      pricingCache = { at: Date.now(), rows: body.rows };
      return body.rows;
    } catch {
      return null;
    } finally {
      pricingInFlight = null;
    }
  })();
  return pricingInFlight;
}
function usePricingTable() {
  const [rows, setRows] = (0, import_react.useState)(pricingCache?.rows ?? null);
  (0, import_react.useEffect)(() => {
    let alive = true;
    void fetchPricingTable().then((fetched) => {
      if (!alive || fetched === null) return;
      setPricingTable(fetched);
      setRows(fetched);
    });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}
function useBalance() {
  const [state, setState] = (0, import_react.useState)({ status: "loading" });
  const inFlight = (0, import_react.useRef)(false);
  const load = (0, import_react.useCallback)(() => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: "loading" });
    fetch(BALANCE_URL).then(async (response) => {
      const body = await response.json().catch(() => null);
      if (response.ok && body !== null && body.ok === true) {
        setState({ status: "ok", balance: body });
      } else {
        const error = body === null || body.error === void 0 ? "provider-error" : body.error.code;
        setState({ status: "error", error });
      }
    }).catch(() => {
      setState({ status: "error", error: "network" });
    }).finally(() => {
      inFlight.current = false;
    });
  }, []);
  (0, import_react.useEffect)(() => {
    load();
  }, [load]);
  return { state, refresh: load };
}

// src/client/kit.ts
var warned = /* @__PURE__ */ new Set();
function requireKit(surface, kit, names) {
  const missing = names.filter((name) => typeof kit[name] !== "function");
  if (missing.length === 0) return true;
  if (!warned.has(surface)) {
    warned.add(surface);
    console.warn(
      `[dsh-token-viewer] ${surface}: this harness does not supply ${missing.join(", ")} to the slot; the surface stays hidden (the plugin may need updating for this harness version)`
    );
  }
  return false;
}

// src/client/BalanceRow.module.css
var css = ".tv1fqpq1x_balance {\n  margin-left: auto;\n  color: var(--dsw-alias-label-primary);\n  align-items: center;\n  gap: 4px;\n  font-size: 12px;\n  line-height: 16px;\n  font-weight: 600;\n  display: inline-flex;\n}\n\n.tv1fqpq1x_refresh {\n  cursor: pointer;\n  width: 18px;\n  height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n  background: 0 0;\n  border: none;\n  border-radius: 50%;\n  flex: none;\n  justify-content: center;\n  align-items: center;\n  padding: 0;\n  display: inline-flex;\n}\n\n.tv1fqpq1x_refresh:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-secondary);\n}\n\n.tv1fqpq1x_balanceError {\n  cursor: pointer;\n  margin-left: auto;\n  color: var(--dsw-alias-state-error-primary);\n  align-items: center;\n  gap: 4px;\n  font-size: 11px;\n  line-height: 16px;\n  display: inline-flex;\n  background: 0 0;\n  border: none;\n  padding: 0;\n}\n";
var tagId = "dsh-token-viewer/src/client/BalanceRow.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId;
  tag.textContent = css;
  document.head.appendChild(tag);
}
var BalanceRow_default = { "balance": "tv1fqpq1x_balance", "refresh": "tv1fqpq1x_refresh", "balanceError": "tv1fqpq1x_balanceError" };

// src/client/BalanceRow.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function BalanceRow({ balance, onRefresh, t }) {
  if (balance.status === "ok" && balance.balance !== null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "span",
      {
        className: BalanceRow_default.balance,
        title: `${t("balance")}: ${currencySymbol(balance.balance.currency)}${formatMoney(balance.balance.totalBalance)}`,
        children: [
          currencySymbol(balance.balance.currency),
          formatMoney(balance.balance.totalBalance),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: BalanceRow_default.refresh, onClick: onRefresh, "aria-label": t("refresh"), children: "⟳" })
        ]
      }
    );
  }
  if (balance.status === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", { type: "button", className: BalanceRow_default.balanceError, onClick: onRefresh, title: balance.error, children: [
      t("balanceUnavailable"),
      " ⟳"
    ] });
  }
  return null;
}

// src/client/PerSessionList.module.css
var css2 = ".tv1kzc996_toggle {\n  color: var(--dsw-alias-label-tertiary);\n  cursor: pointer;\n  background: 0 0;\n  border: none;\n  align-items: center;\n  gap: 4px;\n  padding: 0;\n  font-size: 11px;\n  line-height: 16px;\n  display: inline-flex;\n}\n\n.tv1kzc996_toggle:hover {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.tv1kzc996_rows {\n  max-height: 200px;\n  overflow-y: auto;\n  flex-direction: column;\n  gap: 2px;\n  display: flex;\n}\n\n.tv1kzc996_row {\n  width: 100%;\n  color: var(--dsw-alias-label-secondary);\n  cursor: pointer;\n  background: 0 0;\n  border: none;\n  border-radius: 6px;\n  align-items: center;\n  gap: 8px;\n  padding: 3px 6px;\n  font-size: 12px;\n  line-height: 18px;\n  display: flex;\n}\n\n.tv1kzc996_row:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.tv1kzc996_rowTitle {\n  min-width: 0;\n  color: var(--dsw-alias-label-secondary);\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  flex: 1;\n  overflow: hidden;\n  text-align: left;\n}\n\n.tv1kzc996_rowTokens {\n  flex: none;\n  color: var(--dsw-alias-label-caption);\n  white-space: nowrap;\n}\n";
var tagId2 = "dsh-token-viewer/src/client/PerSessionList.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId2) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId2;
  tag.textContent = css2;
  document.head.appendChild(tag);
}
var PerSessionList_default = { "toggle": "tv1kzc996_toggle", "rows": "tv1kzc996_rows", "row": "tv1kzc996_row", "rowTitle": "tv1kzc996_rowTitle", "rowTokens": "tv1kzc996_rowTokens" };

// src/client/PerSessionList.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function PerSessionList({ rows, open, onToggle, onOpen, t }) {
  if (rows.length === 0) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("button", { type: "button", className: PerSessionList_default.toggle, onClick: onToggle, children: [
      open ? t("collapse") : t("expand"),
      " ",
      t("perSession"),
      " (",
      rows.length,
      ")"
    ] }),
    open && /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: PerSessionList_default.rows, children: rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
      "button",
      {
        type: "button",
        className: PerSessionList_default.row,
        onClick: () => {
          if (onOpen !== void 0) onOpen(row.id);
        },
        title: row.title,
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: PerSessionList_default.rowTitle, children: row.title }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: PerSessionList_default.rowTokens, children: [
            "↑",
            formatTokens(row.input),
            " · ↓",
            formatTokens(row.output)
          ] })
        ]
      },
      row.id
    )) })
  ] });
}

// src/client/token-detail-store.ts
var import_react2 = require("react");
var OPEN = { open: true };
var CLOSED = { open: false };
function createTokenDetailStore() {
  let state = CLOSED;
  const listeners = /* @__PURE__ */ new Set();
  return {
    getSnapshot: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setOpen: (open) => {
      if (state.open === open) return;
      state = open ? OPEN : CLOSED;
      for (const listener of [...listeners]) listener();
    }
  };
}
var tokenDetailStore = createTokenDetailStore();
function useTokenDetailOpen() {
  return (0, import_react2.useSyncExternalStore)(
    tokenDetailStore.subscribe,
    () => tokenDetailStore.getSnapshot().open,
    () => tokenDetailStore.getSnapshot().open
  );
}

// src/client/SidebarTokenPanel.module.css
var css3 = "/* The Token panel page: a full-width `main` panel, so it centres its content\n   in a readable column instead of the old margin-hugging sidebar card. */\n\n.tv1tq3adu_page {\n  box-sizing: border-box;\n  width: 100%;\n  max-width: 720px;\n  margin: 0 auto;\n  padding: 18px 20px 24px;\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n}\n\n.tv1tq3adu_titleRow {\n  flex: none;\n  align-items: center;\n  gap: 10px;\n  display: flex;\n  flex-wrap: wrap;\n}\n\n.tv1tq3adu_title {\n  color: var(--dsw-alias-label-primary);\n  font-size: 14px;\n  line-height: 20px;\n  font-weight: 600;\n}\n\n.tv1tq3adu_line {\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 2px 14px;\n  display: flex;\n}\n\n.tv1tq3adu_seg {\n  color: var(--dsw-alias-label-caption);\n  font-size: 12px;\n  line-height: 18px;\n  white-space: nowrap;\n  display: inline-flex;\n  align-items: center;\n  gap: 3px;\n}\n\n.tv1tq3adu_seg strong {\n  color: var(--dsw-alias-label-secondary);\n  font-weight: 600;\n}\n\n.tv1tq3adu_empty {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.tv1tq3adu_detailButton {\n  align-self: flex-start;\n  color: var(--dsw-alias-state-business-primary);\n  cursor: pointer;\n  background: 0 0;\n  border: none;\n  gap: 4px;\n  padding: 0;\n  font-size: 12px;\n  line-height: 18px;\n  display: inline-flex;\n}\n\n.tv1tq3adu_detailButton:hover {\n  color: var(--dsw-alias-label-secondary);\n}\n";
var tagId3 = "dsh-token-viewer/src/client/SidebarTokenPanel.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId3) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId3;
  tag.textContent = css3;
  document.head.appendChild(tag);
}
var SidebarTokenPanel_default = { "page": "tv1tq3adu_page", "titleRow": "tv1tq3adu_titleRow", "title": "tv1tq3adu_title", "line": "tv1tq3adu_line", "seg": "tv1tq3adu_seg", "empty": "tv1tq3adu_empty", "detailButton": "tv1tq3adu_detailButton" };

// src/client/SidebarTokenPanel.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
function SidebarTokenPanel(props) {
  if (!requireKit("SidebarTokenPanel", props, ["useSessions"])) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(SidebarTokenBody, { ...props });
}
function SidebarTokenBody({ useSessions, t, openSession }) {
  const byId = useSessions((state) => state.byId);
  const totals = (0, import_react3.useMemo)(() => deriveSidebarTotals(byId), [byId]);
  const perSession = (0, import_react3.useMemo)(() => derivePerSession(byId), [byId]);
  const balance = useBalance();
  const [open, setOpen] = (0, import_react3.useState)(false);
  const input = totals.uncached + totals.cacheRead + totals.cacheWrite;
  const hasUsage = input > 0 || totals.output > 0;
  const cacheHit = input > 0 ? Math.round(totals.cacheRead / input * 100) : null;
  const tooltipLines = [
    `${t("input")}: ${formatTokens(input)} ${t("tokens")} (${t("uncached")} ${formatTokens(totals.uncached)} · ${t("cacheRead")} ${formatTokens(totals.cacheRead)} · ${t("cacheWrite")} ${formatTokens(totals.cacheWrite)})`,
    `${t("output")}: ${formatTokens(totals.output)} ${t("tokens")}`,
    `${t("sessions")}: ${totals.sessions}`
  ];
  if (cacheHit !== null) tooltipLines.push(`${t("cacheHit")}: ${cacheHit}%`);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: SidebarTokenPanel_default.page, "data-token-viewer-panel": true, title: tooltipLines.join("\n"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: SidebarTokenPanel_default.titleRow, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: SidebarTokenPanel_default.title, children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(BalanceRow, { balance: balance.state, onRefresh: balance.refresh, t })
    ] }),
    hasUsage ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: SidebarTokenPanel_default.line, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: SidebarTokenPanel_default.seg, children: [
        t("input"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: formatTokens(input) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: SidebarTokenPanel_default.seg, children: [
        t("output"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: formatTokens(totals.output) })
      ] }),
      cacheHit !== null && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: SidebarTokenPanel_default.seg, children: [
        t("cacheHit"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("strong", { children: [
          cacheHit,
          "%"
        ] })
      ] }),
      totals.sessions > 0 && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: SidebarTokenPanel_default.seg, children: [
        t("sessions"),
        " ",
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("strong", { children: totals.sessions })
      ] })
    ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: SidebarTokenPanel_default.empty, children: t("noData") }),
    hasUsage && /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "button", className: SidebarTokenPanel_default.detailButton, onClick: () => {
      tokenDetailStore.setOpen(true);
    }, children: [
      t("detail"),
      " →"
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(PerSessionList, { rows: perSession, open, onToggle: () => {
      setOpen((v) => !v);
    }, onOpen: openSession, t })
  ] });
}

// src/client/TokenPanelIcon.module.css
var css4 = ".tv19thqep_icon {\n  flex: none;\n  display: block;\n}\n";
var tagId4 = "dsh-token-viewer/src/client/TokenPanelIcon.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId4) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId4;
  tag.textContent = css4;
  document.head.appendChild(tag);
}
var TokenPanelIcon_default = { "icon": "tv19thqep_icon" };

// src/client/TokenPanelIcon.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function TokenPanelIcon({ size }) {
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
    "svg",
    {
      className: TokenPanelIcon_default.icon,
      width: size,
      height: size,
      viewBox: "0 0 16 16",
      fill: "none",
      "aria-hidden": "true",
      focusable: "false",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M3.25 12.75V9.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M8 12.75V4.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M12.75 12.75V7", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("path", { d: "M2.5 14.25h11", stroke: "currentColor", strokeWidth: "1.25", strokeLinecap: "round", opacity: "0.45" })
      ]
    }
  );
}

// src/client/BalanceChip.module.css
var css5 = "/* Sidebar-foot balance chip. The wide row mirrors the sidebar's own rows\n   (36px tall, 12px radius, hover fill); the rail form is the 36px square the\n   collapsed column reserves for its foot actions. */\n\n.tvppdzcb_action {\n  box-sizing: border-box;\n  min-height: 36px;\n  width: auto;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n  background: 0 0;\n  border: none;\n  border-radius: 12px;\n  align-items: center;\n  gap: 6px;\n  margin: 0 2px;\n  padding: 7px 8px;\n  line-height: 22px;\n  display: flex;\n}\n\n.tvppdzcb_action:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.tvppdzcb_action:focus-visible,\n.tvppdzcb_rail:focus-visible {\n  outline: 2px solid var(--dsw-alias-label-primary);\n  outline-offset: -2px;\n}\n\n.tvppdzcb_rail {\n  box-sizing: border-box;\n  width: 36px;\n  height: 36px;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  cursor: pointer;\n  background: 0 0;\n  border: none;\n  border-radius: 12px;\n  justify-content: center;\n  align-items: center;\n  padding: 0;\n  display: flex;\n}\n\n.tvppdzcb_rail:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.tvppdzcb_mark {\n  flex: none;\n  font-size: 13px;\n  line-height: 18px;\n  font-weight: 600;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.tvppdzcb_amount {\n  min-width: 0;\n  color: var(--dsw-alias-label-primary);\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: 13px;\n  line-height: 18px;\n  font-weight: 600;\n  overflow: hidden;\n}\n\n.tvppdzcb_amountError {\n  min-width: 0;\n  color: var(--dsw-alias-state-error-primary);\n  font-size: 13px;\n  line-height: 18px;\n  font-weight: 600;\n}\n";
var tagId5 = "dsh-token-viewer/src/client/BalanceChip.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId5) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId5;
  tag.textContent = css5;
  document.head.appendChild(tag);
}
var BalanceChip_default = { "action": "tvppdzcb_action", "rail": "tvppdzcb_rail", "mark": "tvppdzcb_mark", "amount": "tvppdzcb_amount", "amountError": "tvppdzcb_amountError" };

// src/client/BalanceChip.tsx
var import_jsx_runtime5 = require("react/jsx-runtime");
function BalanceChip({ wide, t }) {
  const balance = useBalance();
  const symbol = balance.state.status === "ok" ? currencySymbol(balance.state.balance.currency) : "";
  const amount = balance.state.status === "ok" ? formatMoney(balance.state.balance.totalBalance) : null;
  const label = balance.state.status === "error" ? `${t("balance")}: ${t("balanceUnavailable")}` : `${t("balance")}: ${symbol}${amount ?? "—"}`;
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "button",
    {
      type: "button",
      className: wide ? BalanceChip_default.action : BalanceChip_default.rail,
      onClick: balance.refresh,
      title: label,
      "aria-label": t("refresh"),
      "data-token-viewer-balance": true,
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: BalanceChip_default.mark, "aria-hidden": "true", children: symbol === "" ? "¥" : symbol }),
        wide && /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: balance.state.status === "error" ? BalanceChip_default.amountError : BalanceChip_default.amount, children: balance.state.status === "error" ? `—` : amount ?? "…" })
      ]
    }
  );
}

// src/client/TokenDock.tsx
var import_react4 = require("react");

// src/client/TokenDock.module.css
var css6 = ".tvyzqzn3_dock {\n  box-sizing: border-box;\n  width: calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));\n  margin: 0 auto;\n}\n\n.tvyzqzn3_bar {\n  box-sizing: border-box;\n  width: 100%;\n  max-width: calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));\n  min-height: 26px;\n  border: 1px solid var(--dsw-alias-border-l1);\n  background: var(--dsw-specific-tip);\n  border-radius: 10px;\n  align-items: center;\n  gap: 14px;\n  margin: 0 auto;\n  padding: 3px 12px;\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n}\n\n.tvyzqzn3_segRow {\n  flex: none;\n  align-items: center;\n  gap: 6px;\n  display: inline-flex;\n}\n\n.tvyzqzn3_seg {\n  color: var(--dsw-alias-label-caption);\n  align-items: center;\n  gap: 4px;\n  font-size: 12px;\n  line-height: 20px;\n  display: inline-flex;\n  white-space: nowrap;\n}\n\n.tvyzqzn3_seg strong {\n  color: var(--dsw-alias-label-secondary);\n  font-weight: 600;\n}\n\n.tvyzqzn3_sep {\n  color: var(--dsw-alias-label-dimmed);\n}\n\n.tvyzqzn3_occ {\n  align-items: center;\n  gap: 6px;\n  display: inline-flex;\n}\n\n.tvyzqzn3_track {\n  width: 44px;\n  height: 3px;\n  background: var(--dsw-alias-border-l1);\n  border-radius: 999px;\n  overflow: hidden;\n  flex: none;\n}\n\n.tvyzqzn3_fill {\n  height: 100%;\n  background: var(--dsw-alias-state-business-primary);\n  border-radius: 999px;\n}\n";
var tagId6 = "dsh-token-viewer/src/client/TokenDock.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId6) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId6;
  tag.textContent = css6;
  document.head.appendChild(tag);
}
var TokenDock_default = { "dock": "tvyzqzn3_dock", "bar": "tvyzqzn3_bar", "segRow": "tvyzqzn3_segRow", "seg": "tvyzqzn3_seg", "sep": "tvyzqzn3_sep", "occ": "tvyzqzn3_occ", "track": "tvyzqzn3_track", "fill": "tvyzqzn3_fill" };

// src/client/TokenDock.tsx
var import_jsx_runtime6 = require("react/jsx-runtime");
function dockSegments(view, t) {
  const segments = [];
  const push = (key, node) => {
    segments.push({ key, node });
  };
  if (view.input > 0) {
    push("input", /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: TokenDock_default.seg, children: [
      t("input"),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: formatTokens(view.input) })
    ] }));
  }
  if (view.output > 0) {
    push("output", /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: TokenDock_default.seg, children: [
      t("output"),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("strong", { children: formatTokens(view.output) })
    ] }));
  }
  if (view.cacheHit !== null) {
    push("cacheHit", /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: TokenDock_default.seg, children: [
      t("cacheHit"),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
        view.cacheHit,
        "%"
      ] })
    ] }));
  }
  if (view.occupancy !== null) {
    push("context", /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: TokenDock_default.seg, children: [
      t("context"),
      " ",
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("strong", { children: [
        view.occupancy.percent,
        "%"
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: TokenDock_default.occ, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: TokenDock_default.track, children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: TokenDock_default.fill, style: { width: `${view.occupancy.percent}%` } }) }) })
    ] }));
  }
  return segments;
}
function dockTooltip(view, t) {
  const lines = [
    `${t("input")}: ${formatTokens(view.input)} ${t("tokens")} (${t("uncached")} ${formatTokens(view.uncached)} · ${t("cacheRead")} ${formatTokens(view.cacheRead)} · ${t("cacheWrite")} ${formatTokens(view.cacheWrite)})`,
    `${t("output")}: ${formatTokens(view.output)} ${t("tokens")}`
  ];
  if (view.cacheHit !== null) lines.push(`${t("cacheHit")}: ${view.cacheHit}%`);
  if (view.occupancy !== null) {
    lines.push(`${t("context")}: ${formatTokens(view.occupancy.usedTokens)} / ${formatTokens(view.occupancy.contextWindow)} ${t("tokens")} (${view.occupancy.percent}%)`);
  }
  return lines.join("\n");
}
function TokenDock(props) {
  if (!requireKit("TokenDock", props, ["useProjection"])) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(TokenDockBody, { ...props });
}
function TokenDockBody({ useProjection, t }) {
  const usage = useProjection("tokenUsage");
  const pressure = useProjection("contextPressure");
  const breakdown = useProjection("contextBreakdown");
  const view = (0, import_react4.useMemo)(() => deriveTokenView(usage, pressure, breakdown), [usage, pressure, breakdown]);
  if (view === null) return null;
  const segments = dockSegments(view, t);
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: TokenDock_default.dock, "data-token-viewer": true, title: dockTooltip(view, t), children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: TokenDock_default.bar, children: segments.map((segment, index) => /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("span", { className: TokenDock_default.segRow, children: [
    index > 0 && /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("span", { className: TokenDock_default.sep, children: "·" }),
    segment.node
  ] }, segment.key)) }) });
}

// src/client/TokenDetailPanel.tsx
var import_react5 = require("react");

// src/client/TokenDetailPanel.module.css
var css7 = "/* `shell.tv9hsskj_overlay` is a click-through layer: entries must opt back into pointer\n   events, otherwise the drawer would render without receiving clicks. */\n.tv9hsskj_backdrop {\n  position: fixed;\n  inset: 0;\n  background: rgb(0 0 0 / 0.35);\n  justify-content: flex-end;\n  display: flex;\n  pointer-events: auto;\n}\n\n.tv9hsskj_panel {\n  box-sizing: border-box;\n  width: min(600px, 94vw);\n  height: 100%;\n  background: var(--dsw-alias-bg-base);\n  border-left: 1px solid var(--dsw-alias-border-l1);\n  box-shadow: -12px 0 32px rgb(0 0 0 / 0.25);\n  flex-direction: column;\n  display: flex;\n  overflow: hidden;\n}\n\n.tv9hsskj_header {\n  flex: none;\n  align-items: center;\n  gap: 8px;\n  padding: 12px 14px;\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\n  display: flex;\n}\n\n.tv9hsskj_headerTitle {\n  color: var(--dsw-alias-label-primary);\n  flex: 1;\n  font-size: 14px;\n  font-weight: 600;\n  line-height: 20px;\n}\n\n.tv9hsskj_close {\n  cursor: pointer;\n  width: 28px;\n  height: 28px;\n  color: var(--dsw-alias-label-tertiary);\n  background: 0 0;\n  border: none;\n  border-radius: 50%;\n  flex: none;\n  justify-content: center;\n  align-items: center;\n  padding: 0;\n  display: inline-flex;\n}\n\n.tv9hsskj_close:hover {\n  background: var(--dsw-interactive-bg-hover, var(--dsw-alias-interactive-bg-hover));\n  color: var(--dsw-alias-label-secondary);\n}\n\n.tv9hsskj_body {\n  flex: 1;\n  min-height: 0;\n  flex-direction: column;\n  gap: 14px;\n  padding: 12px 14px;\n  display: flex;\n  overflow-y: auto;\n}\n\n.tv9hsskj_toolbar {\n  flex: none;\n  align-items: center;\n  gap: 10px;\n  display: flex;\n}\n\n.tv9hsskj_toolbarLabel {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.tv9hsskj_segmented {\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 8px;\n  align-items: center;\n  padding: 2px;\n  display: inline-flex;\n}\n\n.tv9hsskj_segment,\n.tv9hsskj_segmentActive {\n  cursor: pointer;\n  border: none;\n  border-radius: 6px;\n  padding: 3px 10px;\n  font-size: 12px;\n  line-height: 18px;\n}\n\n.tv9hsskj_segment {\n  color: var(--dsw-alias-label-tertiary);\n  background: 0 0;\n}\n\n.tv9hsskj_segment:hover {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.tv9hsskj_segmentActive {\n  color: var(--dsw-alias-label-primary);\n  background: var(--dsw-alias-interactive-bg-active);\n  font-weight: 600;\n}\n\n/* --- CC Switch hero: headline row over the bucket grid --- */\n\n.tv9hsskj_hero {\n  flex: none;\n  border: 1px solid var(--dsw-alias-border-l1);\n  border-radius: 12px;\n  background: var(--dsw-specific-tip);\n  flex-direction: column;\n  gap: 10px;\n  padding: 12px;\n  display: flex;\n}\n\n.tv9hsskj_heroTop {\n  align-items: center;\n  justify-content: space-between;\n  gap: 12px;\n  display: flex;\n}\n\n.tv9hsskj_heroMain {\n  min-width: 0;\n}\n\n.tv9hsskj_heroLabel {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n  margin-bottom: 2px;\n}\n\n.tv9hsskj_heroBigRow {\n  align-items: baseline;\n  gap: 8px;\n  display: flex;\n}\n\n.tv9hsskj_heroBig {\n  color: var(--dsw-alias-label-primary);\n  font-size: 26px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n  line-height: 30px;\n  letter-spacing: -0.02em;\n}\n\n.tv9hsskj_heroChip {\n  color: var(--dsw-alias-label-tertiary);\n  background: var(--dsw-alias-interactive-bg-active);\n  border-radius: 6px;\n  font-size: 11px;\n  font-weight: 500;\n  line-height: 16px;\n  padding: 1px 6px;\n  flex: none;\n}\n\n.tv9hsskj_heroSide {\n  align-items: center;\n  gap: 14px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-base);\n  padding: 8px 14px;\n  display: flex;\n  flex: none;\n}\n\n.tv9hsskj_heroSideItem {\n  flex-direction: column;\n  gap: 2px;\n  display: flex;\n}\n\n.tv9hsskj_heroSideLabel {\n  color: var(--dsw-alias-label-caption);\n  font-size: 10px;\n  font-weight: 500;\n  letter-spacing: 0.04em;\n  line-height: 14px;\n  text-transform: uppercase;\n}\n\n.tv9hsskj_heroSideValue {\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  font-weight: 600;\n  font-variant-numeric: tabular-nums;\n  line-height: 18px;\n}\n\n.tv9hsskj_heroSideValueCost {\n  color: var(--dsw-alias-state-business-primary);\n  font-size: 13px;\n  font-weight: 600;\n  font-variant-numeric: tabular-nums;\n  line-height: 18px;\n}\n\n.tv9hsskj_heroSideDivider {\n  width: 1px;\n  height: 26px;\n  background: var(--dsw-alias-border-l2);\n  flex: none;\n}\n\n.tv9hsskj_heroGrid {\n  display: grid;\n  grid-template-columns: repeat(5, 1fr);\n  gap: 8px;\n}\n\n.tv9hsskj_miniStat {\n  box-sizing: border-box;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-base);\n  flex-direction: column;\n  gap: 3px;\n  padding: 8px 10px;\n  display: flex;\n  min-width: 0;\n}\n\n.tv9hsskj_miniLabel {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 14px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.tv9hsskj_miniValue {\n  color: var(--dsw-alias-label-primary);\n  font-size: 13px;\n  font-weight: 600;\n  font-variant-numeric: tabular-nums;\n  line-height: 18px;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n.tv9hsskj_hitRate {\n  box-sizing: border-box;\n  border: 1px solid var(--dsw-alias-border-l2);\n  border-radius: 10px;\n  background: var(--dsw-alias-bg-base);\n  flex-direction: column;\n  justify-content: center;\n  gap: 6px;\n  padding: 8px 10px;\n  display: flex;\n  min-width: 0;\n}\n\n.tv9hsskj_hitRateTop {\n  align-items: center;\n  justify-content: space-between;\n  gap: 6px;\n  display: flex;\n}\n\n.tv9hsskj_hitRateValue {\n  color: #10b981;\n  font-size: 12px;\n  font-weight: 700;\n  font-variant-numeric: tabular-nums;\n  line-height: 16px;\n}\n\n.tv9hsskj_hitRateTrack {\n  position: relative;\n  height: 6px;\n  border-radius: 999px;\n  background: var(--dsw-alias-interactive-bg-active);\n  overflow: hidden;\n}\n\n.tv9hsskj_hitRateFill {\n  position: absolute;\n  inset: 0 auto 0 0;\n  border-radius: 999px;\n  background: #10b981;\n}\n\n/* --- sections & trend chart --- */\n\n.tv9hsskj_section {\n  flex: none;\n  flex-direction: column;\n  gap: 6px;\n  display: flex;\n}\n\n.tv9hsskj_sectionTitle {\n  color: var(--dsw-alias-label-tertiary);\n  font-size: 11px;\n  line-height: 16px;\n  font-weight: 600;\n}\n\n.tv9hsskj_sectionHint {\n  color: var(--dsw-alias-label-caption);\n  font-weight: 400;\n}\n\n.tv9hsskj_legend {\n  flex: none;\n  align-items: center;\n  gap: 12px;\n  display: flex;\n  flex-wrap: wrap;\n}\n\n.tv9hsskj_legendItem {\n  color: var(--dsw-alias-label-caption);\n  align-items: center;\n  gap: 4px;\n  font-size: 11px;\n  line-height: 16px;\n  display: inline-flex;\n}\n\n.tv9hsskj_legendItem i {\n  width: 8px;\n  height: 8px;\n  border-radius: 2px;\n  flex: none;\n  display: inline-block;\n}\n\n/* Chart series colors are CC Switch's data-visualization palette. */\n.tv9hsskj_swatchInput { background: #3b82f6; }\n.tv9hsskj_swatchOutput { background: #22c55e; }\n.tv9hsskj_swatchCacheWrite { background: #f97316; }\n.tv9hsskj_swatchCacheRead { background: #a855f7; }\n.tv9hsskj_swatchCost { background: transparent; border: 1px dashed #f43f5e; }\n\n.tv9hsskj_chartWrap {\n  position: relative;\n  width: 100%;\n  padding-bottom: 18px;\n}\n\n.tv9hsskj_chartSvg {\n  width: 100%;\n  height: 108px;\n  display: block;\n}\n\n.tv9hsskj_chartEmpty {\n  height: 100px;\n}\n\n.tv9hsskj_chartLabel {\n  position: absolute;\n  bottom: 0;\n  transform: translateX(-50%);\n  color: var(--dsw-alias-label-caption);\n  font-size: 10px;\n  line-height: 14px;\n  white-space: nowrap;\n}\n\n.tv9hsskj_chartGrid {\n  stroke: var(--dsw-alias-border-l2);\n  stroke-dasharray: 3 3;\n  opacity: 0.5;\n}\n\n.tv9hsskj_areaInput { fill: url(#tvAreaInput); }\n.tv9hsskj_areaOutput { fill: url(#tvAreaOutput); }\n.tv9hsskj_areaCacheWrite { fill: url(#tvAreaCacheWrite); }\n.tv9hsskj_areaCacheRead { fill: url(#tvAreaCacheRead); }\n\n.tv9hsskj_lineInput { fill: none; stroke: #3b82f6; stroke-width: 1.5; }\n.tv9hsskj_lineOutput { fill: none; stroke: #22c55e; stroke-width: 1.5; }\n.tv9hsskj_lineCacheWrite { fill: none; stroke: #f97316; stroke-width: 1.5; }\n.tv9hsskj_lineCacheRead { fill: none; stroke: #a855f7; stroke-width: 1.5; }\n.tv9hsskj_lineCost { fill: none; stroke: #f43f5e; stroke-width: 1.5; stroke-dasharray: 4 4; }\n\n.tv9hsskj_chartHit {\n  fill: transparent;\n}\n\n.tv9hsskj_chartHit:hover {\n  fill: rgb(0 0 0 / 0.04);\n}\n\n/* --- tabs & tables --- */\n\n.tv9hsskj_tabs {\n  align-items: center;\n  gap: 4px;\n  border-bottom: 1px solid var(--dsw-alias-border-l1);\n  display: flex;\n}\n\n.tv9hsskj_tab,\n.tv9hsskj_tabActive {\n  cursor: pointer;\n  border: none;\n  background: 0 0;\n  padding: 5px 10px;\n  font-size: 12px;\n  line-height: 18px;\n  border-radius: 6px 6px 0 0;\n  border-bottom: 2px solid transparent;\n}\n\n.tv9hsskj_tab {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.tv9hsskj_tab:hover {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.tv9hsskj_tabActive {\n  color: var(--dsw-alias-label-primary);\n  font-weight: 600;\n  border-bottom-color: var(--dsw-alias-state-business-primary);\n}\n\n.tv9hsskj_table {\n  flex-direction: column;\n  display: flex;\n}\n\n.tv9hsskj_tableHead,\n.tv9hsskj_tableRow,\n.tv9hsskj_logRow {\n  width: 100%;\n  align-items: center;\n  gap: 8px;\n  padding: 4px 6px;\n  font-size: 12px;\n  line-height: 18px;\n  display: flex;\n  box-sizing: border-box;\n}\n\n.tv9hsskj_tableHead {\n  color: var(--dsw-alias-label-caption);\n  font-weight: 600;\n}\n\n.tv9hsskj_tableRow {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.tv9hsskj_logRow {\n  cursor: pointer;\n  color: var(--dsw-alias-label-secondary);\n  background: 0 0;\n  border: none;\n  border-radius: 6px;\n  text-align: left;\n}\n\n.tv9hsskj_logRow:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.tv9hsskj_colTime {\n  flex: none;\n  width: 78px;\n  color: var(--dsw-alias-label-caption);\n  white-space: nowrap;\n}\n\n.tv9hsskj_colProject,\n.tv9hsskj_colSession,\n.tv9hsskj_colModel {\n  min-width: 0;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  flex: 1;\n  overflow: hidden;\n}\n\n.tv9hsskj_colNum {\n  flex: none;\n  width: 62px;\n  text-align: right;\n  white-space: nowrap;\n  font-variant-numeric: tabular-nums;\n}\n";
var tagId7 = "dsh-token-viewer/src/client/TokenDetailPanel.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId7) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId7;
  tag.textContent = css7;
  document.head.appendChild(tag);
}
var TokenDetailPanel_default = { "overlay": "tv9hsskj_overlay", "backdrop": "tv9hsskj_backdrop", "panel": "tv9hsskj_panel", "header": "tv9hsskj_header", "headerTitle": "tv9hsskj_headerTitle", "close": "tv9hsskj_close", "body": "tv9hsskj_body", "toolbar": "tv9hsskj_toolbar", "toolbarLabel": "tv9hsskj_toolbarLabel", "segmented": "tv9hsskj_segmented", "segment": "tv9hsskj_segment", "segmentActive": "tv9hsskj_segmentActive", "hero": "tv9hsskj_hero", "heroTop": "tv9hsskj_heroTop", "heroMain": "tv9hsskj_heroMain", "heroLabel": "tv9hsskj_heroLabel", "heroBigRow": "tv9hsskj_heroBigRow", "heroBig": "tv9hsskj_heroBig", "heroChip": "tv9hsskj_heroChip", "heroSide": "tv9hsskj_heroSide", "heroSideItem": "tv9hsskj_heroSideItem", "heroSideLabel": "tv9hsskj_heroSideLabel", "heroSideValue": "tv9hsskj_heroSideValue", "heroSideValueCost": "tv9hsskj_heroSideValueCost", "heroSideDivider": "tv9hsskj_heroSideDivider", "heroGrid": "tv9hsskj_heroGrid", "miniStat": "tv9hsskj_miniStat", "miniLabel": "tv9hsskj_miniLabel", "miniValue": "tv9hsskj_miniValue", "hitRate": "tv9hsskj_hitRate", "hitRateTop": "tv9hsskj_hitRateTop", "hitRateValue": "tv9hsskj_hitRateValue", "hitRateTrack": "tv9hsskj_hitRateTrack", "hitRateFill": "tv9hsskj_hitRateFill", "section": "tv9hsskj_section", "sectionTitle": "tv9hsskj_sectionTitle", "sectionHint": "tv9hsskj_sectionHint", "legend": "tv9hsskj_legend", "legendItem": "tv9hsskj_legendItem", "swatchInput": "tv9hsskj_swatchInput", "swatchOutput": "tv9hsskj_swatchOutput", "swatchCacheWrite": "tv9hsskj_swatchCacheWrite", "swatchCacheRead": "tv9hsskj_swatchCacheRead", "swatchCost": "tv9hsskj_swatchCost", "chartWrap": "tv9hsskj_chartWrap", "chartSvg": "tv9hsskj_chartSvg", "chartEmpty": "tv9hsskj_chartEmpty", "chartLabel": "tv9hsskj_chartLabel", "chartGrid": "tv9hsskj_chartGrid", "areaInput": "tv9hsskj_areaInput", "areaOutput": "tv9hsskj_areaOutput", "areaCacheWrite": "tv9hsskj_areaCacheWrite", "areaCacheRead": "tv9hsskj_areaCacheRead", "lineInput": "tv9hsskj_lineInput", "lineOutput": "tv9hsskj_lineOutput", "lineCacheWrite": "tv9hsskj_lineCacheWrite", "lineCacheRead": "tv9hsskj_lineCacheRead", "lineCost": "tv9hsskj_lineCost", "chartHit": "tv9hsskj_chartHit", "tabs": "tv9hsskj_tabs", "tab": "tv9hsskj_tab", "tabActive": "tv9hsskj_tabActive", "table": "tv9hsskj_table", "tableHead": "tv9hsskj_tableHead", "tableRow": "tv9hsskj_tableRow", "logRow": "tv9hsskj_logRow", "colTime": "tv9hsskj_colTime", "colProject": "tv9hsskj_colProject", "colSession": "tv9hsskj_colSession", "colModel": "tv9hsskj_colModel", "colNum": "tv9hsskj_colNum" };

// src/client/TokenDetailPanel.tsx
var import_jsx_runtime7 = require("react/jsx-runtime");
function clockLabel(t) {
  const d = new Date(t);
  const now = /* @__PURE__ */ new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const hhmm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? hhmm : `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${hhmm}`;
}
function TrendChart({ buckets, t }) {
  const width = Math.max(280, buckets.length * 26);
  const height = 108;
  const pad = 2;
  const tokenMax = Math.max(1, ...buckets.map((b) => Math.max(b.input, b.output, b.cacheWrite, b.cacheRead)));
  const costMax = Math.max(1e-9, ...buckets.map((b) => b.cost));
  const step = buckets.length > 1 ? (width - pad * 2) / (buckets.length - 1) : 0;
  const x = (i) => pad + i * step;
  const y = (v, max) => height - pad - v / max * (height - pad * 2);
  const line = (pick, max) => buckets.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(i), max).toFixed(1)}`).join(" ");
  const area = (pick, max) => `${line(pick, max)} L${x(buckets.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`;
  if (buckets.length === 0) return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.chartEmpty });
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.chartWrap, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("svg", { className: TokenDetailPanel_default.chartSvg, viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none", role: "img", children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("defs", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("linearGradient", { id: "tvAreaInput", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "5%", stopColor: "#3b82f6", stopOpacity: "0.25" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "95%", stopColor: "#3b82f6", stopOpacity: "0" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("linearGradient", { id: "tvAreaOutput", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "5%", stopColor: "#22c55e", stopOpacity: "0.25" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "95%", stopColor: "#22c55e", stopOpacity: "0" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("linearGradient", { id: "tvAreaCacheWrite", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "5%", stopColor: "#f97316", stopOpacity: "0.25" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "95%", stopColor: "#f97316", stopOpacity: "0" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("linearGradient", { id: "tvAreaCacheRead", x1: "0", y1: "0", x2: "0", y2: "1", children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "5%", stopColor: "#a855f7", stopOpacity: "0.25" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("stop", { offset: "95%", stopColor: "#a855f7", stopOpacity: "0" })
        ] })
      ] }),
      [0.25, 0.5, 0.75].map((f) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("line", { className: TokenDetailPanel_default.chartGrid, x1: pad, x2: width - pad, y1: height * f, y2: height * f }, f)),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.areaInput, d: area((i) => buckets[i].input, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.areaOutput, d: area((i) => buckets[i].output, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.areaCacheWrite, d: area((i) => buckets[i].cacheWrite, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.areaCacheRead, d: area((i) => buckets[i].cacheRead, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.lineInput, d: line((i) => buckets[i].input, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.lineOutput, d: line((i) => buckets[i].output, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.lineCacheWrite, d: line((i) => buckets[i].cacheWrite, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.lineCacheRead, d: line((i) => buckets[i].cacheRead, tokenMax) }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("path", { className: TokenDetailPanel_default.lineCost, d: line((i) => buckets[i].cost, costMax) }),
      buckets.map((bucket, i) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
        "rect",
        {
          className: TokenDetailPanel_default.chartHit,
          x: x(i) - step / 2,
          y: 0,
          width: Math.max(step, 6),
          height,
          children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("title", { children: `${bucket.label}: ${t("freshInput")} ${bucket.input.toLocaleString()} · ${t("output")} ${bucket.output.toLocaleString()} · ${t("cacheWrite")} ${bucket.cacheWrite.toLocaleString()} · ${t("cacheRead")} ${bucket.cacheRead.toLocaleString()} · ${t("totalCost")} ${formatCostExact(bucket.cost, 4)} · ${t("requests")} ${bucket.requests}` })
        },
        bucket.t
      ))
    ] }),
    buckets.map((bucket, i) => i % labelEvery === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.chartLabel, style: { left: `${buckets.length > 1 ? i / (buckets.length - 1) * 100 : 50}%` }, children: bucket.label }, `l${bucket.t}`) : null)
  ] });
}
function MiniStat({ label, value, accent }) {
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.miniStat, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.miniLabel, children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.miniValue, style: accent === void 0 ? void 0 : { color: accent }, children: value })
  ] });
}
function TokenDetailPanel(props) {
  if (!requireKit("TokenDetailPanel", props, ["useSessions", "useWorkspaces"])) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TokenDetailBody, { ...props });
}
function TokenDetailBody({ useSessions, useWorkspaces, t, openSession }) {
  const open = useTokenDetailOpen();
  const byId = useSessions((state) => state.byId);
  const workspaceItems = useWorkspaces((state) => state.items);
  const pricingRows = usePricingTable();
  const [range, setRange] = (0, import_react5.useState)("today");
  const [tab, setTab] = (0, import_react5.useState)("logs");
  const now = (0, import_react5.useMemo)(() => Date.now(), [range, byId]);
  const records = (0, import_react5.useMemo)(
    () => collectRequestRecords(byId, range, now),
    [byId, range, now, pricingRows]
  );
  const summary = (0, import_react5.useMemo)(() => usageSummary(records), [records]);
  const trend = (0, import_react5.useMemo)(() => usageTrend(records, range, now), [records, range, now]);
  const models = (0, import_react5.useMemo)(() => modelStats(records), [records]);
  const projects = (0, import_react5.useMemo)(() => projectStats(workspaceItems, records), [workspaceItems, records]);
  const logs = (0, import_react5.useMemo)(() => requestLogRows(records), [records]);
  const isZh = t("today") === "当天";
  if (!open) return null;
  const close = () => {
    tokenDetailStore.setOpen(false);
  };
  const ranges = ["today", "7d", "14d", "30d", "all"];
  const rangeLabelOf = (r) => t(r === "all" ? "all" : r === "today" ? "today" : r === "7d" ? "last7d" : r === "14d" ? "last14d" : "last30d");
  const hitPercent = Math.max(0, Math.min(100, summary.cacheHitRate * 100));
  const hitPercentLabel = hitPercent.toFixed(hitPercent >= 99.95 ? 0 : 1);
  const tabs = ["logs", "projects", "models"];
  const resolved = resolveUsageRange(range, now);
  return /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.backdrop, onClick: close, "data-token-detail": true, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.panel, role: "dialog", "aria-label": t("title"), onClick: (e) => {
    e.stopPropagation();
  }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.header, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.headerTitle, children: t("title") }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("button", { type: "button", className: TokenDetailPanel_default.close, onClick: close, "aria-label": t("close"), children: "✕" })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.body, children: [
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.toolbar, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.toolbarLabel, children: t("range") }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.segmented, role: "group", "aria-label": t("range"), children: ranges.map((r) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            className: range === r ? TokenDetailPanel_default.segmentActive : TokenDetailPanel_default.segment,
            onClick: () => {
              setRange(r);
            },
            children: rangeLabelOf(r)
          },
          r
        )) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.hero, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.heroTop, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.heroMain, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.heroLabel, children: t("realTotal") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.heroBigRow, children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.heroBig, title: summary.realTotal.toLocaleString(), children: summary.realTotal.toLocaleString() }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.heroChip, children: [
                "≈ ",
                formatTokensShort(summary.realTotal, isZh, 2)
              ] })
            ] })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.heroSide, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.heroSideItem, children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.heroSideLabel, children: t("requests") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.heroSideValue, children: summary.requests.toLocaleString() })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.heroSideDivider }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.heroSideItem, children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.heroSideLabel, children: t("totalCost") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.heroSideValueCost, children: formatCostExact(summary.cost, 4) })
            ] })
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.heroGrid, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MiniStat, { label: t("freshInput"), value: formatTokensShort(summary.input, isZh), accent: "#3b82f6" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MiniStat, { label: t("output"), value: formatTokensShort(summary.output, isZh), accent: "#22c55e" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MiniStat, { label: t("cacheWrite"), value: formatTokensShort(summary.cacheWrite, isZh), accent: "#f97316" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(MiniStat, { label: t("cacheRead"), value: formatTokensShort(summary.cacheRead, isZh), accent: "#a855f7" }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.hitRate, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.hitRateTop, children: [
              /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.miniLabel, children: t("cacheHitRate") }),
              /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.hitRateValue, children: [
                hitPercentLabel,
                "%"
              ] })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.hitRateTrack, children: /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.hitRateFill, style: { width: `${hitPercent}%` } }) })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: TokenDetailPanel_default.section, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.sectionTitle, children: [
          t("trend"),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.sectionHint, children: [
            t("trendExact"),
            " · ",
            rangeLabelOf(range),
            " · ",
            new Date(resolved.startDate).toLocaleDateString(),
            " – ",
            new Date(resolved.endDate).toLocaleDateString()
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.legend, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.legendItem, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("i", { className: TokenDetailPanel_default.swatchInput }),
            t("freshInput")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.legendItem, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("i", { className: TokenDetailPanel_default.swatchOutput }),
            t("output")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.legendItem, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("i", { className: TokenDetailPanel_default.swatchCacheWrite }),
            t("cacheWrite")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.legendItem, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("i", { className: TokenDetailPanel_default.swatchCacheRead }),
            t("cacheRead")
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("span", { className: TokenDetailPanel_default.legendItem, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("i", { className: TokenDetailPanel_default.swatchCost }),
            t("totalCost")
          ] })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(TrendChart, { buckets: trend, t })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("section", { className: TokenDetailPanel_default.section, children: [
        /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.tabs, role: "tablist", children: tabs.map((key) => /* @__PURE__ */ (0, import_jsx_runtime7.jsx)(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": tab === key,
            className: tab === key ? TokenDetailPanel_default.tabActive : TokenDetailPanel_default.tab,
            onClick: () => {
              setTab(key);
            },
            children: t(key === "logs" ? "requestLogs" : key === "projects" ? "projectStats" : "modelStats")
          },
          key
        )) }),
        tab === "logs" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.table, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.tableHead, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colTime, children: t("time") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colSession, children: t("byConversation") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colModel, children: t("model") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("freshInput") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("output") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("cacheRead") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("totalCost") })
          ] }),
          logs.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.tableRow, children: t("noData") }) : logs.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)(
            "button",
            {
              type: "button",
              className: TokenDetailPanel_default.logRow,
              onClick: () => {
                openSession(row.sessionId);
                close();
              },
              title: row.sessionTitle,
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colTime, children: clockLabel(row.t) }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colSession, children: row.sessionTitle }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colModel, title: row.model, children: row.model === "" ? "—" : row.model }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: row.i.toLocaleString() }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: row.o.toLocaleString() }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: row.r.toLocaleString() }),
                /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: formatCostExact(row.cost, 6) })
              ]
            },
            `${row.sessionId}:${row.t}:${index}`
          ))
        ] }),
        tab === "projects" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.table, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.tableHead, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colProject, children: t("projectStats") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("requests") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("tokens") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("totalCost") })
          ] }),
          projects.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.tableRow, children: t("noData") }) : projects.map((row) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.tableRow, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colProject, title: row.title, children: row.title === "ungrouped" ? t("ungrouped") : row.title }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: row.requests.toLocaleString() }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: (row.input + row.output).toLocaleString() }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: formatCostExact(row.cost, 4) })
          ] }, row.id))
        ] }),
        tab === "models" && /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.table, children: [
          /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.tableHead, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colModel, children: t("model") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("requests") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("tokens") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("totalCost") }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: t("avgCost") })
          ] }),
          models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("div", { className: TokenDetailPanel_default.tableRow, children: t("noData") }) : models.map((row) => /* @__PURE__ */ (0, import_jsx_runtime7.jsxs)("div", { className: TokenDetailPanel_default.tableRow, children: [
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colModel, title: row.model, children: row.model }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: row.requests.toLocaleString() }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: row.totalTokens.toLocaleString() }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: formatCostExact(row.cost, 4) }),
            /* @__PURE__ */ (0, import_jsx_runtime7.jsx)("span", { className: TokenDetailPanel_default.colNum, children: formatCostExact(row.avgCost, 6) })
          ] }, row.model))
        ] })
      ] })
    ] })
  ] }) });
}

// src/client/TokenPet.tsx
var import_react6 = require("react");

// src/client/assets/whale-maid.png
var whale_maid_default = "data:image/png;base64,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";

// src/client/TokenPet.module.css
var css8 = "/* The bottom-right whale-maid pet. `shell.tv1ngpn8b_overlay` is a click-through layer,\n   so the pet opts back into pointer events itself and stays below the\n   statistics drawer's scrim (which the pet yields to by rendering null). */\n\n.tv1ngpn8b_pet {\n  position: fixed;\n  right: 18px;\n  bottom: 14px;\n  z-index: 10;\n  box-sizing: border-box;\n  width: 104px;\n  height: 130px;\n  font: inherit;\n  cursor: pointer;\n  background: 0 0;\n  border: none;\n  padding: 0;\n  line-height: 0;\n  pointer-events: auto;\n  transition: transform 160ms ease;\n}\n\n.tv1ngpn8b_pet:hover {\n  transform: scale(1.06);\n}\n\n.tv1ngpn8b_pet:focus-visible {\n  outline: 2px solid var(--dsw-alias-border-focus, #5b8def);\n  outline-offset: 2px;\n  border-radius: 16px;\n}\n\n/* The chibi artwork bobs gently; off-peak dims it a touch for night mode. */\n.tv1ngpn8b_maid {\n  width: 100%;\n  height: 100%;\n  object-fit: contain;\n  object-position: bottom;\n  user-select: none;\n  filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.22));\n  animation: tv-pet-bob 3.2s ease-in-out infinite;\n  transform-origin: 50% 85%;\n}\n\n.tv1ngpn8b_pet[data-pet-state='off-peak'] .tv1ngpn8b_maid {\n  filter: brightness(0.86) saturate(0.88) drop-shadow(0 4px 10px rgb(0 0 0 / 0.18));\n}\n\n/* Peak: awake and uneasy — the bob turns into a quicker wiggle. */\n.tv1ngpn8b_pet[data-pet-state='peak'] .tv1ngpn8b_maid {\n  animation: tv-pet-wiggle 1.4s ease-in-out infinite;\n}\n\n.tv1ngpn8b_badge {\n  position: absolute;\n  top: 0;\n  right: 2px;\n  font-size: 17px;\n  line-height: 1;\n  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.3));\n}\n\n.tv1ngpn8b_pet[data-pet-state='peak'] .tv1ngpn8b_badge {\n  animation: tv-pet-pulse 1.4s ease-in-out infinite;\n}\n\n.tv1ngpn8b_zzz {\n  position: absolute;\n  top: -2px;\n  left: 8px;\n  font-size: 16px;\n  line-height: 1;\n  animation: tv-pet-rise 2.6s ease-in-out infinite;\n}\n\n.tv1ngpn8b_sweat {\n  position: absolute;\n  top: 18px;\n  right: 12px;\n  font-size: 13px;\n  line-height: 1;\n  animation: tv-pet-fall 1.4s ease-in infinite;\n}\n\n@keyframes tv-pet-bob {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-4px); }\n}\n\n@keyframes tv-pet-wiggle {\n  0%, 100% { transform: rotate(-2.5deg); }\n  50% { transform: rotate(2.5deg); }\n}\n\n@keyframes tv-pet-pulse {\n  0%, 100% { transform: scale(1); }\n  50% { transform: scale(1.25); }\n}\n\n@keyframes tv-pet-rise {\n  0% { opacity: 0; transform: translate(0, 4px); }\n  30% { opacity: 1; }\n  100% { opacity: 0; transform: translate(6px, -14px); }\n}\n\n@keyframes tv-pet-fall {\n  0% { opacity: 0; transform: translate(0, -2px); }\n  30% { opacity: 1; }\n  100% { opacity: 0; transform: translate(2px, 12px); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .tv1ngpn8b_pet, .tv1ngpn8b_pet:hover, .tv1ngpn8b_maid, .tv1ngpn8b_badge, .tv1ngpn8b_zzz, .tv1ngpn8b_sweat {\n    animation: none;\n    transition: none;\n  }\n}\n";
var tagId8 = "dsh-token-viewer/src/client/TokenPet.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId8) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId8;
  tag.textContent = css8;
  document.head.appendChild(tag);
}
var TokenPet_default = { "overlay": "tv1ngpn8b_overlay", "pet": "tv1ngpn8b_pet", "maid": "tv1ngpn8b_maid", "badge": "tv1ngpn8b_badge", "zzz": "tv1ngpn8b_zzz", "sweat": "tv1ngpn8b_sweat" };

// src/client/TokenPet.tsx
var import_jsx_runtime8 = require("react/jsx-runtime");
var TICK_MS = 3e4;
var BOUNDARIES_BJT = [9 * 3600 * 1e3, 12 * 3600 * 1e3, 14 * 3600 * 1e3, 18 * 3600 * 1e3];
var TOOLTIP_MODEL = "deepseek-v4-flash";
function nextBoundaryMs(now) {
  const DAY_MS2 = 24 * 60 * 60 * 1e3;
  const bjtNow = ((now + 8 * 3600 * 1e3) % DAY_MS2 + DAY_MS2) % DAY_MS2;
  for (const boundary of BOUNDARIES_BJT) {
    if (boundary > bjtNow) return boundary - bjtNow;
  }
  return BOUNDARIES_BJT[0] + DAY_MS2 - bjtNow;
}
function formatCountdown(ms, zh2) {
  const totalMinutes = Math.max(0, Math.round(ms / 6e4));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return zh2 ? `${minutes} 分钟` : minutes === 1 ? "1 minute" : `${minutes} minutes`;
  return zh2 ? `${hours}小时${String(minutes).padStart(2, "0")}分` : `${hours}h ${String(minutes).padStart(2, "0")}m`;
}
function useWallClock() {
  const [now, setNow] = (0, import_react6.useState)(() => Date.now());
  (0, import_react6.useEffect)(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return now;
}
function TokenPet(props) {
  const { t } = props;
  const drawerOpen = useTokenDetailOpen();
  const now = useWallClock();
  if (drawerOpen) return null;
  const peak = isPeakHour(now);
  const isZh = t("today") === "当天";
  const price = pricesForModel(TOOLTIP_MODEL, now);
  const countdown = formatCountdown(nextBoundaryMs(now), isZh);
  const tooltip = [
    `${t(peak ? "petPeak" : "petOffPeak")} · ${t(peak ? "petUntilOffPeak" : "petUntilPeak")} ${countdown}`,
    `${t("input")} ¥${price.inputPerM} · ${t("output")} ¥${price.outputPerM} ${t("petPerM")}`
  ].join("\n");
  return /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(
    "button",
    {
      type: "button",
      className: TokenPet_default.pet,
      "data-token-pet": true,
      "data-pet-state": peak ? "peak" : "off-peak",
      title: tooltip,
      "aria-label": tooltip.replace("\n", " "),
      onClick: () => {
        tokenDetailStore.setOpen(true);
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("img", { className: TokenPet_default.maid, src: whale_maid_default, alt: "", draggable: false }),
        /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: TokenPet_default.badge, "aria-hidden": "true", children: peak ? "⚡" : "🌙" }),
        peak ? /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: TokenPet_default.sweat, "aria-hidden": "true", children: "💧" }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("span", { className: TokenPet_default.zzz, "aria-hidden": "true", children: "💤" })
      ]
    }
  );
}

// src/client/locales.ts
var zh = {
  "input": "输入",
  "output": "输出",
  "cacheHit": "缓存命中",
  "context": "上下文",
  "cacheRead": "缓存读",
  "cacheWrite": "缓存写",
  "uncached": "未缓存",
  "tokens": "tokens",
  "title": "Token 消耗",
  "panel": "Token 消耗",
  "sessions": "会话",
  "balance": "余额",
  "refresh": "刷新余额",
  "balanceUnavailable": "余额不可用",
  "perSession": "按会话查看",
  "expand": "展开",
  "collapse": "收起",
  "detail": "用量详情",
  "total": "总用量",
  "byProject": "按项目",
  "byConversation": "按对话",
  "close": "关闭",
  "ungrouped": "未分组",
  "cost": "估算费用",
  "realUsage": "真实消耗",
  "realTotal": "真实消耗 Tokens",
  "requests": "请求数",
  "totalCost": "总成本",
  "avgCost": "平均成本",
  "freshInput": "新增输入",
  "cacheHitRate": "缓存命中率",
  "requestLogs": "请求日志",
  "projectStats": "项目统计",
  "noData": "暂无数据",
  "range": "时间范围",
  "today": "当天",
  "last7d": "7天",
  "last14d": "14天",
  "last30d": "30天",
  "all": "全部",
  "time": "时间",
  "trend": "使用趋势",
  "trendExact": "按请求提交时间统计",
  "modelStats": "模型统计",
  "model": "模型",
  "petPeak": "峰时（牌价 ×2）",
  "petOffPeak": "谷时（标准牌价）",
  "petUntilPeak": "距峰时还有",
  "petUntilOffPeak": "距谷时还有",
  "petPerM": "/百万 tokens"
};
var en = {
  "input": "Input",
  "output": "Output",
  "cacheHit": "Cache hit",
  "context": "Context",
  "cacheRead": "cache read",
  "cacheWrite": "cache write",
  "uncached": "uncached",
  "tokens": "tokens",
  "title": "Token Usage",
  "panel": "Token Usage",
  "sessions": "sessions",
  "balance": "Balance",
  "refresh": "Refresh balance",
  "balanceUnavailable": "Balance unavailable",
  "perSession": "per-conversation",
  "expand": "Expand",
  "collapse": "Collapse",
  "detail": "Usage details",
  "total": "Total usage",
  "byProject": "By project",
  "byConversation": "By conversation",
  "close": "Close",
  "ungrouped": "Ungrouped",
  "cost": "Est. cost",
  "realUsage": "Real usage",
  "realTotal": "Real consumption Tokens",
  "requests": "Requests",
  "totalCost": "Total cost",
  "avgCost": "Avg. cost",
  "freshInput": "Fresh input",
  "cacheHitRate": "Cache hit rate",
  "requestLogs": "Request logs",
  "projectStats": "By project",
  "noData": "No data",
  "range": "Time range",
  "today": "Today",
  "last7d": "7d",
  "last14d": "14d",
  "last30d": "30d",
  "all": "All",
  "time": "Time",
  "trend": "Usage trend",
  "trendExact": "bucketed by request commit time",
  "modelStats": "Model stats",
  "model": "Model",
  "petPeak": "Peak hours (2× prices)",
  "petOffPeak": "Off-peak (standard prices)",
  "petUntilPeak": "peak starts in",
  "petUntilOffPeak": "off-peak starts in",
  "petPerM": "/1M tokens"
};

// src/client/index.ts
var NS = "tokenViewer";
var PANEL_ID = "token";
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-token-viewer: dictionaries");
  const t = ctx.locale.bind(NS);
  const openSession = (sessionId) => {
    const navigation = ctx.get("uiWorkspace");
    navigation?.openSession?.(sessionId);
  };
  const injected = () => ({ openSession });
  ctx.slots.inject("main", () => ctx.slots.register({
    name: "main",
    key: PANEL_ID,
    locale: NS,
    inject: injected
  }, SidebarTokenPanel));
  ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
    name: "sidebar.panellist",
    id: PANEL_ID,
    order: 30,
    label: () => t("panel"),
    locale: NS
  }, TokenPanelIcon));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "token-viewer-balance",
    order: 10,
    label: () => t("balance"),
    locale: NS
  }, BalanceChip));
  ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
    name: "conversation.input.dock",
    id: "token-viewer",
    order: 20,
    locale: NS
  }, TokenDock));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "token-viewer-detail",
    order: 10,
    locale: NS,
    inject: injected
  }, TokenDetailPanel));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "token-viewer-pet",
    order: 20,
    locale: NS
  }, TokenPet));
}
		return module.exports;
	}
});
