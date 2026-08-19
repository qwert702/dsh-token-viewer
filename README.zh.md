# dsh-token-viewer

DeepSeek Harness 网页端 **CC Switch 风格 Token 消耗统计**插件。纯只读界面：数据来自 host 已算好的会话投影 + 一次余额读取；不添加任何提示词内容、工具或提供方请求。

> **一键安装：**
> ```
> dsh plugin add qwert702/dsh-token-viewer
> ```
> 重启 harness、刷新网页后，打开侧边栏 **Token 消耗** 卡片 → **用量详情**。

## 功能

- **TokenDock** — 输入区上方悬浮条：当前会话计费输入（未缓存 + 缓存读 + 缓存写）、输出、缓存命中率、近似上下文占用率。
- **侧边栏卡片** — DeepSeek 账号余额（可刷新；host 代理失败显示错误重试）+ 全会话用量汇总，可展开按会话明细。
- **用量统计面板**（右侧抽屉，完整移植 CC Switch 用量看板口径）：
  - **按请求统计** — host 侧 `usageLog` 投影为每条上报用量的 assistant 步骤记录一条（提交时间、模型、四个 token 桶）；所有数字折叠自这些请求记录，而非会话累计值。
  - **Hero** — 真实消耗（新增输入 + 输出 + 缓存写 + 缓存读）、请求数、总成本，下排五卡 + 缓存命中率进度条。
  - **趋势图** — 按每条请求自身的提交时间分桶（当天按小时、多天按天，空桶补零），四个 token 序列 + 虚线成本线。
  - **三个 Tab** — 请求日志（最新在前；点击行打开该会话）、按项目统计、含平均成本的按模型统计。
  - **时间范围** — 当天 / 7天 / 14天 / 30天 / 全部，与 CC Switch 完全一致（N−1 天前本地零点起）。
- **按模型峰谷牌价计费** — 每条请求按其模型与提交时间计费：V4-Flash / V4-Pro 官方牌价（人民币/百万 tokens，缓存写按缓存未命中价），北京高峰（9–12 点、14–18 点）自动翻倍；带版本号的模型 id 前缀匹配，未知模型回退 V4-Flash 空闲价。
- **余额路由** — `GET /api/billing/balance` 经 harness 凭据服务代理 DeepSeek `/user/balance`，API key 永不离开服务器。

## 截图

*（即将补上）*

## 仓库结构

- `lib/index.js` — 插件 host 半区（余额路由 + `modelUsage` / `usageLog` 会话投影），开箱即用。
- `lib/client.js` — 浏览器半区（已构建），通过 `package.json` 的 `dsh.client` 声明被发现。
- `scripts/build-client.mjs` — 重新生成 `lib/client.js`：从已安装的 `@deepseek-ai/dsh-client-ui-sidebar` bundle 提取外壳（可用 `DSH_SIDEBAR_BUNDLE` 指定，否则探测 `~/.dsh/profiles`）。
- `test/smoke.cjs` — `node test/smoke.cjs`：host 路由 + 投影折叠 + SSR 渲染检查。

TypeScript monorepo 源码（提取自 `deepseek-ai/deepseek-harness`）保存在 `archive/monorepo-src` 分支。

## 模型牌价

`lib/client.js` 中的 `MODEL_PRICING`（以及 `lib/index.js` 的回退表）保存当前 DeepSeek 牌价；面板打开时会先请求 `GET /api/billing/pricing`，优先采用官方定价页数据，不可达时静默回退内置表。

## License

MIT
