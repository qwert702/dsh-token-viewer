// Regenerates lib/client.js for dsh-token-viewer by vendoring the CURRENT
// installed @deepseek-ai/dsh-client-ui-sidebar client bundle (byte-faithful
// shell: CSS + SidebarRoot + shell locales) and merging in:
//   - a forked sidebar shell registration with one extra child slot
//     `sidebar.workspaces.header` rendered ABOVE the workspaces region
//   - the SidebarTokenPanel (aggregate token consumption across sessions)
//   - the existing TokenDock strip in the composer dock
//
// Run:  node scripts/build-client.mjs   (after a dsh upgrade to re-vendor)
// The sidebar bundle is resolved from $DSH_SIDEBAR_BUNDLE, else probed from
// the harness install locations; commit the regenerated lib/client.js.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const dir = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(dir, '..');
const outFile = path.join(pkgRoot, 'lib', 'client.js');

const candidates = [
  path.join(os.homedir(), '.dsh', 'profiles', 'node_modules', '@deepseek-ai', 'dsh-client-ui-sidebar', 'lib', 'client.js'),
  'C:/Program Files/@deepseek-ai/dsh/profiles/node_modules/@deepseek-ai/dsh-client-ui-sidebar/lib/client.js',
];
const sidebarBundle = process.env.DSH_SIDEBAR_BUNDLE ?? candidates.find((c) => existsSync(c));
if (sidebarBundle === undefined) {
  throw new Error(
    'could not locate the @deepseek-ai/dsh-client-ui-sidebar client bundle; ' +
    'set DSH_SIDEBAR_BUNDLE to its lib/client.js path',
  );
}

const src = readFileSync(sidebarBundle, 'utf8');

// ---- split the vendored bundle -------------------------------------------
const cssMarker = '//#region \\0dsh-css:';
const tailMarker = '//#region lib/types/client/index.js';
const closeMarker = 'return module.exports;';

const cssStart = src.indexOf(cssMarker);
const tailStart = src.indexOf(tailMarker);
const closeStart = src.indexOf(closeMarker);
if (cssStart < 0 || tailStart < 0 || closeStart < 0) {
  throw new Error('could not find vendored bundle markers');
}

let head = src.slice(0, cssStart);          // loader open + requires
let body = src.slice(cssStart, tailStart);  // CSS + SidebarRoot + shell locales
const tailClose = src.slice(closeStart);    // "return module.exports;" ... "});"

// ---- head: point the loader id at this package ---------------------------
head = head.replace(
  'id: "@deepseek-ai/dsh-client-ui-sidebar",',
  'id: "dsh-token-viewer",',
);
head = head.replace(
  'let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");',
  'let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");\n\t\tlet _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");',
);

// ---- body: namespace the vendored CSS tags -------------------------------
body = body.replace(
  'const tagId = "@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css";',
  'const tagId = "dsh-token-viewer/sidebar/SidebarRoot.module.css";',
);
body = body.replace(
  'tag.dataset.plugin = "@deepseek-ai/dsh-client-ui-sidebar";',
  'tag.dataset.plugin = "dsh-token-viewer";',
);

// ---- body: render the new header slot above the workspaces region --------
const regionRe = /children: renderSlot\("sidebar\.workspaces", \{\s*wide,\s*expandSidebar: \(\) => \{\s*if \(collapsed\) toggleSidebar\(\);\s*\}\s*\}\)/;
if (!regionRe.test(body)) throw new Error('sidebar region render pattern not found');
body = body.replace(regionRe,
  'children: [renderSlot("sidebar.workspaces.header", { wide }), renderSlot("sidebar.workspaces", {\n' +
  '\t\t\t\t\t\t\twide,\n' +
  '\t\t\t\t\t\t\texpandSidebar: () => {\n' +
  '\t\t\t\t\t\t\t\tif (collapsed) toggleSidebar();\n' +
  '\t\t\t\t\t\t\t}\n' +
  '\t\t\t\t\t\t})]');

// ---- merged tail: token panel + dock + registrations ---------------------
const tail = `		//#region dsh-token-viewer/locales
		/** \`tokenViewer\` namespace dictionaries (token panel + dock strip). */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const tokenZh = {
			"input": "输入",
			"output": "输出",
			"cacheHit": "缓存命中",
			"context": "上下文",
			"cacheRead": "缓存读",
			"cacheWrite": "缓存写",
			"uncached": "未缓存",
			"tokens": "tokens",
			"title": "Token 消耗",
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
			"model": "模型"
		};
		/** English dictionary, checked complete against the zh key set. */
		const tokenEn = {
			"input": "Input",
			"output": "Output",
			"cacheHit": "Cache hit",
			"context": "Context",
			"cacheRead": "cache read",
			"cacheWrite": "cache write",
			"uncached": "uncached",
			"tokens": "tokens",
			"title": "Token Usage",
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
			"model": "Model"
		};
		/** Dictionary namespace owned by this plugin's own surfaces. */
		const TOKEN_NS = "tokenViewer";
		/** Dictionary namespace of the vendored sidebar shell controls. */
		const NS = "sidebar";
		//#endregion
		//#region \\0dsh-css:dsh-token-viewer/TokenDock.module.css
		const dockCss = ".tvd_dock{box-sizing:border-box;width:calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset) - var(--dsh-composer-dock-inset));margin:0 auto}.tvd_bar{box-sizing:border-box;width:100%;max-width:calc(var(--dsh-composer-card-max-width) - 4 * var(--dsh-composer-dock-inset));min-height:26px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:10px;align-items:center;gap:14px;margin:0 auto;padding:3px 12px;display:flex;flex-wrap:wrap;justify-content:center}.tvd_seg{color:var(--dsw-alias-label-caption);flex:none;align-items:center;gap:4px;font-size:12px;line-height:20px;display:inline-flex;white-space:nowrap}.tvd_seg strong{color:var(--dsw-alias-label-secondary);font-weight:600}.tvd_sep{color:var(--dsw-alias-separator-primary);flex:none}.tvd_occ{align-items:center;gap:6px;display:inline-flex}.tvd_track{width:44px;height:3px;background:var(--dsw-alias-border-l1);border-radius:999px;overflow:hidden;flex:none}.tvd_fill{height:100%;background:var(--dsw-alias-state-business-primary);border-radius:999px}";
		const dockTagId = "dsh-token-viewer/TokenDock.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(dockTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-token-viewer";
			tag.dataset.pluginCss = dockTagId;
			tag.textContent = dockCss;
			document.head.appendChild(tag);
		}
		const tokenDockCss = {
			"dock": "tvd_dock",
			"bar": "tvd_bar",
			"seg": "tvd_seg",
			"sep": "tvd_sep",
			"occ": "tvd_occ",
			"track": "tvd_track",
			"fill": "tvd_fill"
		};
		//#endregion
		//#region \\0dsh-css:dsh-token-viewer/SidebarTokenPanel.module.css
		const panelCss = ".tvs_card{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-specific-tip);border-radius:10px;margin:2px 8px 6px;padding:7px 10px;flex:none;display:flex;flex-direction:column;gap:2px}.tvs_titleRow{flex:none;align-items:center;gap:8px;display:flex}.tvs_title{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-weight:600}.tvs_balance{margin-left:auto;color:var(--dsw-alias-label-primary);align-items:center;gap:4px;font-size:12px;line-height:16px;font-weight:600;display:inline-flex}.tvs_refresh{cursor:pointer;width:18px;height:18px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.tvs_refresh:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.tvs_balanceError{cursor:pointer;margin-left:auto;color:var(--dsw-alias-state-error-primary);align-items:center;gap:4px;font-size:11px;line-height:16px;display:inline-flex;background:0 0;border:none;padding:0}.tvs_detailButton{align-self:flex-start;color:var(--dsw-alias-state-business-primary);cursor:pointer;background:0 0;border:none;gap:4px;padding:0;font-size:11px;line-height:16px;display:inline-flex}.tvs_detailButton:hover{color:var(--dsw-alias-label-secondary)}.tvs_toggle{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;align-items:center;gap:4px;padding:0;font-size:11px;line-height:16px;display:inline-flex}.tvs_toggle:hover{color:var(--dsw-alias-label-secondary)}.tvs_rows{max-height:200px;overflow-y:auto;flex-direction:column;gap:2px;display:flex}.tvs_row{width:100%;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:center;gap:8px;padding:3px 6px;font-size:12px;line-height:18px;display:flex}.tvs_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.tvs_rowTitle{min-width:0;color:var(--dsw-alias-label-secondary);text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden;text-align:left}.tvs_rowTokens{flex:none;color:var(--dsw-alias-label-caption);white-space:nowrap}.tvs_line{flex-wrap:wrap;align-items:center;gap:2px 10px;display:flex}.tvs_seg{color:var(--dsw-alias-label-caption);font-size:12px;line-height:18px;white-space:nowrap;display:inline-flex;align-items:center;gap:3px}.tvs_seg strong{color:var(--dsw-alias-label-secondary);font-weight:600}";
		const panelTagId = "dsh-token-viewer/SidebarTokenPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(panelTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-token-viewer";
			tag.dataset.pluginCss = panelTagId;
			tag.textContent = panelCss;
			document.head.appendChild(tag);
		}
		const tokenSidebarCss = {
			"card": "tvs_card",
			"titleRow": "tvs_titleRow",
			"title": "tvs_title",
			"balance": "tvs_balance",
			"refresh": "tvs_refresh",
			"balanceError": "tvs_balanceError",
			"detailButton": "tvs_detailButton",
			"toggle": "tvs_toggle",
			"rows": "tvs_rows",
			"row": "tvs_row",
			"rowTitle": "tvs_rowTitle",
			"rowTokens": "tvs_rowTokens",
			"line": "tvs_line",
			"seg": "tvs_seg"
		};
		//#endregion
		//#region dsh-token-viewer/derive
		/**
		* Compact token count: 517 / 12.2K / 517K / 1.2M (one decimal under three digits).
		* Mirrors the conversation stats strip's formatter.
		* @param n - token count.
		* @returns display string.
		*/
		function formatTokens(n) {
			const scaled = (v) => v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
			if (n < 1e3) return String(n);
			if (n < 1e6) return \`\${scaled(n / 1e3)}K\`;
			return \`\${scaled(n / 1e6)}M\`;
		}
		/**
		* Sum the three disjoint prompt-side billing buckets.
		* @param usage - the session's token-usage projection value.
		* @returns billed input tokens.
		*/
		function billedInputTokens(usage) {
			return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
		}
		/**
		* Cache-hit share of prompt-side input over the whole durable log.
		* @param usage - the session's token-usage projection value.
		* @returns rounded integer percent, or null when no input was billed.
		*/
		function cacheHitPercent(usage) {
			const input = billedInputTokens(usage);
			return input === 0 ? null : Math.round(usage.cacheReadTokens / input * 100);
		}
		/**
		* Approximate context occupancy. The numerator is \`projectedTokens\` (the
		* provider sample carried forward over the surface's movement since, so
		* compaction shows immediately), falling back to the bare \`pressureTokens\`
		* sample; denominator is the newest known route capacity. This is a
		* user-facing reference figure, not a billing or gating input.
		* @param pressure - the session's context-pressure projection value.
		* @returns occupancy with numerator/denominator, or null until both are known.
		*/
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
		/**
		* Fold the three token-meter projections into one display snapshot.
		* @param usage - tokenUsage projection value (undefined before any usage).
		* @param pressure - contextPressure projection value.
		* @param breakdown - contextBreakdown projection value (unused in the strip; kept for tooltip detail).
		* @returns display snapshot, or null when there is nothing to show.
		*/
		function deriveTokenView(usage, pressure, breakdown) {
			if (usage === void 0 || usage === null) return null;
			const uncached = usage.uncachedInputTokens;
			const cacheRead = usage.cacheReadTokens;
			const cacheWrite = usage.cacheWriteTokens;
			const output = usage.outputTokens;
			const input = uncached + cacheRead + cacheWrite;
			if (input <= 0 && output <= 0) return null;
			return {
				input,
				uncached,
				cacheRead,
				cacheWrite,
				output,
				cacheHit: cacheHitPercent(usage),
				occupancy: contextOccupancy(pressure),
				breakdown
			};
		}
		/**
		* Aggregate tokenUsage across every session row's projection values.
		* @param byId - SessionListState.byId snapshot.
		* @returns summed buckets and the number of sessions that reported usage.
		*/
		function deriveSidebarTotals(byId, sinceMs) {
			if (sinceMs === void 0) sinceMs = 0;
			let uncached = 0;
			let cacheRead = 0;
			let cacheWrite = 0;
			let output = 0;
			let sessions = 0;
			for (const key of Object.keys(byId)) {
				const summary = byId[key];
				if (summary === void 0) continue;
				if (sinceMs > 0 && summary.updatedAt < sinceMs) continue;
				const usage = summary?.projectionValues?.tokenUsage;
				if (usage === void 0 || usage === null) continue;
				uncached += usage.uncachedInputTokens;
				cacheRead += usage.cacheReadTokens;
				cacheWrite += usage.cacheWriteTokens;
				output += usage.outputTokens;
				sessions += 1;
			}
			return { uncached, cacheRead, cacheWrite, output, sessions };
		}
		/**
		* Per-session rows for the expandable list: one row per session that
		* reported usage, ordered by total consumption (highest first).
		* @param byId - SessionListState.byId snapshot.
		* @returns rows with display title and billed input/output totals.
		*/
		function derivePerSession(byId, sinceMs) {
			if (sinceMs === void 0) sinceMs = 0;
			const rows = [];
			for (const key of Object.keys(byId)) {
				const summary = byId[key];
				if (summary === void 0) continue;
				if (sinceMs > 0 && summary.updatedAt < sinceMs) continue;
				const usage = summary?.projectionValues?.tokenUsage;
				if (usage === void 0 || usage === null) continue;
				const input = usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
				const output = usage.outputTokens;
				if (input <= 0 && output <= 0) continue;
				rows.push({
					id: summary?.id ?? key,
					title: summary?.displayTitle ?? key,
					input,
					output,
					cacheRead: usage.cacheReadTokens,
					total: input + output,
					cost: sessionCost(summary, usage),
					updatedAt: summary.updatedAt
				});
			}
			rows.sort((a, b) => b.total - a.total);
			return rows;
		}
		/**
		* Currency symbol for the balance row; falls back to the ISO code.
		* @param currency - ISO 4217 code from the provider.
		* @returns display symbol.
		*/
		function currencySymbol(currency) {
			if (currency === "CNY") return "¥";
			if (currency === "USD") return "$";
			if (currency === "EUR") return "€";
			return currency === null || currency === void 0 ? "" : currency + " ";
		}
		/**
		* Two-decimal money formatting for balance figures.
		* @param value - balance amount.
		* @returns fixed two-decimal string, or an em dash for non-finite values.
		*/
		function formatMoney(value) {
			const n = Number(value);
			return Number.isFinite(n) ? n.toFixed(2) : "—";
		}
		/** Default prices: DeepSeek V4-Flash off-peak list price, CNY per 1M tokens. */
		let DEFAULT_TOKEN_PRICES = { inputPerM: 1.5, outputPerM: 4.5, cacheReadPerM: 0.05, cacheWritePerM: 1.5 };
		/**
		* Estimate cost (CNY) from one usage bucket under the given prices. Each
		* bucket bills exactly once (CC Switch's Claude-semantics calculator):
		* cache writes bill at their own price (the cache-miss rate), not again
		* at the uncached input price.
		* @param usage - a token-usage projection value.
		* @param prices - per-million-token prices (defaults to V4-Flash off-peak).
		* @returns estimated cost in CNY.
		*/
		function estimateCost(usage, prices) {
			if (prices === void 0) prices = DEFAULT_TOKEN_PRICES;
			return usage.uncachedInputTokens / 1e6 * prices.inputPerM
				+ usage.outputTokens / 1e6 * prices.outputPerM
				+ usage.cacheReadTokens / 1e6 * prices.cacheReadPerM
				+ usage.cacheWriteTokens / 1e6 * prices.cacheWritePerM;
		}
		/**
		* Per-model list prices from the provider's pricing page (V4-Flash-0731
		* and V4-Pro-0813, CNY per 1M tokens; peak is double the off-peak rate).
		* Cache writes bill at the cache-miss (uncached input) rate.
		*/
		let MODEL_PRICING = {
			"deepseek-v4-flash": {
				offPeak: { inputPerM: 1.5, outputPerM: 4.5, cacheReadPerM: 0.05, cacheWritePerM: 1.5 },
				peak: { inputPerM: 3, outputPerM: 9, cacheReadPerM: 0.1, cacheWritePerM: 3 }
			},
			"deepseek-v4-pro": {
				offPeak: { inputPerM: 4.5, outputPerM: 13.5, cacheReadPerM: 0.15, cacheWritePerM: 4.5 },
				peak: { inputPerM: 9, outputPerM: 27, cacheReadPerM: 0.3, cacheWritePerM: 9 }
			}
		};
		/**
		* Whether a timestamp falls in the provider's peak window — Beijing time
		* 09:00-12:00 and 14:00-18:00, converted explicitly so hosts in other
		* timezones price correctly.
		* @param t - epoch ms.
		* @returns true inside a peak window.
		*/
		function isPeakHour(t) {
			const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Shanghai", hourCycle: "h23", hour: "numeric" }).format(new Date(t)));
			return (hour >= 9 && hour < 12) || (hour >= 14 && hour < 18);
		}
		/**
		* Resolve the price table for one request: exact model id first, then the
		* longest table key the id starts with (versioned ids), then the
		* V4-Flash off-peak default.
		* @param model - the request's model id.
		* @param t - the request's commit time, selecting the peak or off-peak tier.
		* @returns the per-million-token prices to bill under.
		*/
		function pricesForModel(model, t) {
			const key = model in MODEL_PRICING ? model
				: Object.keys(MODEL_PRICING)
					.filter((candidate) => model.startsWith(candidate))
					.sort((a, b) => b.length - a.length)[0];
			if (key === void 0) return DEFAULT_TOKEN_PRICES;
			return isPeakHour(t) ? MODEL_PRICING[key].peak : MODEL_PRICING[key].offPeak;
		}
		/**
		* Estimate one request's cost under its own model's peak/off-peak list
		* price — the per-model refinement of the four-bucket calculator.
		* @param usage - the request's token buckets.
		* @param model - the request's model id.
		* @param t - the request's commit time.
		* @returns estimated cost in CNY.
		*/
		function estimateRequestCost(usage, model, t) {
			return estimateCost(usage, pricesForModel(model, t));
		}
		/**
		* Apply a remote pricing table (from the host /api/billing/pricing
		* route) when it covers any known model; unknown tables are ignored so
		* the built-in prices always remain the floor.
		* @param rows - the remote table keyed by model id.
		*/
		function applyRemotePricing(rows) {
			if (rows === void 0 || rows === null || typeof rows !== "object") return;
			let changed = false;
			for (const model of Object.keys(MODEL_PRICING)) {
				const row = rows[model];
				if (row === void 0 || row.offPeak === void 0 || row.peak === void 0) continue;
				if (row.offPeak.inputPerM > 0 && row.offPeak.outputPerM > 0) {
					MODEL_PRICING[model] = { offPeak: row.offPeak, peak: row.peak };
					changed = true;
				}
			}
			if (changed && MODEL_PRICING["deepseek-v4-flash"] !== void 0) {
				DEFAULT_TOKEN_PRICES = MODEL_PRICING["deepseek-v4-flash"].offPeak;
			}
		}
		/**
		* One-shot fetch of the host pricing route: applies official prices when
		* available, silently keeps the built-in table otherwise.
		*/
		function useRemotePricing() {
			(0, react.useEffect)(() => {
				let cancelled = false;
				fetch("/api/billing/pricing")
					.then((response) => response.json().catch(() => null))
					.then((body) => {
						if (cancelled) return;
						if (body !== null && body.ok === true && body.source === "official") {
							applyRemotePricing(body.rows);
						}
					})
					.catch(() => {});
				return () => { cancelled = true; };
			}, []);
		}
		/**
		* Per-session cost for the sidebar rows: the session's modelUsage buckets
		* priced at their own model's rate when reported, else the default table
		* over the cumulative total.
		* @param summary - one session row.
		* @param usage - the session's cumulative tokenUsage value.
		* @returns estimated cost in CNY.
		*/
		function sessionCost(summary, usage) {
			const byModel = summary?.projectionValues?.modelUsage?.byModel;
			if (byModel === void 0 || Object.keys(byModel).length === 0) return estimateCost(usage);
			let cost = 0;
			for (const model of Object.keys(byModel)) {
				cost += estimateRequestCost(byModel[model], model, summary.updatedAt);
			}
			return cost;
		}
		/**
		* Compact CNY cost: two decimals at and above ¥0.01, four below.
		* @param value - cost in CNY.
		* @returns display string with the ¥ symbol.
		*/
		function formatCost(value) {
			const n = Number(value);
			if (!Number.isFinite(n)) return "¥—";
			return n >= 0.01 ? "¥" + n.toFixed(2) : "¥" + n.toFixed(4);
		}
		/** Milliseconds in one day. */
		const DAY_MS = 24 * 60 * 60 * 1000;
		/**
		* CC Switch range presets: the day, fixed lookback windows, everything.
		* "today" spans local midnight to now; the N-day presets start at the
		* local midnight of (N - 1) days back; "all" has no lower bound.
		* @param range - selected preset.
		* @param nowMs - clock the range resolves against.
		* @returns inclusive start (0 for all) and end in epoch ms.
		*/
		function resolveUsageRange(range, nowMs) {
			if (nowMs === void 0) nowMs = Date.now();
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
		/**
		* Collect every session's per-request records within the range (the CC
		* Switch statistics method folds per-request usageLog records, never
		* cumulative session totals). Sessions from before the usageLog
		* projection existed fall back to one synthesized record per session at
		* its last activity, modeled from the cumulative tokenUsage and the
		* session's modelUsage model.
		* @param byId - SessionListState.byId snapshot.
		* @param range - selected preset.
		* @param nowMs - clock the range resolves against.
		* @returns records with session identity and per-record cost attached.
		*/
		function collectRequestRecords(byId, range, nowMs) {
			if (nowMs === void 0) nowMs = Date.now();
			const bounds = resolveUsageRange(range, nowMs);
			const inRange = (t) => t >= bounds.startDate && t <= bounds.endDate;
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
					cost: estimateRequestCost({ uncachedInputTokens: entry.i, outputTokens: entry.o, cacheReadTokens: entry.r, cacheWriteTokens: entry.w }, entry.m, entry.t)
				});
			};
			let logged = false;
			for (const summary of summaries) {
				const entries = summary?.projectionValues?.usageLog?.entries;
				if (entries !== void 0 && entries.length > 0) { logged = true; break; }
			}
			if (logged) {
				for (const summary of summaries) {
					const entries = summary?.projectionValues?.usageLog?.entries ?? [];
					for (const entry of entries) {
						if (inRange(entry.t)) push(summary, entry);
					}
				}
				return records;
			}
			for (const summary of summaries) {
				const usage = summary?.projectionValues?.tokenUsage;
				if (usage === void 0 || usage === null) continue;
				if (usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens + usage.outputTokens <= 0) continue;
				const models = Object.keys(summary?.projectionValues?.modelUsage?.byModel ?? {});
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
		/**
		* CC Switch's summary: realTotal counts all four buckets; the hit rate
		* denominates on the cacheable input side only.
		* @param records - per-request records in the range.
		* @returns the summary figures.
		*/
		function usageSummary(records) {
			let requests = 0, cost = 0, input = 0, output = 0, cacheWrite = 0, cacheRead = 0;
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
				requests: requests,
				cost: cost,
				input: input,
				output: output,
				cacheWrite: cacheWrite,
				cacheRead: cacheRead,
				realTotal: input + output + cacheWrite + cacheRead,
				cacheHitRate: cacheable > 0 ? cacheRead / cacheable : 0
			};
		}
		/**
		* CC Switch usage trend: requests bucketed by their own commit time —
		* hourly when the range spans one day, daily otherwise — with every
		* bucket in the range materialized, empty ones zero-filled.
		* @param records - per-request records.
		* @param range - selected preset.
		* @param nowMs - clock the range resolves against.
		* @returns the range's buckets in ascending time order.
		*/
		function usageTrend(records, range, nowMs) {
			if (nowMs === void 0) nowMs = Date.now();
			const bounds = resolveUsageRange(range, nowMs);
			const bucketMs = range === "today" ? 60 * 60 * 1000 : DAY_MS;
			const bucketCount = range === "today"
				? Math.max(1, Math.ceil((bounds.endDate - bounds.startDate) / bucketMs))
				: Math.floor((bounds.endDate - bounds.startDate) / DAY_MS) + 1;
			const buckets = [];
			for (let index = 0; index < bucketCount; index += 1) {
				const t = bounds.startDate + index * bucketMs;
				const d = new Date(t);
				buckets.push({
					t: t,
					label: range === "today" ? String(d.getHours()).padStart(2, "0") + ":00" : (d.getMonth() + 1) + "/" + d.getDate(),
					requests: 0, cost: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, total: 0
				});
			}
			for (const record of records) {
				if (record.t < bounds.startDate || record.t > bounds.endDate) continue;
				const index = Math.min(bucketCount - 1, Math.floor((record.t - bounds.startDate) / bucketMs));
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
		/**
		* Per-model rows in CC Switch's shape: request count, fresh-input-plus-
		* output tokens, total and average cost, ordered by total cost descending.
		* @param records - per-request records in the range.
		* @returns one row per model that billed in the range.
		*/
		function modelStats(records) {
			const acc = new Map();
			for (const record of records) {
				const model = record.model === "" ? "—" : record.model;
				const prev = acc.get(model);
				const next = prev ?? { model: model, requests: 0, totalTokens: 0, cost: 0, avgCost: 0 };
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
		/**
		* Per-workspace rows folded from per-request records, in workspace order
		* with an "ungrouped" row trailing for sessions in no workspace.
		* @param workspaces - WorkspaceListState.items snapshot (host order).
		* @param records - per-request records in the range.
		* @returns rows with per-workspace requests, token buckets, and cost.
		*/
		function projectStats(workspaces, records) {
			const rows = [];
			const bySession = new Map();
			for (const workspace of workspaces) {
				const row = { id: workspace.workspaceId, title: workspace.title || workspace.workspaceId, requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
				rows.push(row);
				for (const id of workspace.sessionIds) bySession.set(id, row);
			}
			const ungrouped = { id: "ungrouped", title: "ungrouped", requests: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0, cost: 0 };
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
		/**
		* Request-log rows: every record in the range, newest first (CC Switch
		* orders by created_at descending).
		* @param records - per-request records in the range.
		* @returns records sorted by commit time descending.
		*/
		function requestLogRows(records) {
			return [...records].sort((a, b) => b.t - a.t);
		}
		/**
		* CC Switch's compact token count: Chinese locale renders 万/亿
		* magnitudes, the default renders K/M/B. decimals is 1 for card
		* sub-figures and 2 for the hero's precise chip.
		* @param value - token count.
		* @param zh - whether the active locale renders Chinese magnitudes.
		* @param decimals - fractional digits on the magnitude.
		* @returns the compact display string, "0" for non-positive values.
		*/
		function formatTokensShort(value, zh, decimals) {
			if (decimals === void 0) decimals = 1;
			if (!Number.isFinite(value) || value <= 0) return "0";
			if (zh) {
				if (value >= 1e8) return (value / 1e8).toFixed(2) + " 亿";
				if (value >= 1e4) return (value / 1e4).toFixed(decimals) + " 万";
				return value.toLocaleString();
			}
			if (value >= 1e9) return (value / 1e9).toFixed(2) + "B";
			if (value >= 1e6) return (value / 1e6).toFixed(2) + "M";
			if (value >= 1e3) return (value / 1e3).toFixed(decimals) + "K";
			return value.toLocaleString();
		}
		/**
		* Fixed-decimal cost for the CC Switch tables: totals render four
		* decimals, per-request averages six.
		* @param value - cost in CNY.
		* @param digits - fractional digits.
		* @returns the ¥-prefixed string, "¥--" for non-finite values.
		*/
		function formatCostExact(value, digits) {
			const n = Number(value);
			return Number.isFinite(n) ? "¥" + n.toFixed(digits) : "¥--";
		}
		//#endregion
		//#region dsh-token-viewer/TokenDock.js
		/**
		* TokenDock: a slim live strip docked above the composer showing what the
		* current session has consumed — billed input (uncached + cache read +
		* cache write), cache hit rate, output, and approximate context occupancy
		* with a mini progress bar. Renders nothing until a provider reports usage.
		*/
		const TokenDock = (0, react.memo)(function TokenDock({ useProjection, t }) {
			const usage = useProjection("tokenUsage");
			const pressure = useProjection("contextPressure");
			const breakdown = useProjection("contextBreakdown");
			const view = (0, react.useMemo)(() => deriveTokenView(usage, pressure, breakdown), [usage, pressure, breakdown]);
			if (view === null) return null;
			const segments = [];
			const push = (node) => {
				if (segments.length > 0) {
					segments.push(react_jsx_runtime.jsx("span", { className: tokenDockCss.sep, children: "\\u00b7" }, "sep-" + segments.length));
				}
				segments.push(node);
			};
			if (view.input > 0) {
				push(react_jsx_runtime.jsx("span", { className: tokenDockCss.seg, children: [t("input"), " ", react_jsx_runtime.jsx("strong", { children: formatTokens(view.input) }, "v")] }, "input"));
			}
			if (view.output > 0) {
				push(react_jsx_runtime.jsx("span", { className: tokenDockCss.seg, children: [t("output"), " ", react_jsx_runtime.jsx("strong", { children: formatTokens(view.output) }, "v")] }, "output"));
			}
			if (view.cacheHit !== null) {
				push(react_jsx_runtime.jsx("span", { className: tokenDockCss.seg, children: [t("cacheHit"), " ", react_jsx_runtime.jsx("strong", { children: view.cacheHit + "%" }, "v")] }, "cacheHit"));
			}
			if (view.occupancy !== null) {
				const occ = view.occupancy;
				push(react_jsx_runtime.jsx("span", {
					className: tokenDockCss.seg,
					children: [t("context"), " ", react_jsx_runtime.jsx("strong", { children: occ.percent + "%" }, "v"), react_jsx_runtime.jsx("span", {
						className: tokenDockCss.occ,
						children: react_jsx_runtime.jsx("span", {
							className: tokenDockCss.track,
							children: react_jsx_runtime.jsx("span", { className: tokenDockCss.fill, style: { width: occ.percent + "%" } })
						})
					}, "track")]
				}, "context"));
			}
			const tooltipLines = [
				\`\${t("input")}: \${formatTokens(view.input)} \${t("tokens")} (\${t("uncached")} \${formatTokens(view.uncached)} \\u00b7 \${t("cacheRead")} \${formatTokens(view.cacheRead)} \\u00b7 \${t("cacheWrite")} \${formatTokens(view.cacheWrite)})\`,
				\`\${t("output")}: \${formatTokens(view.output)} \${t("tokens")}\`
			];
			if (view.cacheHit !== null) tooltipLines.push(\`\${t("cacheHit")}: \${view.cacheHit}%\`);
			if (view.occupancy !== null) tooltipLines.push(\`\${t("context")}: \${formatTokens(view.occupancy.usedTokens)} / \${formatTokens(view.occupancy.contextWindow)} \${t("tokens")} (\${view.occupancy.percent}%)\`);
			return react_jsx_runtime.jsx("div", {
				className: tokenDockCss.dock,
				"data-token-viewer": "",
				title: tooltipLines.join("\\n"),
				children: react_jsx_runtime.jsx("div", { className: tokenDockCss.bar, children: segments })
			});
		});
		//#endregion
		//#region dsh-token-viewer/balance.js
		/** Browser fetch of the host's balance proxy (never touches the API key). */
		const BALANCE_URL = "/api/billing/balance";
		/**
		* One-shot balance fetch with a refresh verb. Component-internal hook:
		* subscribes to nothing external; the host route is the data source.
		* @returns the fetch state machine plus the refresh callback.
		*/
		function useBalance() {
			const [state, setState] = react.useState({ status: "loading" });
			const inFlight = (0, react.useRef)(false);
			const load = (0, react.useCallback)(() => {
				if (inFlight.current) return;
				inFlight.current = true;
				setState({ status: "loading" });
				fetch(BALANCE_URL)
					.then(async (response) => {
						const body = await response.json().catch(() => null);
						if (response.ok && body !== null && body.ok === true) {
							setState({ status: "ok", balance: body });
						} else {
							setState({ status: "error", error: body === null || body.error === void 0 ? "provider-error" : body.error.code });
						}
					})
					.catch(() => { setState({ status: "error", error: "network" }); })
					.finally(() => { inFlight.current = false; });
			}, []);
			(0, react.useEffect)(() => { load(); }, [load]);
			return { state, refresh: load };
		}
		/**
		* Pure balance row: the currency figure with a refresh control, or an
		* error-retry control when the host proxy reported a failure. Loading
		* renders nothing (the card still shows usage while it resolves).
		* @param props - balance fetch state, refresh verb, and locale seat.
		* @returns the balance row element, or null while loading.
		*/
		function BalanceRow({ balance, onRefresh, t }) {
			if (balance.status === "ok" && balance.balance !== null) {
				return react_jsx_runtime.jsx("span", {
					className: tokenSidebarCss.balance,
					title: \`\${t("balance")}: \${currencySymbol(balance.balance.currency)}\${formatMoney(balance.balance.totalBalance)}\`,
					children: [
						currencySymbol(balance.balance.currency) + formatMoney(balance.balance.totalBalance),
						react_jsx_runtime.jsx("button", { type: "button", className: tokenSidebarCss.refresh, onClick: onRefresh, "aria-label": t("refresh"), children: "⟳" }, "ref")
					]
				});
			}
			if (balance.status === "error") {
				return react_jsx_runtime.jsx("button", {
					type: "button",
					className: tokenSidebarCss.balanceError,
					onClick: onRefresh,
					title: balance.error,
					children: [t("balanceUnavailable"), " ", "⟳"]
				});
			}
			return null;
		}
		//#endregion
		//#region dsh-token-viewer/PerSessionList.js
		/**
		* Pure expandable per-conversation list: a toggle row plus, when open, one
		* row per session (display title + billed input/output, highest total
		* first). Clicking a row opens that session.
		* @param props - rows, open flag, toggle/open verbs, and the locale seat.
		* @returns nothing for an empty list; otherwise the toggle plus rows.
		*/
		function PerSessionList({ rows, open, onToggle, onOpen, t }) {
			if (rows.length === 0) return null;
			return react_jsx_runtime.jsx("div", {
				children: [
					react_jsx_runtime.jsx("button", {
						type: "button",
						className: tokenSidebarCss.toggle,
						onClick: onToggle,
						children: (open ? t("collapse") : t("expand")) + " " + t("perSession") + " (" + rows.length + ")"
					}, "toggle"),
					open && react_jsx_runtime.jsx("div", {
						className: tokenSidebarCss.rows,
						children: rows.map((row) => (
							react_jsx_runtime.jsx("button", {
								type: "button",
								className: tokenSidebarCss.row,
								onClick: () => { if (onOpen !== void 0) onOpen(row.id); },
								title: row.title,
								children: [
									react_jsx_runtime.jsx("span", { className: tokenSidebarCss.rowTitle, children: row.title }, "rt"),
									react_jsx_runtime.jsx("span", { className: tokenSidebarCss.rowTokens, children: "↑" + formatTokens(row.input) + " · ↓" + formatTokens(row.output) }, "rtk")
								]
							}, row.id)
						))
					}, "rowsInner")
				]
			});
		}
		//#endregion
		//#region dsh-token-viewer/token-detail-store.js
		/**
		* Shared open/close state for the token-usage detail panel: created once
		* in apply() and passed to both the sidebar card (opens it) and the
		* shell.overlay panel (renders while open), so the two entries share one
		* handle without module-level state.
		*/
		function createTokenDetailStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({ open: false }),
				actions: {
					setOpen: (d, open) => { d.open = open; }
				}
			});
		}
		//#endregion
		const detailCss = ".tdd_backdrop{position:fixed;inset:0;background:rgb(0 0 0 / .35);justify-content:flex-end;display:flex}.tdd_panel{box-sizing:border-box;width:min(600px,94vw);height:100%;background:var(--dsw-alias-bg-base);border-left:1px solid var(--dsw-alias-border-l1);box-shadow:-12px 0 32px rgb(0 0 0 / .25);flex-direction:column;display:flex;overflow:hidden}.tdd_header{flex:none;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex}.tdd_headerTitle{color:var(--dsw-alias-label-primary);flex:1;font-size:14px;font-weight:600;line-height:20px}.tdd_close{cursor:pointer;width:28px;height:28px;color:var(--dsw-alias-label-tertiary);background:0 0;border:none;border-radius:50%;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.tdd_close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}.tdd_body{flex:1;min-height:0;flex-direction:column;gap:14px;padding:12px 14px;display:flex;overflow-y:auto}.tdd_toolbar{flex:none;align-items:center;gap:10px;display:flex}.tdd_toolbarLabel{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}.tdd_segmented{border:1px solid var(--dsw-alias-border-l2);border-radius:8px;align-items:center;padding:2px;display:inline-flex}.tdd_segment,.tdd_segmentActive{cursor:pointer;border:none;border-radius:6px;padding:3px 10px;font-size:12px;line-height:18px}.tdd_segment{color:var(--dsw-alias-label-tertiary);background:0 0}.tdd_segment:hover{color:var(--dsw-alias-label-secondary)}.tdd_segmentActive{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-active);font-weight:600}.tdd_hero{flex:none;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-specific-tip);flex-direction:column;gap:10px;padding:12px;display:flex}.tdd_heroTop{align-items:center;justify-content:space-between;gap:12px;display:flex}.tdd_heroMain{min-width:0}.tdd_heroLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;margin-bottom:2px}.tdd_heroBigRow{align-items:baseline;gap:8px;display:flex}.tdd_heroBig{color:var(--dsw-alias-label-primary);font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;line-height:30px;letter-spacing:-.02em}.tdd_heroChip{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-interactive-bg-active);border-radius:6px;font-size:11px;font-weight:500;line-height:16px;padding:1px 6px;flex:none}.tdd_heroSide{align-items:center;gap:14px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);padding:8px 14px;display:flex;flex:none}.tdd_heroSideItem{flex-direction:column;gap:2px;display:flex}.tdd_heroSideLabel{color:var(--dsw-alias-label-caption);font-size:10px;font-weight:500;letter-spacing:.04em;line-height:14px;text-transform:uppercase}.tdd_heroSideValue{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;line-height:18px}.tdd_heroSideValueCost{color:var(--dsw-alias-state-business-primary);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;line-height:18px}.tdd_heroSideDivider{width:1px;height:26px;background:var(--dsw-alias-border-l2);flex:none}.tdd_heroGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.tdd_miniStat{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);flex-direction:column;gap:3px;padding:8px 10px;display:flex;min-width:0}.tdd_miniLabel{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tdd_miniValue{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;font-variant-numeric:tabular-nums;line-height:18px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tdd_hitRate{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-base);flex-direction:column;justify-content:center;gap:6px;padding:8px 10px;display:flex;min-width:0}.tdd_hitRateTop{align-items:center;justify-content:space-between;gap:6px;display:flex}.tdd_hitRateValue{color:#10b981;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;line-height:16px}.tdd_hitRateTrack{position:relative;height:6px;border-radius:999px;background:var(--dsw-alias-interactive-bg-active);overflow:hidden}.tdd_hitRateFill{position:absolute;inset:0 auto 0 0;border-radius:999px;background:#10b981}.tdd_section{flex:none;flex-direction:column;gap:6px;display:flex}.tdd_sectionTitle{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px;font-weight:600}.tdd_sectionHint{color:var(--dsw-alias-label-caption);font-weight:400}.tdd_legend{flex:none;align-items:center;gap:12px;display:flex;flex-wrap:wrap}.tdd_legendItem{color:var(--dsw-alias-label-caption);align-items:center;gap:4px;font-size:11px;line-height:16px;display:inline-flex}.tdd_legendItem i{width:8px;height:8px;border-radius:2px;flex:none;display:inline-block}.tdd_swatchInput{background:#3b82f6}.tdd_swatchOutput{background:#22c55e}.tdd_swatchCacheWrite{background:#f97316}.tdd_swatchCacheRead{background:#a855f7}.tdd_swatchCost{background:transparent;border:1px dashed #f43f5e}.tdd_chartWrap{position:relative;width:100%;padding-bottom:18px}.tdd_chartSvg{width:100%;height:108px;display:block}.tdd_chartEmpty{height:100px}.tdd_chartGrid{stroke:var(--dsw-alias-border-l2);stroke-dasharray:3 3;opacity:.5}.tdd_areaInput{fill:url(#tvAreaInput)}.tdd_areaOutput{fill:url(#tvAreaOutput)}.tdd_areaCacheWrite{fill:url(#tvAreaCacheWrite)}.tdd_areaCacheRead{fill:url(#tvAreaCacheRead)}.tdd_lineInput{fill:none;stroke:#3b82f6;stroke-width:1.5}.tdd_lineOutput{fill:none;stroke:#22c55e;stroke-width:1.5}.tdd_lineCacheWrite{fill:none;stroke:#f97316;stroke-width:1.5}.tdd_lineCacheRead{fill:none;stroke:#a855f7;stroke-width:1.5}.tdd_lineCost{fill:none;stroke:#f43f5e;stroke-width:1.5;stroke-dasharray:4 4}.tdd_chartHit{fill:transparent}.tdd_chartHit:hover{fill:rgb(0 0 0 / .04)}.tdd_chartLabel{position:absolute;bottom:0;transform:translateX(-50%);color:var(--dsw-alias-label-caption);font-size:10px;line-height:14px;white-space:nowrap}.tdd_tabs{align-items:center;gap:4px;border-bottom:1px solid var(--dsw-alias-border-l1);display:flex}.tdd_tab,.tdd_tabActive{cursor:pointer;border:none;background:0 0;padding:5px 10px;font-size:12px;line-height:18px;border-radius:6px 6px 0 0;border-bottom:2px solid transparent}.tdd_tab{color:var(--dsw-alias-label-tertiary)}.tdd_tab:hover{color:var(--dsw-alias-label-secondary)}.tdd_tabActive{color:var(--dsw-alias-label-primary);font-weight:600;border-bottom-color:var(--dsw-alias-state-business-primary)}.tdd_table{flex-direction:column;display:flex}.tdd_tableHead,.tdd_tableRow,.tdd_logRow{width:100%;align-items:center;gap:8px;padding:4px 6px;font-size:12px;line-height:18px;display:flex;box-sizing:border-box}.tdd_tableHead{color:var(--dsw-alias-label-caption);font-weight:600}.tdd_tableRow{color:var(--dsw-alias-label-secondary)}.tdd_logRow{cursor:pointer;color:var(--dsw-alias-label-secondary);background:0 0;border:none;border-radius:6px;text-align:left}.tdd_logRow:hover{background:var(--dsw-alias-interactive-bg-hover)}.tdd_colTime{flex:none;width:78px;color:var(--dsw-alias-label-caption);white-space:nowrap}.tdd_colProject,.tdd_colSession,.tdd_colModel{min-width:0;text-overflow:ellipsis;white-space:nowrap;flex:1;overflow:hidden}.tdd_colNum{flex:none;width:62px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}";
		const detailTagId = "dsh-token-viewer/TokenDetailPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(detailTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-token-viewer";
			tag.dataset.pluginCss = detailTagId;
			tag.textContent = detailCss;
			document.head.appendChild(tag);
		}
		const tokenDetailCss = {
			"backdrop": "tdd_backdrop",
			"panel": "tdd_panel",
			"header": "tdd_header",
			"headerTitle": "tdd_headerTitle",
			"close": "tdd_close",
			"body": "tdd_body",
			"toolbar": "tdd_toolbar",
			"toolbarLabel": "tdd_toolbarLabel",
			"segmented": "tdd_segmented",
			"segment": "tdd_segment",
			"segmentActive": "tdd_segmentActive",
			"hero": "tdd_hero",
			"heroTop": "tdd_heroTop",
			"heroMain": "tdd_heroMain",
			"heroLabel": "tdd_heroLabel",
			"heroBigRow": "tdd_heroBigRow",
			"heroBig": "tdd_heroBig",
			"heroChip": "tdd_heroChip",
			"heroSide": "tdd_heroSide",
			"heroSideItem": "tdd_heroSideItem",
			"heroSideLabel": "tdd_heroSideLabel",
			"heroSideValue": "tdd_heroSideValue",
			"heroSideValueCost": "tdd_heroSideValueCost",
			"heroSideDivider": "tdd_heroSideDivider",
			"heroGrid": "tdd_heroGrid",
			"miniStat": "tdd_miniStat",
			"miniLabel": "tdd_miniLabel",
			"miniValue": "tdd_miniValue",
			"hitRate": "tdd_hitRate",
			"hitRateTop": "tdd_hitRateTop",
			"hitRateValue": "tdd_hitRateValue",
			"hitRateTrack": "tdd_hitRateTrack",
			"hitRateFill": "tdd_hitRateFill",
			"section": "tdd_section",
			"sectionTitle": "tdd_sectionTitle",
			"sectionHint": "tdd_sectionHint",
			"legend": "tdd_legend",
			"legendItem": "tdd_legendItem",
			"swatchInput": "tdd_swatchInput",
			"swatchOutput": "tdd_swatchOutput",
			"swatchCacheWrite": "tdd_swatchCacheWrite",
			"swatchCacheRead": "tdd_swatchCacheRead",
			"swatchCost": "tdd_swatchCost",
			"chartWrap": "tdd_chartWrap",
			"chartSvg": "tdd_chartSvg",
			"chartEmpty": "tdd_chartEmpty",
			"chartGrid": "tdd_chartGrid",
			"areaInput": "tdd_areaInput",
			"areaOutput": "tdd_areaOutput",
			"areaCacheWrite": "tdd_areaCacheWrite",
			"areaCacheRead": "tdd_areaCacheRead",
			"lineInput": "tdd_lineInput",
			"lineOutput": "tdd_lineOutput",
			"lineCacheWrite": "tdd_lineCacheWrite",
			"lineCacheRead": "tdd_lineCacheRead",
			"lineCost": "tdd_lineCost",
			"chartHit": "tdd_chartHit",
			"chartLabel": "tdd_chartLabel",
			"tabs": "tdd_tabs",
			"tab": "tdd_tab",
			"tabActive": "tdd_tabActive",
			"table": "tdd_table",
			"tableHead": "tdd_tableHead",
			"tableRow": "tdd_tableRow",
			"logRow": "tdd_logRow",
			"colTime": "tdd_colTime",
			"colProject": "tdd_colProject",
			"colSession": "tdd_colSession",
			"colModel": "tdd_colModel",
			"colNum": "tdd_colNum"
		};
		//#endregion
		//#region dsh-token-viewer/TokenDetailPanel.js
		/**
		* TokenDetailPanel: the right-side usage statistics drawer, a faithful
		* port of CC Switch's usage-dashboard method. Every figure folds
		* per-request usageLog records: a hero of real consumption / requests /
		* cost over the four-bucket minis and the cache-hit bar, a request-time
		* bucketed trend chart (four token series plus a dashed cost line), and
		* tabs for the request log (newest first), per-project statistics, and
		* per-model statistics with average cost. Range presets match CC Switch
		* exactly: the day, fixed N-day windows from the local midnight of
		* (N - 1) days back, and everything.
		*/
		/** Clock label for one request row (HH:MM, plus date when not today). */
		function clockLabel(updatedAt) {
			const d = new Date(updatedAt);
			const now = new Date();
			const pad = (n) => String(n).padStart(2, "0");
			const hhmm = pad(d.getHours()) + ":" + pad(d.getMinutes());
			const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
			return sameDay ? hhmm : pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + " " + hhmm;
		}
		/** One hero mini-stat card. */
		function MiniStat({ label, value, accent }) {
			return react_jsx_runtime.jsx("div", {
				className: tokenDetailCss.miniStat,
				children: [
					react_jsx_runtime.jsx("div", { className: tokenDetailCss.miniLabel, children: label }, "l"),
					react_jsx_runtime.jsx("div", { className: tokenDetailCss.miniValue, style: accent === void 0 ? void 0 : { color: accent }, children: value }, "v")
				]
			});
		}
		/**
		* The trend chart: the four token series as overlaid gradient areas on
		* one token axis plus the dashed cost line on its own scale, in CC
		* Switch's colors. Hovering a bucket shows its figures via the SVG title.
		* @param props - trend buckets and the locale seat.
		* @returns the chart wrapper with the SVG and percentage-placed labels.
		*/
		function TrendChart({ buckets, t }) {
			if (buckets.length === 0) return react_jsx_runtime.jsx("div", { className: tokenDetailCss.chartEmpty });
			const width = Math.max(280, buckets.length * 26);
			const height = 108;
			const pad = 2;
			const tokenMax = Math.max.apply(null, [1].concat(buckets.map((b) => Math.max(b.input, b.output, b.cacheWrite, b.cacheRead))));
			const costMax = Math.max.apply(null, [1e-9].concat(buckets.map((b) => b.cost)));
			const step = buckets.length > 1 ? (width - pad * 2) / (buckets.length - 1) : 0;
			const x = (i) => pad + i * step;
			const y = (v, max) => height - pad - (v / max) * (height - pad * 2);
			const line = (pick, max) => buckets.map((_, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + "," + y(pick(i), max).toFixed(1)).join(" ");
			const area = (pick, max) => line(pick, max) + " L" + x(buckets.length - 1).toFixed(1) + "," + (height - pad) + " L" + x(0).toFixed(1) + "," + (height - pad) + " Z";
			const labelEvery = Math.max(1, Math.ceil(buckets.length / 8));
			const grad = (id, color) => react_jsx_runtime.jsx("linearGradient", {
				id: id, x1: "0", y1: "0", x2: "0", y2: "1",
				children: [
					react_jsx_runtime.jsx("stop", { offset: "5%", stopColor: color, stopOpacity: 0.25 }, "a"),
					react_jsx_runtime.jsx("stop", { offset: "95%", stopColor: color, stopOpacity: 0 }, "b")
				]
			}, id);
			return react_jsx_runtime.jsx("div", {
				className: tokenDetailCss.chartWrap,
				children: [
					react_jsx_runtime.jsx("svg", {
						className: tokenDetailCss.chartSvg,
						viewBox: "0 0 " + width + " " + height,
						preserveAspectRatio: "none",
						role: "img",
						children: [
							react_jsx_runtime.jsx("defs", {
								children: [
									grad("tvAreaInput", "#3b82f6"),
									grad("tvAreaOutput", "#22c55e"),
									grad("tvAreaCacheWrite", "#f97316"),
									grad("tvAreaCacheRead", "#a855f7")
								]
							}, "defs"),
							[0.25, 0.5, 0.75].map((f) => react_jsx_runtime.jsx("line", {
								className: tokenDetailCss.chartGrid, x1: pad, x2: width - pad, y1: height * f, y2: height * f
							}, "g" + f)),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.areaInput, d: area((i) => buckets[i].input, tokenMax) }, "ai"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.areaOutput, d: area((i) => buckets[i].output, tokenMax) }, "ao"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.areaCacheWrite, d: area((i) => buckets[i].cacheWrite, tokenMax) }, "aw"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.areaCacheRead, d: area((i) => buckets[i].cacheRead, tokenMax) }, "ar"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.lineInput, d: line((i) => buckets[i].input, tokenMax) }, "li"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.lineOutput, d: line((i) => buckets[i].output, tokenMax) }, "lo"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.lineCacheWrite, d: line((i) => buckets[i].cacheWrite, tokenMax) }, "lw"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.lineCacheRead, d: line((i) => buckets[i].cacheRead, tokenMax) }, "lr"),
							react_jsx_runtime.jsx("path", { className: tokenDetailCss.lineCost, d: line((i) => buckets[i].cost, costMax) }, "lc"),
							buckets.map((bucket, i) => react_jsx_runtime.jsx("rect", {
								className: tokenDetailCss.chartHit,
								x: x(i) - step / 2,
								y: 0,
								width: Math.max(step, 6),
								height: height,
								children: react_jsx_runtime.jsx("title", {
									children: bucket.label + ": " + t("freshInput") + " " + bucket.input.toLocaleString()
										+ " \u00b7 " + t("output") + " " + bucket.output.toLocaleString()
										+ " \u00b7 " + t("cacheWrite") + " " + bucket.cacheWrite.toLocaleString()
										+ " \u00b7 " + t("cacheRead") + " " + bucket.cacheRead.toLocaleString()
										+ " \u00b7 " + t("totalCost") + " " + formatCostExact(bucket.cost, 4)
										+ " \u00b7 " + t("requests") + " " + bucket.requests
								})
							}, "h" + bucket.t))
						]
					}, "svg"),
					buckets.map((bucket, i) => (
						i % labelEvery === 0
							? react_jsx_runtime.jsx("span", {
								className: tokenDetailCss.chartLabel,
								style: { left: (buckets.length > 1 ? (i / (buckets.length - 1)) * 100 : 50) + "%" },
								children: bucket.label
							}, "l" + bucket.t)
							: null
					))
				]
			});
		}
		const TokenDetailPanel = (0, react.memo)(function TokenDetailPanel({ useStore, useSessions, useWorkspaces, actions, t, openSession }) {
			const open = useStore((state) => state.open);
			const byId = useSessions((state) => state.byId);
			const workspaceItems = useWorkspaces((state) => state.items);
			useRemotePricing();
			const [range, setRange] = react.useState("today");
			const [tab, setTab] = react.useState("logs");
			const now = (0, react.useMemo)(() => Date.now(), [range, byId]);
			const records = (0, react.useMemo)(() => collectRequestRecords(byId, range, now), [byId, range, now]);
			const summary = (0, react.useMemo)(() => usageSummary(records), [records]);
			const trend = (0, react.useMemo)(() => usageTrend(records, range, now), [records, range, now]);
			const models = (0, react.useMemo)(() => modelStats(records), [records]);
			const projects = (0, react.useMemo)(() => projectStats(workspaceItems, records), [workspaceItems, records]);
			const logs = (0, react.useMemo)(() => requestLogRows(records), [records]);
			const isZh = t("today") === "\u5f53\u5929";
			if (!open) return null;
			const close = () => { actions.setOpen(false); };
			const ranges = ["today", "7d", "14d", "30d", "all"];
			const rangeKeyOf = (r) => (r === "all" ? "all" : r === "today" ? "today" : r === "7d" ? "last7d" : r === "14d" ? "last14d" : "last30d");
			const bounds = resolveUsageRange(range, now);
			const hitPercent = Math.max(0, Math.min(100, summary.cacheHitRate * 100));
			const hitPercentLabel = hitPercent.toFixed(hitPercent >= 99.95 ? 0 : 1);
			const tabs = ["logs", "projects", "models"];
			const tabKeyOf = (k) => (k === "logs" ? "requestLogs" : k === "projects" ? "projectStats" : "modelStats");
			return react_jsx_runtime.jsx("div", {
				className: tokenDetailCss.backdrop,
				onClick: close,
				"data-token-detail": "",
				children: react_jsx_runtime.jsx("div", {
					className: tokenDetailCss.panel,
					role: "dialog",
					"aria-label": t("title"),
					onClick: (e) => { e.stopPropagation(); },
					children: [
						react_jsx_runtime.jsx("div", {
							className: tokenDetailCss.header,
							children: [
								react_jsx_runtime.jsx("div", { className: tokenDetailCss.headerTitle, children: t("title") }, "title"),
								react_jsx_runtime.jsx("button", { type: "button", className: tokenDetailCss.close, onClick: close, "aria-label": t("close"), children: "\u2715" }, "close")
							]
						}, "header"),
						react_jsx_runtime.jsx("div", {
							className: tokenDetailCss.body,
							children: [
								react_jsx_runtime.jsx("div", {
									className: tokenDetailCss.toolbar,
									children: [
										react_jsx_runtime.jsx("span", { className: tokenDetailCss.toolbarLabel, children: t("range") }, "rl"),
										react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.segmented, role: "group", "aria-label": t("range"),
											children: ranges.map((r) => react_jsx_runtime.jsx("button", {
												type: "button",
												className: range === r ? tokenDetailCss.segmentActive : tokenDetailCss.segment,
												onClick: () => { setRange(r); },
												children: t(rangeKeyOf(r))
											}, r))
										}, "seg")
									]
								}, "toolbar"),
								react_jsx_runtime.jsx("div", {
									className: tokenDetailCss.hero,
									children: [
										react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.heroTop,
											children: [
												react_jsx_runtime.jsx("div", {
													className: tokenDetailCss.heroMain,
													children: [
														react_jsx_runtime.jsx("div", { className: tokenDetailCss.heroLabel, children: t("realTotal") }, "hl"),
														react_jsx_runtime.jsx("div", {
															className: tokenDetailCss.heroBigRow,
															children: [
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.heroBig, title: summary.realTotal.toLocaleString(), children: summary.realTotal.toLocaleString() }, "big"),
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.heroChip, children: "\u2248 " + formatTokensShort(summary.realTotal, isZh, 2) }, "chip")
															]
														}, "row")
													]
												}, "main"),
												react_jsx_runtime.jsx("div", {
													className: tokenDetailCss.heroSide,
													children: [
														react_jsx_runtime.jsx("div", {
															className: tokenDetailCss.heroSideItem,
															children: [
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.heroSideLabel, children: t("requests") }, "a"),
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.heroSideValue, children: summary.requests.toLocaleString() }, "b")
															]
														}, "req"),
														react_jsx_runtime.jsx("div", { className: tokenDetailCss.heroSideDivider }, "div"),
														react_jsx_runtime.jsx("div", {
															className: tokenDetailCss.heroSideItem,
															children: [
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.heroSideLabel, children: t("totalCost") }, "a"),
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.heroSideValueCost, children: formatCostExact(summary.cost, 4) }, "b")
															]
														}, "cost")
													]
												}, "side")
											]
										}, "top"),
										react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.heroGrid,
											children: [
												react_jsx_runtime.jsx(MiniStat, { label: t("freshInput"), value: formatTokensShort(summary.input, isZh), accent: "#3b82f6" }, "in"),
												react_jsx_runtime.jsx(MiniStat, { label: t("output"), value: formatTokensShort(summary.output, isZh), accent: "#22c55e" }, "out"),
												react_jsx_runtime.jsx(MiniStat, { label: t("cacheWrite"), value: formatTokensShort(summary.cacheWrite, isZh), accent: "#f97316" }, "cw"),
												react_jsx_runtime.jsx(MiniStat, { label: t("cacheRead"), value: formatTokensShort(summary.cacheRead, isZh), accent: "#a855f7" }, "cr"),
												react_jsx_runtime.jsx("div", {
													className: tokenDetailCss.hitRate,
													children: [
														react_jsx_runtime.jsx("div", {
															className: tokenDetailCss.hitRateTop,
															children: [
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.miniLabel, children: t("cacheHitRate") }, "l"),
																react_jsx_runtime.jsx("span", { className: tokenDetailCss.hitRateValue, children: hitPercentLabel + "%" }, "v")
															]
														}, "top"),
														react_jsx_runtime.jsx("div", {
															className: tokenDetailCss.hitRateTrack,
															children: react_jsx_runtime.jsx("div", { className: tokenDetailCss.hitRateFill, style: { width: hitPercent + "%" } })
														}, "track")
													]
												}, "hit")
											]
										}, "grid")
									]
								}, "hero"),
								react_jsx_runtime.jsx("section", {
									className: tokenDetailCss.section,
									children: [
										react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.sectionTitle,
											children: [t("trend"), " ", react_jsx_runtime.jsx("span", {
												className: tokenDetailCss.sectionHint,
												children: t("trendExact") + " \u00b7 " + t(rangeKeyOf(range)) + " \u00b7 " + new Date(bounds.startDate).toLocaleDateString() + " \u2013 " + new Date(bounds.endDate).toLocaleDateString()
											}, "h")]
										}, "t"),
										react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.legend,
											children: [
												react_jsx_runtime.jsx("span", { className: tokenDetailCss.legendItem, children: [react_jsx_runtime.jsx("i", { className: tokenDetailCss.swatchInput }, "s"), t("freshInput")] }, "in"),
												react_jsx_runtime.jsx("span", { className: tokenDetailCss.legendItem, children: [react_jsx_runtime.jsx("i", { className: tokenDetailCss.swatchOutput }, "s"), t("output")] }, "out"),
												react_jsx_runtime.jsx("span", { className: tokenDetailCss.legendItem, children: [react_jsx_runtime.jsx("i", { className: tokenDetailCss.swatchCacheWrite }, "s"), t("cacheWrite")] }, "cw"),
												react_jsx_runtime.jsx("span", { className: tokenDetailCss.legendItem, children: [react_jsx_runtime.jsx("i", { className: tokenDetailCss.swatchCacheRead }, "s"), t("cacheRead")] }, "cr"),
												react_jsx_runtime.jsx("span", { className: tokenDetailCss.legendItem, children: [react_jsx_runtime.jsx("i", { className: tokenDetailCss.swatchCost }, "s"), t("totalCost")] }, "cost")
											]
										}, "legend"),
										react_jsx_runtime.jsx(TrendChart, { buckets: trend, t: t }, "chart")
									]
								}, "trendSec"),
								react_jsx_runtime.jsx("section", {
									className: tokenDetailCss.section,
									children: [
										react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.tabs,
											role: "tablist",
											children: tabs.map((k) => react_jsx_runtime.jsx("button", {
												type: "button",
												role: "tab",
												"aria-selected": tab === k,
												className: tab === k ? tokenDetailCss.tabActive : tokenDetailCss.tab,
												onClick: () => { setTab(k); },
												children: t(tabKeyOf(k))
											}, k))
										}, "tabs"),
										tab === "logs" && react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.table,
											children: [
												react_jsx_runtime.jsx("div", {
													className: tokenDetailCss.tableHead,
													children: [
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colTime, children: t("time") }, "c1"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colSession, children: t("byConversation") }, "c2"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colModel, children: t("model") }, "c3"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("freshInput") }, "c4"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("output") }, "c5"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("cacheRead") }, "c6"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("totalCost") }, "c7")
													]
												}, "head"),
												logs.length === 0
													? react_jsx_runtime.jsx("div", { className: tokenDetailCss.tableRow, children: t("noData") }, "empty")
													: logs.map((row, index) => react_jsx_runtime.jsx("button", {
														type: "button",
														className: tokenDetailCss.logRow,
														onClick: () => { openSession(row.sessionId); close(); },
														title: row.sessionTitle,
														children: [
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colTime, children: clockLabel(row.t) }, "c1"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colSession, children: row.sessionTitle }, "c2"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colModel, title: row.model, children: row.model === "" ? "\u2014" : row.model }, "c3"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: row.i.toLocaleString() }, "c4"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: row.o.toLocaleString() }, "c5"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: row.r.toLocaleString() }, "c6"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: formatCostExact(row.cost, 6) }, "c7")
														]
													}, row.sessionId + ":" + row.t + ":" + index))
											]
										}, "logs"),
										tab === "projects" && react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.table,
											children: [
												react_jsx_runtime.jsx("div", {
													className: tokenDetailCss.tableHead,
													children: [
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colProject, children: t("projectStats") }, "c1"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("requests") }, "c2"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("tokens") }, "c3"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("totalCost") }, "c4")
													]
												}, "head"),
												projects.length === 0
													? react_jsx_runtime.jsx("div", { className: tokenDetailCss.tableRow, children: t("noData") }, "empty")
													: projects.map((row) => react_jsx_runtime.jsx("div", {
														className: tokenDetailCss.tableRow,
														children: [
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colProject, title: row.title, children: row.title === "ungrouped" ? t("ungrouped") : row.title }, "c1"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: row.requests.toLocaleString() }, "c2"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: (row.input + row.output).toLocaleString() }, "c3"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: formatCostExact(row.cost, 4) }, "c4")
														]
													}, row.id))
											]
										}, "projects"),
										tab === "models" && react_jsx_runtime.jsx("div", {
											className: tokenDetailCss.table,
											children: [
												react_jsx_runtime.jsx("div", {
													className: tokenDetailCss.tableHead,
													children: [
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colModel, children: t("model") }, "c1"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("requests") }, "c2"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("tokens") }, "c3"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("totalCost") }, "c4"),
														react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: t("avgCost") }, "c5")
													]
												}, "head"),
												models.length === 0
													? react_jsx_runtime.jsx("div", { className: tokenDetailCss.tableRow, children: t("noData") }, "empty")
													: models.map((row) => react_jsx_runtime.jsx("div", {
														className: tokenDetailCss.tableRow,
														children: [
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colModel, title: row.model, children: row.model }, "c1"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: row.requests.toLocaleString() }, "c2"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: row.totalTokens.toLocaleString() }, "c3"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: formatCostExact(row.cost, 4) }, "c4"),
															react_jsx_runtime.jsx("span", { className: tokenDetailCss.colNum, children: formatCostExact(row.avgCost, 6) }, "c5")
														]
													}, row.model))
											]
										}, "models")
									]
								}, "tabsSec")
							]
						}, "body")
					]
				})
			});
		});
		//#endregion
		//#region dsh-token-viewer/SidebarTokenPanel.js
		/**
		* SidebarTokenPanel: a compact card ABOVE the sidebar's workspaces region.
		* Shows the DeepSeek account balance (via the host proxy), aggregate token
		* consumption across all sessions, and the expandable per-conversation
		* list. Renders nothing until balance or usage is available, and nothing
		* in the collapsed rail (wide === false).
		*/
		const SidebarTokenPanel = (0, react.memo)(function SidebarTokenPanel({ useSessions, useStore, actions, wide, t, openSession }) {
			const byId = useSessions((s) => s.byId);
			const totals = (0, react.useMemo)(() => deriveSidebarTotals(byId), [byId]);
			const perSession = (0, react.useMemo)(() => derivePerSession(byId), [byId]);
			const balance = useBalance();
			const [open, setOpen] = (0, react.useState)(false);
			if (!wide) return null;
			const input = totals.uncached + totals.cacheRead + totals.cacheWrite;
			const hasUsage = input > 0 || totals.output > 0;
			const showBalance = balance.state.status === "ok" && balance.state.balance !== null;
			if (!hasUsage && !showBalance) return null;
			const cacheHit = input > 0 ? Math.round(totals.cacheRead / input * 100) : null;
			const tooltipLines = [
				\`\${t("input")}: \${formatTokens(input)} \${t("tokens")} (\${t("uncached")} \${formatTokens(totals.uncached)} \\u00b7 \${t("cacheRead")} \${formatTokens(totals.cacheRead)} \\u00b7 \${t("cacheWrite")} \${formatTokens(totals.cacheWrite)})\`,
				\`\${t("output")}: \${formatTokens(totals.output)} \${t("tokens")}\`,
				\`\${t("sessions")}: \${totals.sessions}\`
			];
			if (cacheHit !== null) tooltipLines.push(\`\${t("cacheHit")}: \${cacheHit}%\`);
			return react_jsx_runtime.jsx("div", {
				className: tokenSidebarCss.card,
				"data-token-viewer-sidebar": "",
				title: tooltipLines.join("\\n"),
				children: [
					react_jsx_runtime.jsx("div", {
						className: tokenSidebarCss.titleRow,
						children: [
							react_jsx_runtime.jsx("div", { className: tokenSidebarCss.title, children: t("title") }, "title"),
							react_jsx_runtime.jsx(BalanceRow, { balance: balance.state, onRefresh: balance.refresh, t: t }, "balance")
						]
					}, "titleRow"),
					react_jsx_runtime.jsx("button", { type: "button", className: tokenSidebarCss.detailButton, onClick: () => { actions.setOpen(true); }, children: [t("detail"), " ", "→"] }, "detail"),
					hasUsage && react_jsx_runtime.jsx("div", {
						className: tokenSidebarCss.line,
						children: [
							react_jsx_runtime.jsx("span", { className: tokenSidebarCss.seg, children: [t("input"), " ", react_jsx_runtime.jsx("strong", { children: formatTokens(input) }, "v")] }, "in"),
							react_jsx_runtime.jsx("span", { className: tokenSidebarCss.seg, children: [t("output"), " ", react_jsx_runtime.jsx("strong", { children: formatTokens(totals.output) }, "v")] }, "out"),
							cacheHit !== null && react_jsx_runtime.jsx("span", { className: tokenSidebarCss.seg, children: [t("cacheHit"), " ", react_jsx_runtime.jsx("strong", { children: cacheHit + "%" }, "v")] }, "hit"),
							totals.sessions > 1 && react_jsx_runtime.jsx("span", { className: tokenSidebarCss.seg, children: t("sessions", { count: totals.sessions }) }, "n")
						]
					}, "line"),
					react_jsx_runtime.jsx(PerSessionList, { rows: perSession, open: open, onToggle: () => { setOpen((v) => !v); }, onOpen: openSession, t: t }, "perSession")
				]
			});
		});
		//#endregion
		//#region dsh-token-viewer/index.js
		/**
		* Client plugin body: the forked sidebar shell (with the extra
		* \`sidebar.workspaces.header\` hole), the token panel mounted there, and the
		* TokenDock strip in the composer dock. Requires the slots/layout/sessions/
		* workspaces/locale services.
		* @param ctx - client root context.
		*/
		const inject = ["slots", "layout", "sessions", "workspaces", "locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-token-viewer: sidebar dictionaries");
			ctx.effect(() => ctx.locale.register(TOKEN_NS, { zh: tokenZh, en: tokenEn }), "dsh-token-viewer: dictionaries");
			const openSession = (sessionId) => {
				ctx.sessions.open(sessionId);
			};
			const tokenDetailStore = createTokenDetailStore();
			const injectProps = () => ({
				startSession: (workspaceId) => {
					ctx.workspaces.startSession(workspaceId);
				},
				toggleSidebar: () => {
					ctx.layout.toggleSidebar();
				}
			});
			ctx.effect(() => ctx.slots.register({
				name: "sidebar",
				locale: NS,
				children: {
					"sidebar.workspaces": {
						kind: "single",
						scope: "root"
					},
					"sidebar.workspaces.header": {
						kind: "single",
						scope: "root"
					},
					"sidebar.settings": {
						kind: "single",
						scope: "root"
					},
					"sidebar.footer.action": {
						kind: "list",
						scope: "root"
					}
				},
				inject: injectProps
			}, SidebarRoot), "dsh-token-viewer: sidebar shell registration");
			ctx.slots.inject("sidebar.workspaces.header", () => ctx.slots.register({
				name: "sidebar.workspaces.header",
				locale: TOKEN_NS,
				store: tokenDetailStore,
				inject: () => ({
					openSession
				})
			}, SidebarTokenPanel));
			ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "token-viewer-detail",
				order: 10,
				locale: TOKEN_NS,
				store: tokenDetailStore,
				inject: () => ({ openSession })
			}, TokenDetailPanel));
			ctx.slots.inject("conversation.input.dock", () => ctx.slots.register({
				name: "conversation.input.dock",
				id: "token-viewer",
				order: 20,
				locale: TOKEN_NS
			}, TokenDock));
		}
		//#endregion
		exports.SidebarRoot = SidebarRoot;
		exports.SidebarTokenPanel = SidebarTokenPanel;
		exports.BalanceRow = BalanceRow;
		exports.PerSessionList = PerSessionList;
		exports.TokenDetailPanel = TokenDetailPanel;
		exports.createTokenDetailStore = createTokenDetailStore;
		exports.TokenDock = TokenDock;
		exports.apply = apply;
		exports.inject = inject;
`;

const out = head + body + tail + '\t' + tailClose;
writeFileSync(outFile, out, 'utf8');
console.log(`wrote ${outFile} (${out.length} chars)`);
