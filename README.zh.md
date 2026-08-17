# @deepseek-ai/dsh-client-ui-token-viewer

[English](README.md) | 中文

Token 消耗展示插件：只读界面，数据来自 host 侧已算好的 token-meter 会话投影（`tokenUsage`、`contextPressure`、`contextBreakdown`），外加一个 DeepSeek 账号余额读取。浏览器半区不拥有领域 store、刷新链或事件监听；node 半区拥有余额行所请求的唯一 host 路由。

- **`TokenDock`** 注册于 `conversation.input.dock`（order 20，位于 Goal 之后）。展示当前会话的消耗——计费输入（未缓存 + 缓存读 + 缓存写）、输出、缓存命中率，以及近似上下文占用率（`projectedTokens / contextWindow`，带迷你进度条）。悬停气泡给出完整计费明细。在提供方上报用量之前不渲染任何内容。
- **`SidebarTokenPanel`** 注册于 `sidebar.workspaces.header`——由 ui-sidebar 外壳声明在工作区浏览区上方的一个插槽。展示 DeepSeek 账号余额（币种金额 + 刷新按钮；host 代理失败时显示错误重试），汇总所有会话行 `projectionValues` 中的 `tokenUsage`——计费输入、输出、缓存命中率、上报会话数——可展开为按会话明细列表（每个会话的计费输入/输出，按总量降序；点击行打开该会话），并可打开**右侧用量统计面板**（`TokenDetailPanel`，注册于 `shell.overlay`）：**完整移植 CC Switch 用量看板的统计口径**，数据折叠自按请求的用量记录（`usageLog` 投影）而非会话累计值。时间范围与 CC Switch 完全一致（当天从本地零点起、N 天窗口从 N−1 天前的零点起、全部）；Hero 展示**真实消耗**（新增输入 + 输出 + 缓存写 + 缓存读）、请求数与总成本，下排五张卡（新增输入 / 输出 / 缓存写 / 缓存读 / 缓存命中率进度条）；**趋势图**按每条请求自身的提交时间分桶——当天按小时、多天按天，空桶补零——四个 token 序列叠加虚线成本线；三个 Tab 承载**请求日志**（每条计费请求按时间倒序；点击行打开该会话）、**按项目统计**、含平均成本的**按模型统计**。费用为四桶估算（每桶只计一次，即 CC Switch 的 Claude 语义计费器）采用 DeepSeek 默认人民币牌价。`usageLog` 投影存在之前的旧会话回退为按会话从累计 `tokenUsage` 合成一条记录，仅这段历史尾巴保持近似。余额或用量任一存在时才渲染；侧边栏收起（`wide === false`）时不渲染。
- **Host 半区** 注册 `GET /api/billing/balance`：从 harness **设置命名空间** `dsh-token-viewer` 读取配置（使用哪个凭据引用与提供方 base URL，默认 `DEEPSEEK_API_KEY` / `https://api.deepseek.com`，可在 `settings.yaml` 中修改），通过凭据服务（与 LLM 适配器使用同一密钥存储）解析 API key，代理 DeepSeek 的 `/user/balance`，只回余额数字——API key 永不离开服务器。同时注册 **`modelUsage` 会话投影**（旧回退路径的按模型累计桶）与 **`usageLog` 会话投影**：对 `assistant/message` 事件的纯折叠，每条上报过用量的步骤追加一条带时间戳的记录——提交时间（`event.time`）、模型与四个 token 桶——供统计面板按 CC Switch 的口径精确聚合。

`/client` 导出为插件主体（`apply`/`inject`）与组合后的 props 类型。

## 模型体验

无。两个界面是对 host 已算好的投影值的纯展示，外加一次对提供方计费端点的余额读取；插件不添加提示词内容、工具、消息或提供方请求。

#### KV Cache 影响

无；本插件既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **启发式近似，仅限 dock 与侧栏**——停靠条与侧栏卡的缓存命中率、上下文占用率继承 token-meter 固定的「4 字符 ≈ 1 token」密度估计（凡提供方未计费的内容都按此计价）；CJK 文本与 JSON schema 会被系统性低估。统计面板的 CC Switch 口径折叠的是提供方逐条上报的请求用量，对 `usageLog` 投影覆盖的会话是精确值（仅早于该投影的旧会话回退为合成近似）。占用率是面向用户的参考数字，不是计费或门控输入（见 token-meter README）。
- **按模型分档计价**——每条请求按其模型与提交时间计费：V4-Flash / V4-Pro 各自的官方牌价（人民币/百万 tokens，缓存写按缓存未命中价），并区分北京时段高峰（9–12 点、14–18 点，牌价翻倍）与空闲；未知模型回退 V4-Flash 空闲价。牌价硬编码在 `MODEL_PRICING` 表中，提供方调价时需同步。
- **余额为 DeepSeek 专属**——host 路由调用 DeepSeek 的 `/user/balance`；其他提供方不在覆盖范围，多币种响应只展示 `balance_infos` 首项。
- **侧边栏卡片依赖 ui-sidebar 的 header 插槽**——只有外壳声明 `sidebar.workspaces.header` 时才渲染；若组合层替换了不带该插槽的 ui-sidebar，卡片会静默消失，而 dock 条仍正常。
