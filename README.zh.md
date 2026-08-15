# @deepseek-ai/dsh-client-ui-token-viewer

[English](README.md) | 中文

Token 消耗展示插件：只读界面，数据来自 host 侧已算好的 token-meter 会话投影（`tokenUsage`、`contextPressure`、`contextBreakdown`），外加一个 DeepSeek 账号余额读取。浏览器半区不拥有领域 store、刷新链或事件监听；node 半区拥有余额行所请求的唯一 host 路由。

- **`TokenDock`** 注册于 `conversation.input.dock`（order 20，位于 Goal 之后）。展示当前会话的消耗——计费输入（未缓存 + 缓存读 + 缓存写）、输出、缓存命中率，以及近似上下文占用率（`projectedTokens / contextWindow`，带迷你进度条）。悬停气泡给出完整计费明细。在提供方上报用量之前不渲染任何内容。
- **`SidebarTokenPanel`** 注册于 `sidebar.workspaces.header`——由 ui-sidebar 外壳声明在工作区浏览区上方的一个插槽。展示 DeepSeek 账号余额（币种金额 + 刷新按钮；host 代理失败时显示错误重试），汇总所有会话行 `projectionValues` 中的 `tokenUsage`——计费输入、输出、缓存命中率、上报会话数——可展开为按会话明细列表（每个会话的计费输入/输出，按总量降序；点击行打开该会话），并可打开**右侧用量详情面板**（`TokenDetailPanel`，注册于 `shell.overlay`），内含总用量、按项目（工作区）用量与按对话用量。余额或用量任一存在时才渲染；侧边栏收起（`wide === false`）时不渲染。
- **Host 半区** 注册 `GET /api/billing/balance`：从 harness **设置命名空间** `dsh-token-viewer` 读取配置（使用哪个凭据引用与提供方 base URL，默认 `DEEPSEEK_API_KEY` / `https://api.deepseek.com`，可在 `settings.yaml` 中修改），通过凭据服务（与 LLM 适配器使用同一密钥存储）解析 API key，代理 DeepSeek 的 `/user/balance`，只回余额数字——API key 永不离开服务器。

`/client` 导出为插件主体（`apply`/`inject`）与组合后的 props 类型。

## 模型体验

无。两个界面是对 host 已算好的投影值的纯展示，外加一次对提供方计费端点的余额读取；插件不添加提示词内容、工具、消息或提供方请求。

#### KV Cache 影响

无；本插件既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **启发式近似**——缓存命中率与上下文占用率继承 token-meter 固定的「4 字符 ≈ 1 token」密度估计（凡提供方未计费的内容都按此计价）；CJK 文本与 JSON schema 会被系统性低估。占用率是面向用户的参考数字，不是计费或门控输入（见 token-meter README）。
- **余额为 DeepSeek 专属**——host 路由调用 DeepSeek 的 `/user/balance`；其他提供方不在覆盖范围，多币种响应只展示 `balance_infos` 首项。
- **侧边栏卡片依赖 ui-sidebar 的 header 插槽**——只有外壳声明 `sidebar.workspaces.header` 时才渲染；若组合层替换了不带该插槽的 ui-sidebar，卡片会静默消失，而 dock 条仍正常。
