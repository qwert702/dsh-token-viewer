# dsh-token-viewer

A **DeepSeek Harness web GUI** client plugin that shows how many tokens have been consumed, read from the host-computed token-meter session projections (`tokenUsage` / `contextPressure` / `contextBreakdown`) — projection-mode, no store, no wire.

Two surfaces:

- **TokenDock** — a slim live strip above the message composer showing the *current* session's billed input (uncached + cache read + cache write), output, cache hit rate, and approximate context occupancy with a mini progress bar. Hover for the full billing breakdown. Renders nothing until a provider reports usage.
- **SidebarTokenPanel** — a compact card *above the workspaces region* in the left sidebar aggregating `tokenUsage` across every session (billed input, output, cache hit rate, reporting-session count). Hides in the collapsed rail.

English | [中文](README.zh.md)

## Repository layout

This repository is the standalone home of the plugin package (`@deepseek-ai/dsh-client-ui-token-viewer`), laid out exactly like a `packages/client/*` workspace package of [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) so it can be dropped into that repo unchanged:

```
dsh-token-viewer/
├── package.json            # dsh.client manifest (platform: web)
├── src/
│   ├── index.ts            # host half (no-op plugin)
│   ├── invariant.ts        # package invariant companion
│   └── client/             # browser half
│       ├── index.ts        # apply / inject
│       ├── TokenDock.tsx (+ .module.css)
│       ├── SidebarTokenPanel.tsx (+ .module.css)
│       ├── derive.ts       # pure display folds over the projections
│       └── locales.ts      # zh / en dictionaries
├── tests/                  # vitest specs (incl. cordis-Context HMR-disposal)
├── patches/
│   └── ui-sidebar-sidebar-workspaces-header.patch
└── tsdown.config.ts / tsconfig.json
```

## Dependencies

- The sidebar card mounts into `sidebar.workspaces.header`, a hole the stock sidebar shell does not declare yet. Apply `patches/ui-sidebar-sidebar-workspaces-header.patch` against `packages/client/ui-sidebar` of a deepseek-harness source checkout (it adds the child-slot declaration, the `renderSlot` call above the workspaces region, and the `SlotMap` contract), then install this package and enable the row.
- Reads projections published by `@deepseek-ai/dsh-token-meter` (already composed in the standard web profile).

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

None. Pure presentation over projections already computed by the host; no prompt content, tools, messages, or provider requests. No KV-cache effect.

## Known Limitations and Deferred Work

- **Heuristic approximations** — cache hit rate and context occupancy inherit the token-meter's fixed 4-chars-per-token density estimate; CJK text and JSON schemas are systematically underpriced. Occupancy is a user-facing reference figure, not billing.
- **The sidebar card depends on the ui-sidebar header hole** — a shell without the patched slot silently loses the card while the dock strip keeps working.
- **Upstream contribution status** — the same change is prepared as branch `feat/ui-token-viewer` on the fork `qwert702/deepseek-harness`, ready to open a pull request against `deepseek-ai/deepseek-harness` once that repository enables Pull Requests (it currently has Issues/Pull Requests disabled, so cross-repo PRs cannot be created).
