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

// src/client/TokenPet.module.css
var css8 = "/* The bottom-right whale-maid pet. `shell.tv1ngpn8b_overlay` is a click-through layer,\n   so the pet opts back into pointer events itself and stays below the\n   statistics drawer's scrim (which the pet yields to by rendering null). */\n\n.tv1ngpn8b_pet {\n  position: fixed;\n  right: 18px;\n  bottom: 18px;\n  z-index: 10;\n  box-sizing: border-box;\n  width: 84px;\n  height: 84px;\n  font: inherit;\n  cursor: pointer;\n  background: 0 0;\n  border: none;\n  padding: 0;\n  line-height: 0;\n  pointer-events: auto;\n  transition: transform 160ms ease;\n}\n\n.tv1ngpn8b_pet:hover {\n  transform: scale(1.08);\n}\n\n.tv1ngpn8b_pet:focus-visible {\n  outline: 2px solid var(--dsw-alias-border-focus, #5b8def);\n  outline-offset: 2px;\n  border-radius: 50%;\n}\n\n.tv1ngpn8b_svg {\n  width: 100%;\n  height: 100%;\n  animation: tv-pet-bob 3.2s ease-in-out infinite;\n  transform-origin: 50% 80%;\n}\n\n/* Peak: awake and uneasy — the bob turns into a quicker wiggle. */\n.tv1ngpn8b_pet[data-pet-state='peak'] .tv1ngpn8b_svg {\n  animation: tv-pet-wiggle 1.4s ease-in-out infinite;\n}\n\n.tv1ngpn8b_tail {\n  transform-origin: 88px 58px;\n  animation: tv-pet-tail 3.2s ease-in-out infinite;\n}\n\n.tv1ngpn8b_pet[data-pet-state='peak'] .tv1ngpn8b_tail {\n  animation-duration: 1.4s;\n}\n\n.tv1ngpn8b_badge {\n  position: absolute;\n  top: -2px;\n  right: -2px;\n  font-size: 15px;\n  line-height: 1;\n  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.25));\n}\n\n.tv1ngpn8b_pet[data-pet-state='peak'] .tv1ngpn8b_badge {\n  animation: tv-pet-pulse 1.4s ease-in-out infinite;\n}\n\n.tv1ngpn8b_zzz {\n  position: absolute;\n  top: -6px;\n  left: 6px;\n  font-size: 14px;\n  line-height: 1;\n  animation: tv-pet-rise 2.6s ease-in-out infinite;\n}\n\n.tv1ngpn8b_sweat {\n  position: absolute;\n  top: 14px;\n  right: 8px;\n  font-size: 12px;\n  line-height: 1;\n  animation: tv-pet-fall 1.4s ease-in infinite;\n}\n\n@keyframes tv-pet-bob {\n  0%, 100% { transform: translateY(0); }\n  50% { transform: translateY(-4px); }\n}\n\n@keyframes tv-pet-wiggle {\n  0%, 100% { transform: rotate(-2.5deg); }\n  50% { transform: rotate(2.5deg); }\n}\n\n@keyframes tv-pet-tail {\n  0%, 100% { transform: rotate(0deg); }\n  50% { transform: rotate(-6deg); }\n}\n\n@keyframes tv-pet-pulse {\n  0%, 100% { transform: scale(1); }\n  50% { transform: scale(1.25); }\n}\n\n@keyframes tv-pet-rise {\n  0% { opacity: 0; transform: translate(0, 4px); }\n  30% { opacity: 1; }\n  100% { opacity: 0; transform: translate(6px, -14px); }\n}\n\n@keyframes tv-pet-fall {\n  0% { opacity: 0; transform: translate(0, -2px); }\n  30% { opacity: 1; }\n  100% { opacity: 0; transform: translate(2px, 12px); }\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .tv1ngpn8b_pet, .tv1ngpn8b_pet:hover, .tv1ngpn8b_svg, .tv1ngpn8b_tail, .tv1ngpn8b_badge, .tv1ngpn8b_zzz, .tv1ngpn8b_sweat {\n    animation: none;\n    transition: none;\n  }\n}\n";
var tagId8 = "dsh-token-viewer/src/client/TokenPet.module.css";
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId8) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = "dsh-token-viewer";
  tag.dataset.pluginCss = tagId8;
  tag.textContent = css8;
  document.head.appendChild(tag);
}
var TokenPet_default = { "overlay": "tv1ngpn8b_overlay", "pet": "tv1ngpn8b_pet", "svg": "tv1ngpn8b_svg", "tail": "tv1ngpn8b_tail", "badge": "tv1ngpn8b_badge", "zzz": "tv1ngpn8b_zzz", "sweat": "tv1ngpn8b_sweat" };

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
        /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)("svg", { className: TokenPet_default.svg, viewBox: "0 0 120 120", "aria-hidden": "true", children: [
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { className: TokenPet_default.tail, d: "M88 58 q20 -8 24 -28 q6 20 -12 34 q-6 5 -12 4 z", fill: "#4a7bd4" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ellipse", { cx: "58", cy: "74", rx: "40", ry: "31", fill: "#5b8def" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ellipse", { cx: "58", cy: "86", rx: "27", ry: "15", fill: "#dceaff" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M44 94 q-6 14 8 17 q-2 -10 6 -14 z", fill: "#4a7bd4" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { className: TokenPet_default.drop, cx: "54", cy: "30", r: "2.6", fill: "#9cc3ff" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { className: TokenPet_default.dropSlow, cx: "66", cy: "24", r: "2", fill: "#9cc3ff" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M26 52 q32 -30 66 -2 l-5 9 q-28 -22 -56 1 z", fill: "#ffffff", stroke: "#c9d6ea", strokeWidth: "1.4" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M30 50 l-10 -7 1 10 z", fill: "#5b8def" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M31 51 l-3 11 9 -3 z", fill: "#5b8def" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "29", cy: "52", r: "2.6", fill: "#3b6cc4" }),
          peak ? /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "44", cy: "70", r: "3.8", fill: "#1e2a3a" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "66", cy: "70", r: "3.8", fill: "#1e2a3a" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "45.3", cy: "68.7", r: "1.2", fill: "#ffffff" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("circle", { cx: "67.3", cy: "68.7", r: "1.2", fill: "#ffffff" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M52 82 q4 -4 8 0", stroke: "#1e2a3a", strokeWidth: "1.8", strokeLinecap: "round", fill: "none" })
          ] }) : /* @__PURE__ */ (0, import_jsx_runtime8.jsxs)(import_jsx_runtime8.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M40 70 q4 4 8 0", stroke: "#1e2a3a", strokeWidth: "2", strokeLinecap: "round", fill: "none" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M62 70 q4 4 8 0", stroke: "#1e2a3a", strokeWidth: "2", strokeLinecap: "round", fill: "none" }),
            /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("path", { d: "M52 80 q4 4 8 0", stroke: "#1e2a3a", strokeWidth: "1.8", strokeLinecap: "round", fill: "none" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ellipse", { cx: "36", cy: "78", rx: "4", ry: "2.4", fill: "#ffb3c1", opacity: "0.75" }),
          /* @__PURE__ */ (0, import_jsx_runtime8.jsx)("ellipse", { cx: "74", cy: "78", rx: "4", ry: "2.4", fill: "#ffb3c1", opacity: "0.75" })
        ] }),
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
