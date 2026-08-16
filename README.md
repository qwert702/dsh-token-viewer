# @deepseek-ai/dsh-client-ui-token-viewer

English | [中文](README.zh.md)

Token consumption surface plugin: read-only surfaces over the host-computed token-meter session projections (`tokenUsage`, `contextPressure`, `contextBreakdown`) plus a DeepSeek account-balance read. The browser half owns no domain store, refresh chain, or event listener; the node half owns the one host route the balance row fetches.

- **`TokenDock`** registers at `conversation.input.dock` (order 20, after Goal). It shows what the current session has consumed — billed input (uncached + cache read + cache write), output, cache hit rate, and approximate context occupancy (`projectedTokens / contextWindow`) with a mini progress bar. The hover tooltip carries the full billing breakdown. It renders nothing until a provider reports usage.
- **`SidebarTokenPanel`** registers at `sidebar.workspaces.header`, a hole declared by ui-sidebar's shell above the workspaces region. It shows the DeepSeek account balance (currency figure with a refresh control; error-retry when the host proxy fails), aggregates `tokenUsage` across every session row's `projectionValues` — billed input, output, cache hit rate, and the number of sessions that reported usage — expands to a per-conversation list (each session's billed input/output, highest total first; clicking a row opens that session), and opens a **right-side usage statistics panel** (`TokenDetailPanel` at `shell.overlay`) styled after CC Switch's usage page: a time-range filter (all / today / last 7 days), hero summary cards (real usage, **estimated cost**, cache hit rate, session count, balance), an **approximate usage-trend bar chart** (input/output/cache stacked, hourly for today and daily otherwise, bucketed by each session's last activity), **model statistics** (per-model consumption folded host-side from each assistant message's reported usage and model, with a deployment-default fallback row until any session reports), a per-workspace (project) statistics table, and a per-conversation log table (time / input / output / cache / cost). It renders nothing until balance or usage is available, and nothing in the collapsed rail (`wide === false`).
- **Host half** registers `GET /api/billing/balance`: it reads its configuration from the harness **settings namespace** `dsh-token-viewer` (which credential reference and provider base URL to use, defaults `DEEPSEEK_API_KEY` / `https://api.deepseek.com`, editable in `settings.yaml`), resolves the API key through the credentials service (the same secret store the LLM adapter uses), and proxies DeepSeek's `/user/balance`, returning only balance figures — the API key never leaves the server. It also registers the **`modelUsage` session projection**: a pure fold over `assistant/message` events that attributes each step's provider usage to its message model (`message.source.model`), so the browser half can show real per-model consumption.

The `/client` exports are the plugin body (`apply`/`inject`) and the composed props types.

## Model Experience

None. The surfaces are pure presentation over projection values already computed by the host, plus a balance read from the provider's billing endpoint; the plugin adds no prompt content, tools, messages, or provider requests.

#### KV Cache effect

None. The plugin neither assembles nor sends provider requests.

## Known Limitations and Deferred Work

- **Heuristic approximations** — cache hit rate and context occupancy inherit the token-meter's fixed 4-chars-per-token density estimate for any content the provider did not bill; CJK text and JSON schemas are systematically underpriced. Occupancy is a user-facing reference figure, not a billing or gating input (see the token-meter README).
- **Balance is DeepSeek-specific** — the host route calls DeepSeek's `/user/balance`; other providers are not covered, and multi-currency responses show only the first `balance_infos` entry.
- **The sidebar card depends on ui-sidebar's header hole** — it renders only when the shell declares `sidebar.workspaces.header`; a composition that replaces ui-sidebar without that hole silently loses the card while the dock strip keeps working.
