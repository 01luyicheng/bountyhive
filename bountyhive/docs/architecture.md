# BountyHive 架构文档

> **版本**：v5 准确版对齐
> **点题**：一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。

---

## 一、项目概览

**BountyHive** 是 EvoMap 悬赏市场上的优质 Agent 供应商。通过**失败经验沉淀 + 能力链溯源**，让蜂群越接单越聪明。

### 解决什么问题

传统 Agent 接单模式中，每个 Agent 独立试错，失败经验无法复用——同样的坑被反复踩。BountyHive 利用 EvoMap 协议原生的 `outcome=failed` Capsule + `semantic-search` + `reused_asset_id` 溯源字段，构建跨时间的群体进化闭环：

1. Agent A 失败 → 发布 failed Capsule（沉淀）
2. Agent B 搜到 A 的失败经验 → 避雷成功 → 发布 success Capsule 溯源 A（复用）
3. Agent C 搜到 A 失败 + B 成功 → 秒级修复 → 能力链 A→B→C 成型（群体免疫）

### 点题句

> **一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。**

### 赛道

- **主线**：The Forge（蜂群协作）
- **辅线**：The Pearl（失败策略迭代）

---

## 二、技术栈

### 后端

| 组件 | 技术 | 说明 |
|---|---|---|
| 运行时 | Node.js 18+ | ESM (`"type": "module"`) |
| HTTP 框架 | Express 4 | 提供 REST API + SSE |
| HTTP 客户端 | 原生 fetch | Node 18+ 内置，不引入 SDK |
| 配置 | dotenv | 读 `.env` 环境变量 |
| CORS | cors 中间件 | 允许 `localhost:5173` |
| 并发管理 | concurrently | `npm start` 同时跑 server + heartbeat |

### 前端

| 组件 | 技术 | 说明 |
|---|---|---|
| 框架 | React 18 | 函数组件 + Hooks |
| 构建 | Vite 5 | 开发服务器 + HMR |
| 样式 | Tailwind CSS 3 | 深色赛博朋克主题 |
| 状态 | 原生 hooks | 无 Redux/Zustand，纯 useState + useEffect |
| 实时 | EventSource (SSE) | Demo 日志实时推送 |
| 轮询 | setInterval + fetch | 3s 轮询 agents/bounties/capsules，1s 轮询 demo status |

### 协议

| 协议 | 版本 | 说明 |
|---|---|---|
| GEP-A2A | 1.0.0 | EvoMap Agent-to-Agent 通信协议 |
| GEP Asset Schema | 1.5.0+ | Gene/Capsule 资产结构 |
| HTTP | REST | 信封端点（hello/publish/fetch）+ REST 端点（task/assets/billing）|

---

## 三、目录结构

```
bountyhive/
├── package.json                    # 后端依赖 + scripts
├── .env.example                    # 环境变量模板
├── .env                            # 实际配置（不入 git）
├── .gitignore
├── README.md                       # 项目级 README
│
├── src/
│   ├── server.js                   # Express HTTP API + SSE（端口 3001）
│   │
│   ├── lib/                        # 核心库（不依赖 EvoMap 账号）
│   │   ├── asset-id.js             # canonicalJSON + computeAssetId + randomMessageId
│   │   ├── evomap-client.js        # EvoMap A2A API 封装（信封端点 + REST 端点）
│   │   ├── bounty-flow.js          # bounty 流程编排（ask/claim/publish/complete/accept）
│   │   ├── mock-data.js            # Mock 数据生成器（MOCK_MODE=true 时使用）
│   │   └── self-test.js            # asset_id 计算自测（10 个断言）
│   │
│   └── demo/                       # Demo 编排
│       ├── agent-templates.js      # 3 个 Agent 的 Gene/Capsule 模板 + CHAIN_ID + TAGLINE
│       ├── agent-a.js              # Agent A：发起悬赏 + 失败 Capsule
│       ├── agent-b.js              # Agent B：认领 + 成功 Capsule + 溯源 A
│       ├── agent-c.js              # Agent C：复用 B 经验 + 秒级修复
│       ├── orchestrator.js         # 编排 3 Agent 闭环（5 阶段）
│       ├── mock-orchestrator.js    # Mock 编排（MOCK_MODE=true 时替代 orchestrator）
│       └── heartbeat.js            # 心跳保活（防 15 分钟离线）
│
├── scripts/                        # 运维脚本
│   ├── start-all.js                # 一键启动后端 + 前端（支持 --mock / --no-frontend）
│   ├── stop-all.js                 # 停止占用 3001/5173 端口的进程
│   └── dev-setup.js                # 一键安装配置（依赖 + .env + self-test）
│
├── test/                           # 测试
│   └── server.test.js              # Server 集成测试（node:test，验证端点响应格式）
│
├── frontend/                       # React 前端
│   ├── package.json
│   ├── vite.config.js              # /api 代理到 localhost:3001
│   ├── tailwind.config.js          # 深色主题 + 霓虹色 + 动画
│   ├── postcss.config.js
│   ├── index.html
│   ├── public/
│   │   └── hive.svg                # 站点图标
│   └── src/
│       ├── main.jsx                # React 入口
│       ├── App.jsx                 # 单页布局：Header → 控制台 → 蜂群 → 市场 → 独白 → 星图 → 能力链 → 流水 → Footer
│       ├── index.css               # Tailwind 指令 + 全局深色主题 + 蜂巢网格 + 扫描线
│       ├── hooks/
│       │   ├── useAgents.js        # 轮询 GET /api/agents（3s）
│       │   ├── useBounties.js      # 轮询 GET /api/bounties（3s）
│       │   ├── useCapsules.js      # 轮询 GET /api/capsules?outcome=failed（3s）
│       │   ├── useDemoStatus.js    # 轮询 GET /api/demo/status（1s）
│       │   └── useDemoLogs.js      # EventSource /api/demo/logs
│       └── components/
│           ├── AgentStatusCard.jsx       # Agent 状态卡片（心跳动画）
│           ├── BountyMarketplace.jsx     # 悬赏市场 + 蜂群上线动画
│           ├── FailureMonologueCard.jsx  # 失败独白（情感锚点 1）
│           ├── FailureStarMap.jsx        # 失败经验星图 + 发现瞬间（情感锚点 2）
│           ├── CapabilityChainList.jsx   # 能力链列表 A→B→C（情感锚点 3）
│           ├── EarningsLedger.jsx        # 积分流水表格
│           └── DemoControlPanel.jsx      # Demo 控制台（启动/状态/日志）
│
└── docs/                           # 文档
    ├── README.md                   # 文档索引
    ├── architecture.md             # 本文档（架构）
    ├── demo-script.md              # Demo 逐秒脚本（3 分钟）
    ├── demo-fallback.md            # Fallback 应急手册
    ├── demo-checklist.md           # 现场 checklist
    └── qa-playbook.md              # 评委 Q&A 预案
```

---

## 四、数据流

### 4.1 真实模式（生产环境）

```
┌──────────┐     HTTP      ┌──────────┐     A2A API     ┌──────────┐
│  前端    │ ────────────> │  Express │ ──────────────> │  EvoMap  │
│ React    │ <──────────── │  server  │ <────────────── │   Hub    │
│ (5173)   │   JSON / SSE  │  (3001)  │   JSON          │          │
└──────────┘               └──────────┘                 └──────────┘
                                │
                                │ 调用
                                ▼
                           ┌──────────┐
                           │ evomap-  │
                           │ client   │
                           │ .js      │
                           └──────────┘
                                │
                                │ 编排
                                ▼
                           ┌──────────┐
                           │ demon-   │
                           │ strator  │
                           │ .js      │
                           └──────────┘
                                │
                                │ 驱动
                                ▼
                     ┌────────────────────┐
                     │  Agent A/B/C       │
                     │  (agent-a/b/c.js)  │
                     └────────────────────┘
```

**流程**：
1. 前端 React 组件通过 `fetch` 调用 Express API（`/api/*`）
2. Express server 调用 `evomap-client.js` 封装的 A2A API
3. `evomap-client.js` 用 GEP-A2A 信封（hello/publish/fetch）或 REST（task/assets/billing）调用 EvoMap Hub
4. `POST /api/demo/start` 触发 `orchestrator.js`，编排 Agent A/B/C 完成完整闭环
5. orchestrator 通过 `logSink` 收集日志，server 通过 SSE 推送给前端

### 4.2 Mock 模式（开发/测试）

```
┌──────────┐     HTTP      ┌──────────┐     读取      ┌──────────┐
│  前端    │ ────────────> │  Express │ ───────────> │ mock-    │
│ React    │ <──────────── │  server  │ <─────────── │ data.js  │
│ (5173)   │   JSON / SSE  │  (3001)  │   JSON       │ (内存)   │
└──────────┘               └──────────┘              └──────────┘
                                │
                                │ MOCK_MODE=true
                                ▼
                           ┌──────────────┐
                           │ mock-        │
                           │ orchestrator │
                           │ .js          │
                           └──────────────┘
```

**流程**：
1. 环境变量 `MOCK_MODE=true` 时，server 不调用真实 EvoMap Hub
2. 端点返回预置的 mock 数据（3 个 Agent、悬赏列表、failed/success Capsule、能力链等）
3. `POST /api/demo/start` 触发 `mock-orchestrator.js`，模拟 3 Agent 闭环（不发起真实 HTTP 请求）
4. SSE 日志按时间节奏推送，前端体验与真实模式一致

**启用方式**：
```bash
MOCK_MODE=true npm run server          # 仅后端 Mock
npm run dev:mock                        # 一键启动 Mock 模式（后端 + 前端）
```

### 4.3 Demo 编排流程

```
前端点击"启动 Demo"
       │
       ▼
POST /api/demo/start ──> server 生成 run_id，立即返回
       │
       ▼
setImmediate ──> runOrchestrator(logSink, onPhase)
       │
       ├─ 阶段 1: agent-a-hello
       │   └─ A: hello → ask（发起悬赏）→ publish failed Capsule
       │
       ├─ 阶段 2: agent-b-claim-solve
       │   └─ B: hello → task/list → task/claim → semantic-search → fetch A → publish success → task/complete
       │
       ├─ 阶段 3: agent-a-accept
       │   └─ A: accept-submission（选 B 优胜）
       │
       ├─ 阶段 4: agent-c-reuse
       │   └─ C: hello → semantic-search → fetch B → publish success（溯源 B）
       │
       └─ 阶段 5: chain-earnings
           └─ GET /a2a/assets/chain/:chainId + GET /billing/earnings/:agentId

       │
       ▼ （每条日志通过 broadcastSSE 推送）
前端 EventSource /api/demo/logs ──> 实时展示日志 + 阶段切换
```

**关键设计**：
- `POST /api/demo/start` 立即返回 `run_id`，orchestrator 异步执行（不阻塞 HTTP 响应）
- `logSink` 是一个数组引用，orchestrator 写入日志，server 通过定时器（1s）轮询增量推送给 SSE 客户端
- `onPhase` 回调在阶段切换时触发，server 通过 SSE 推送 `phase` 事件
- 同一时刻只允许一个 Demo 运行（`currentRunId` 单例），重复启动返回 409

---

## 五、核心模块说明

### 5.1 `src/lib/evomap-client.js`：API 封装

封装所有 EvoMap A2A API 调用，分两类：

**信封端点**（GEP-A2A 信封）：
- `hello(nodeId, nodeSecret)` —— 节点握手
- `publish(nodeId, nodeSecret, assets, chainId)` —— 发布 Gene/Capsule
- `validate(nodeId, nodeSecret, assets)` —— 预检 asset_id 哈希
- `fetch(nodeId, nodeSecret, { asset_ids, asset_type })` —— 精准获取资产（触发积分奖励）
- `report(nodeId, nodeSecret, ...)` —— 提交验证报告

**REST 端点**（Bearer 鉴权，不用信封）：
- `taskList(nodeId, nodeSecret, { limit, reputation, min_bounty })` —— 任务列表
- `taskClaim(nodeId, nodeSecret, taskId)` —— 认领任务
- `taskComplete(nodeId, nodeSecret, taskId, assetId, nodeId)` —— 求解者完成任务
- `taskAcceptSubmission(nodeId, nodeSecret, taskId, submissionId)` —— 悬赏者选优胜
- `semanticSearch(nodeId, nodeSecret, query, { outcome, limit, include_context })` —— 语义搜索（支持 outcome=failed）
- `getChain(nodeId, nodeSecret, chainId)` —— 查询能力链
- `getNode(nodeId, nodeSecret, targetNodeId)` —— 查询节点声誉
- `getEarnings(agentId, secret, agentId)` —— 查询积分流水

### 5.2 `src/lib/asset-id.js`：asset_id 计算

```javascript
asset_id = "sha256:" + SHA256(canonicalJSON(asset_without_asset_id_field))
```

- `canonicalJSON(obj)` —— 递归排序 key 后 `JSON.stringify`，对 key 顺序不敏感
- `computeAssetId(asset)` —— 剔除 `asset_id` 字段后计算 SHA-256
- `withAssetId(asset)` —— 原地填充 `asset_id` 字段
- `randomMessageId()` —— 生成 `msg_<timestamp>_<random_hex>` 格式消息 ID

**关键点**：发布前必须用 `POST /a2a/validate` 预检，避免哈希不匹配（422 错误）。

### 5.3 `src/lib/bounty-flow.js`：bounty 流程编排

封装 v5 修正后的 bounty 流程 5 端点：

| 步骤 | 端点 | 调用方 | body |
|---|---|---|---|
| 悬赏者发起 | `POST /a2a/ask` | A | title, signals, bounty, body |
| 求解者认领 | `POST /a2a/task/claim` | B/C | task_id, node_id |
| 求解者发布方案 | `POST /a2a/publish` | B/C | GEP-A2A 信封 |
| 求解者完成任务 | `POST /a2a/task/complete` | B/C | task_id, asset_id, node_id |
| 悬赏者选优胜 | `POST /a2a/task/accept-submission` | A | task_id, submission_id |

> **v5 修正**：v3/v4 曾混淆 `complete`（求解者调用）与 `accept-submission`（悬赏者调用），v5 已修正。

### 5.4 `src/demo/orchestrator.js`：3 Agent 闭环编排

编排完整 Demo 流程，5 个阶段：

1. **agent-a-hello + agent-a-ask-publish**：A 发起悬赏 + 发布 failed Capsule
2. **agent-b-hello + agent-b-claim-solve**：B 认领 + 搜失败经验 + fetch A + 发布 success Capsule + task/complete
3. **agent-a-accept**：A 调用 accept-submission 选 B 优胜（方案 E 命门，失败则 fallback）
4. **agent-c-hello + agent-c-reuse**：C 搜 B 成功经验 + 秒级修复 + 发布 success Capsule 溯源 B
5. **chain-earnings**：查询能力链 + A 的积分流水

**接口**：
```javascript
runOrchestrator({ logSink, onPhase }) → Promise<result>
```

- `logSink`：数组引用，orchestrator 写入日志 `{ ts, level, msg }`
- `onPhase`：阶段变更回调 `(phase) => void`
- 返回 `result`：包含 `a/b/c/accept/chain/earnings` 各阶段结果

### 5.5 `src/demo/mock-orchestrator.js`：Mock 编排（fallback）

> **注**：此模块由 Task 4 实现。当 `MOCK_MODE=true` 时，server 调用 `mock-orchestrator` 替代真实 `orchestrator`。

Mock 编排不发起真实 HTTP 请求，按时间节奏模拟 3 Agent 闭环：
- 预置 3 个 Agent 节点（A/B/C，不同 node_id）
- 预置 failed/success Capsule 模板（asset_id 预计算）
- 按阶段推送 mock 日志（与真实 orchestrator 日志格式一致）
- 前端体验与真实模式完全一致

### 5.6 `src/server.js`：Express API + SSE

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/health` | GET | 健康检查 `{ ok: true, ts, hub_url }` |
| `/api/agents` | GET | A/B/C 三节点状态（并行查询） |
| `/api/bounties` | GET | 悬赏市场列表 |
| `/api/capsules?outcome=failed` | GET | Capsule 列表（semantic-search 过滤） |
| `/api/chain/:chainId` | GET | 能力链资产列表 |
| `/api/earnings/:agentId` | GET | 积分流水 |
| `/api/demo/start` | POST | 触发 orchestrator（异步），返回 `run_id` |
| `/api/demo/status` | GET | Demo 进度查询 |
| `/api/demo/logs` | GET | SSE 流，实时推送日志 |

**SSE 实现**：
- `sseClients` Set 维护所有连接的 Response 对象
- `broadcastSSE(event, data)` 向所有客户端推送事件
- `/api/demo/logs` 端点建立连接后，定时器（1s）轮询 `run.logs` 增量推送
- 客户端断开时清理 `sseClients` 和定时器

**状态管理**：
- `demoRuns` Map：`run_id → run` 对象（status/phase/logs/result）
- `currentRunId`：单例，同一时刻只允许一个 Demo 运行

---

## 六、bounty 流程时序图

```
Agent A (悬赏者)          EvoMap Hub            Agent B (求解者)          Agent C (复用者)
     │                        │                        │                        │
     │── ask ────────────────>│                        │                        │
     │   (50 积分悬赏)         │                        │                        │
     │<──── task_id ──────────│                        │                        │
     │                        │                        │                        │
     │── publish ────────────>│                        │                        │
     │   (failed Capsule,     │                        │                        │
     │    confidence 0.6,     │                        │                        │
     │    chain_id)           │                        │                        │
     │<──── asset_id ─────────│                        │                        │
     │                        │                        │                        │
     │                        │<──── task/list ────────│                        │
     │                        │───── tasks ───────────>│                        │
     │                        │                        │                        │
     │                        │<──── task/claim ───────│                        │
     │                        │───── claimed ─────────>│                        │
     │                        │                        │                        │
     │                        │<──── semantic-search ──│                        │
     │                        │     (outcome=failed)   │                        │
     │                        │───── A's Capsule ─────>│                        │
     │                        │                        │                        │
     │                        │<──── fetch ────────────│                        │
     │                        │     (A's capsule_id)   │                        │
     │                        │───── full payload ────>│                        │
     │<──── +积分 (fetch 奖励)─│                        │                        │
     │                        │                        │                        │
     │                        │<──── publish ──────────│                        │
     │                        │     (success Capsule,  │                        │
     │                        │      reused_asset_id   │                        │
     │                        │      = A's capsule,    │                        │
     │                        │      parent = A's,     │                        │
     │                        │      chain_id 继承)    │                        │
     │                        │───── asset_id ────────>│                        │
     │                        │                        │                        │
     │                        │<──── task/complete ────│                        │
     │                        │     (task_id,          │                        │
     │                        │      asset_id=B's,     │                        │
     │                        │      node_id=B)        │                        │
     │                        │───── completed ───────>│                        │
     │                        │                        │                        │
     │── accept-submission ──>│                        │                        │
     │   (task_id,            │                        │                        │
     │    submission_id)      │                        │                        │
     │<──── accepted ─────────│                        │                        │
     │                        │                        │                        │
     │                        │                        │                        │
     │                        │<──── semantic-search ───────────────────────────│
     │                        │     (outcome=failed +  │                        │
     │                        │      outcome=success)  │                        │
     │                        │───── A + B Capsules ───────────────────────────>│
     │                        │                        │                        │
     │                        │<──── fetch ────────────────────────────────────│
     │                        │     (B's capsule_id)   │                        │
     │                        │───── full payload ────────────────────────────>│
     │                        │                +积分给 B (fetch 奖励)           │
     │                        │                        │                        │
     │                        │<──── publish ──────────────────────────────────│
     │                        │     (success Capsule,  │                        │
     │                        │      parent = B's,     │                        │
     │                        │      chain_id 继承)    │                        │
     │                        │───── asset_id ────────────────────────────────>│
     │                        │                        │                        │
     │                        │                        │                        │
     │── GET chain/:chainId ─>│                        │                        │
     │<──── A→B→C assets ─────│                        │                        │
     │                        │                        │                        │
     │── GET earnings/A ─────>│                        │                        │
     │<──── fetch 奖励流水 ────│                        │                        │
     │                        │                        │                        │
```

**能力链成型**：A（failed）→ B（success, 溯源 A）→ C（success, 溯源 B），三者共享 `chain_id: "chain_react_useeffect_fix"`。

---

## 七、5 个视觉高光时刻

| # | 时刻 | 前端组件 | 触发时机 | 情感锚点 |
|---|---|---|---|---|
| 01 | **蜂群上线** | `BountyMarketplace` 顶部动画 | 3 节点心跳闪烁，绿点逐个亮起 | 蜂群苏醒 |
| 02 | **失败独白** | `FailureMonologueCard` | A 发布 failed Capsule（0:35） | A 从"失败者"变"牺牲者" |
| 03 | **发现瞬间** | `FailureStarMap` 点亮动画 | B semantic-search 命中 A（1:00） | 失败被看见 |
| 04 | **能力链生长** | `CapabilityChainList` 列表 | A→B→C 逐步长出（2:20） | 跨时间群体进化 |
| 05 | **积分到账** | `EarningsLedger` 高亮行 | B fetch A 的 Capsule（2:35） | 失败者被奖励 |

### 组件与 API 对应

| 组件 | 轮询/订阅 | 数据源端点 |
|---|---|---|
| `AgentStatusCard` | `useAgents`（3s） | `GET /api/agents` |
| `BountyMarketplace` | `useBounties`（3s） | `GET /api/bounties` |
| `FailureMonologueCard` | `useCapsules`（3s） | `GET /api/capsules?outcome=failed` |
| `FailureStarMap` | `useCapsules`（3s） | `GET /api/capsules`（全量） |
| `CapabilityChainList` | `useDemoStatus`（1s）触发 | `GET /api/chain/:chainId` |
| `EarningsLedger` | `useDemoStatus`（1s）触发 | `GET /api/earnings/:agentId` |
| `DemoControlPanel` | `useDemoStatus`（1s）+ `useDemoLogs`（SSE） | `GET /api/demo/status` + `GET /api/demo/logs` |

---

## 八、Mock 模式说明

### 何时使用

- **开发阶段**：前端开发时不需要真实 EvoMap 账号，用 Mock 模式快速迭代
- **测试阶段**：集成测试不依赖外部服务，确保 CI 稳定
- **Demo 演练**：现场 Demo 前的干跑，验证前端流程正确性
- **Fallback**：现场网络/API 异常时，切换 Mock 模式作为应急方案

### 如何启用

```bash
# 方式 1：环境变量
MOCK_MODE=true npm run server

# 方式 2：一键启动脚本
npm run dev:mock

# 方式 3：传递参数
node scripts/start-all.js --mock
```

### 与真实模式的差异

| 维度 | 真实模式 | Mock 模式 |
|---|---|---|
| EvoMap Hub 调用 | 真实 HTTP 请求 | 不调用，返回预置数据 |
| Agent 凭证 | 需要 A/B/C 三组真实 node_id + secret | 不需要 |
| asset_id | canonicalJSON + SHA-256 实时计算 | 预计算好的固定值 |
| 积分流水 | 真实 fetch 奖励（有秒级延迟） | 预置的 mock 流水 |
| Demo 编排 | `orchestrator.js` 调用真实 API | `mock-orchestrator.js` 按时间节奏模拟 |
| SSE 日志 | 真实 API 调用日志 | 预置的 mock 日志（格式一致） |
| 前端体验 | 完全一致 | 完全一致 |

> **关键**：Mock 模式下前端体验与真实模式完全一致，仅数据来源不同。这使得前端开发不依赖后端账号配置，也使得现场 Demo 有可靠的 fallback。

---

## 九、部署注意事项

### 9.1 环境要求

- **Node.js >= 18**：使用原生 fetch、node:test、ESM top-level await
- **npm >= 8**：支持 `npm run` 多脚本
- **操作系统**：Windows / macOS / Linux 均可（脚本已做跨平台处理）

### 9.2 端口占用

| 服务 | 端口 | 说明 |
|---|---|---|
| Express API | 3001 | 后端 HTTP + SSE |
| Vite Dev Server | 5173 | 前端开发服务器 |
| EvoMap Hub | 443 (HTTPS) | 远程服务，无需本地端口 |

**端口冲突处理**：
```bash
npm run stop          # 停止占用 3001/5173 的进程
# 或手动指定端口
PORT=3002 npm run server
```

### 9.3 CORS 配置

`src/server.js` 中 CORS 允许来源：
- `http://localhost:5173`
- `http://127.0.0.1:5173`

如需修改前端端口，需同步更新 server.js 的 CORS 配置。

### 9.4 环境变量

| 变量 | 必填 | 说明 |
|---|---|---|
| `A2A_HUB_URL` | 否 | EvoMap Hub 地址，默认 `https://evomap.ai` |
| `PORT` | 否 | Express 端口，默认 `3001` |
| `A_NODE_ID` / `A_NODE_SECRET` | 真实模式必填 | Agent A 凭证（悬赏者） |
| `B_NODE_ID` / `B_NODE_SECRET` | 真实模式必填 | Agent B 凭证（求解者） |
| `C_NODE_ID` / `C_NODE_SECRET` | 真实模式必填 | Agent C 凭证（复用者） |
| `MOCK_MODE` | 否 | `true` 时启用 Mock 模式 |
| `HEARTBEAT_INTERVAL_MS` | 否 | 心跳间隔，默认 300000（5 分钟） |
| `EVOLVER_VALIDATOR_ENABLED` | 否 | 安全刹车，默认 `false` |
| `EVOLVER_AUTO_PUBLISH` | 否 | 安全刹车，默认 `false` |
| `EVOLVER_DEFAULT_VISIBILITY` | 否 | 默认 `private` |

### 9.5 安全刹车（必读）

```bash
EVOLVER_VALIDATOR_ENABLED=false   # 避免自动质押 100 积分
EVOLVER_ATP_AUTOBUY=off           # 避免自动购买付费资产
EVOLVER_AUTO_PUBLISH=false        # 手动 review 后再发布
EVOLVER_DEFAULT_VISIBILITY=private
```

> 这些安全刹车在 `.env.example` 中已默认配置，防止 Demo 期间意外扣费。

### 9.6 一键启动流程

```bash
# 1. 首次配置（安装依赖 + 创建 .env + self-test）
npm run setup

# 2. 编辑 .env 填入凭证（或跳过，用 Mock 模式）
#    Windows: notepad .env
#    Mac:     open -e .env

# 3. 启动开发服务
npm run dev          # 真实模式
npm run dev:mock     # Mock 模式（推荐开发用）

# 4. 停止服务
npm run stop

# 5. 运行测试
npm test
```

### 9.7 生产部署（参考）

当前项目为黑客松 Demo，生产部署需额外考虑：
- 后端用 PM2 守护进程：`pm2 start src/server.js --name bountyhive`
- 前端构建静态资源：`cd frontend && npm run build`，用 nginx 托管 `dist/`
- 反向代理：nginx 将 `/api/*` 转发到 Express 3001，其余走静态资源
- 环境变量：用 PM2 ecosystem 配置或 Docker env 注入
- 日志：PM2 logs 或 Docker logs

---

## 十、参考文档

- [项目 README](../README.md) - 项目说明 + 启动步骤
- [Demo 脚本](demo-script.md) - 3 分钟逐秒脚本
- [Fallback 预案](demo-fallback.md) - 应急手册
- [现场 checklist](demo-checklist.md) - 执行清单
- [Q&A 预案](qa-playbook.md) - 评委问答
- [方案 E v5](../方案E-BountyHive-修正版.md) - 完整方案设计
- [EvoMap skill 文档](../evomap-skill-docs/) - 协议参考

---

*文档版本：v5 准确版对齐*
*生成时间：2026-06-21*
*依据：方案 E v5 + 现有代码结构 + evomap-skill-docs*
