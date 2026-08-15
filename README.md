# dsh-token-viewer

Token consumption surface plugin for the **DeepSeek Harness web GUI**: read-only surfaces over the host-computed token-meter session projections (`tokenUsage`, `contextPressure`, `contextBreakdown`) plus a DeepSeek account-balance read. The browser half owns no domain store, refresh chain, or event listener; the node half owns the one host route the balance row fetches.

- **`TokenDock`** registers at `conversation.input.dock` (order 20, after Goal). It shows what the current session has consumed — billed input (uncached + cache read + cache write), output, cache hit rate, and approximate context occupancy (`projectedTokens / contextWindow`) with a mini progress bar. The hover tooltip carries the full billing breakdown. It renders nothing until a provider reports usage.
- **`SidebarTokenPanel`** registers at `sidebar.workspaces.header`, a hole declared by ui-sidebar's shell above the workspaces region. It shows the DeepSeek account balance (currency figure with a refresh control; error-retry when the host proxy fails), aggregates `tokenUsage` across every session row's `projectionValues` — billed input, output, cache hit rate, and the number of sessions that reported usage — expands to a **per-conversation list** (each session's billed input/output, highest total first; clicking a row opens that session), and opens a **right-side usage statistics panel** (`TokenDetailPanel` at `shell.overlay`) styled after CC Switch's usage page: a time-range filter (all / today / last 7 days), hero summary cards (real usage, **estimated cost**, cache hit rate, session count, balance), a per-workspace (project) statistics table, and a per-conversation log table (time / input / output / cache / cost). It renders nothing until balance or usage is available, and nothing in the collapsed rail (`wide === false`).
- **Host half** registers `GET /api/billing/balance`: it reads its configuration from the harness **settings namespace** `dsh-token-viewer` (which credential reference and provider base URL to use, defaults `DEEPSEEK_API_KEY` / `https://api.deepseek.com`, editable in `settings.yaml`), resolves the API key through the credentials service (the same secret store the LLM adapter uses), and proxies DeepSeek's `/user/balance`, returning only balance figures — the API key never leaves the server.

The `/client` exports are the plugin body (`apply`/`inject`) and the composed props types.

English | [中文](README.zh.md)

## Repository layout

This repository is the standalone home of the plugin package (`@deepseek-ai/dsh-client-ui-token-viewer`), laid out exactly like a `packages/client/*` workspace package of [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) so it can be dropped into that repo unchanged:

```
dsh-token-viewer/
├── package.json            # dsh.client manifest (platform: web) + host deps
├── src/
│   ├── index.ts            # host half: /api/billing/balance route (Config)
│   ├── invariant.ts        # package invariant companion
│   └── client/             # browser half
│       ├── index.ts        # apply / inject (incl. openSession face)
│       ├── TokenDock.tsx (+ .module.css)
│       ├── SidebarTokenPanel.tsx (+ .module.css)
│       ├── BalanceRow.tsx (+ .module.css) / balance.ts
│       ├── PerSessionList.tsx (+ .module.css)
│       ├── derive.ts       # pure display folds over the projections
│       └── locales.ts      # zh / en dictionaries
├── tests/                  # vitest specs (client components + host route + HMR disposal)
├── patches/
│   └── ui-sidebar-sidebar-workspaces-header.patch
└── tsdown.config.ts / tsconfig.json
```

## Dependencies

- The sidebar card mounts into `sidebar.workspaces.header`, a hole the stock sidebar shell does not declare yet. Apply `patches/ui-sidebar-sidebar-workspaces-header.patch` against `packages/client/ui-sidebar` of a deepseek-harness source checkout (it adds the child-slot declaration, the `renderSlot` call above the workspaces region, and the `SlotMap` contract), then install this package and enable the row.
- Reads projections published by `@deepseek-ai/dsh-token-meter` (already composed in the standard web profile); the balance route needs the `webServer` and `credentials` services (both present in the standard web profile).

## Install

```powershell
# 1. apply the sidebar shell patch in your deepseek-harness source checkout
git apply patches/ui-sidebar-sidebar-workspaces-header.patch

# 2. expose the package to the web profile's node_modules (junction, no copy)
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-token-viewer" `
  -Target "D:\path\to\dsh-token-viewer"

# 3. enable the row in $env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml:
#    - insert:
#        - id: ui-token-viewer
#          name: 'dsh-token-viewer'

# 4. restart `dsh web`, then refresh the GUI
```

## Model Experience

None. The surfaces are pure presentation over projection values already computed by the host, plus a balance read from the provider's billing endpoint; the plugin adds no prompt content, tools, messages, or provider requests. No KV-cache effect.

## Known Limitations and Deferred Work

- **Heuristic approximations** — cache hit rate and context occupancy inherit the token-meter's fixed 4-chars-per-token density estimate; CJK text and JSON schemas are systematically underpriced. Occupancy is a user-facing reference figure, not billing.
- **Balance is DeepSeek-specific** — the host route calls DeepSeek's `/user/balance`; other providers are not covered, and multi-currency responses show only the first `balance_infos` entry.
- **The sidebar card depends on the ui-sidebar header hole** — a shell without the patched slot silently loses the card while the dock strip keeps working.
- **Upstream contribution status** — the same change is prepared as branch `feat/ui-token-viewer` on the fork `qwert702/deepseek-harness`, ready to open a pull request against `deepseek-ai/deepseek-harness` once that repository enables Pull Requests (it currently has Issues/Pull Requests disabled, so cross-repo PRs cannot be created).
