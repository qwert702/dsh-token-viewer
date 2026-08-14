# dsh-token-viewer

**DeepSeek Harness Web GUI** 客户端插件：展示已消耗的 token，数据来自 host 侧算好的 token-meter 会话投影（`tokenUsage` / `contextPressure` / `contextBreakdown`）——纯投影模式，无 store、无网络。

两个界面：

- **TokenDock** — 消息输入框上方的细条，展示*当前*会话的计费输入（未缓存 + 缓存读 + 缓存写）、输出、缓存命中率，以及带迷你进度条的近似上下文占用率。悬停查看完整计费明细。提供方上报用量之前不渲染。
- **SidebarTokenPanel** — 侧边栏*工作区上方*的紧凑卡片，汇总所有会话的 `tokenUsage`（计费输入、输出、缓存命中率、上报会话数）。侧边栏收起时隐藏。

[English](README.md) | 中文

## 仓库结构

本仓库是插件包（`@deepseek-ai/dsh-client-ui-token-viewer`）的独立驻地，目录布局与 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 的 `packages/client/*` 工作区包完全一致，可直接原样放入该仓库：

```
dsh-token-viewer/
├── package.json            # dsh.client 清单（platform: web）
├── src/
│   ├── index.ts            # host 半区（空插件）
│   ├── invariant.ts        # 包级 invariant 伴生
│   └── client/             # 浏览器半区
│       ├── index.ts        # apply / inject
│       ├── TokenDock.tsx (+ .module.css)
│       ├── SidebarTokenPanel.tsx (+ .module.css)
│       ├── derive.ts       # 对投影值的纯展示折叠
│       └── locales.ts      # zh / en 词典
├── tests/                  # vitest 规格（含 cordis Context 的 HMR 卸载）
├── patches/
│   └── ui-sidebar-sidebar-workspaces-header.patch
└── tsdown.config.ts / tsconfig.json
```

## 依赖

- 侧边栏卡片挂载在 `sidebar.workspaces.header`——官方侧边栏外壳尚未声明该插槽。请对 deepseek-harness 源码检出中的 `packages/client/ui-sidebar` 应用 `patches/ui-sidebar-sidebar-workspaces-header.patch`（新增子槽声明、工作区区域上方的 `renderSlot` 调用与 `SlotMap` 契约），然后安装本包并启用行。
- 读取 `@deepseek-ai/dsh-token-meter` 发布的投影（标准 web profile 已组合）。

## 安装

```powershell
# 1. 在你的 deepseek-harness 源码检出中应用侧边栏外壳补丁
git apply patches/ui-sidebar-sidebar-workspaces-header.patch

# 2. 把包暴露给 web profile 的 node_modules（junction，不复制）
New-Item -ItemType Junction -Path "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-token-viewer" `
  -Target "D:\path\to\dsh-token-viewer"

# 3. 在 $env:USERPROFILE\.dsh\profiles\web\cordis.patch.yml 中启用行：
#    - insert:
#        - id: ui-token-viewer
#          name: 'dsh-token-viewer'

# 4. 重启 `dsh web`，然后刷新 GUI
```

## 模型体验

无。这两个界面是对 host 已算好的投影值的纯展示；不添加提示词内容、工具、消息或提供方请求。无 KV 缓存影响。

## 已知限制与暂缓事项

- **启发式近似**——缓存命中率与上下文占用率继承 token-meter 固定的「4 字符 ≈ 1 token」密度估计；CJK 文本与 JSON schema 会被系统性低估。占用率是面向用户的参考数字，不是计费依据。
- **侧边栏卡片依赖 ui-sidebar 的 header 插槽**——未打补丁的外壳会静默丢失卡片，而 dock 条仍正常。
- **上游贡献状态**——同一改动已作为分支 `feat/ui-token-viewer` 推送到 fork `qwert702/deepseek-harness`，待 `deepseek-ai/deepseek-harness` 启用 Pull Requests 后即可发起 PR（该仓库当前禁用了 Issues/Pull Requests，跨仓库 PR 无法创建）。
