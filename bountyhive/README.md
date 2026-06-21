# BountyHive

> EvoMap 黑客松方案 E —— 悬赏市场蜂群接单进化体
>
> **点题**：一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。

BountyHive 是 EvoMap 悬赏市场上的优质 Agent 供应商。通过失败经验沉淀 + 能力链溯源，让蜂群越接单越聪明。

## 故事闭环

| 阶段 | Agent | 动作 |
|---|---|---|
| 冲突 | A | 发起悬赏 → 自己尝试修复失败 → 发布 `capsule_lesson_burned_001`（failed） |
| 进化 | B | semantic-search 搜到 A 的失败经验 → fetch（A 获积分）→ 避雷成功 → 发布 `capsule_success_001`（success，溯源 A） |
| 高潮 | C | semantic-search 搜到 A 失败 + B 成功 → fetch B → 秒级复用 → 发布 `capsule_success_002`（溯源 B） |
| 收尾 | — | 能力链 `chain_react_useeffect_fix` 完整呈现：A→B→C |

## 技术栈

- Node.js（ESM, `"type": "module"`）
- 原生 fetch（Node 18+）调用 A2A API，不引入 SDK
- Express 提供 HTTP API 供前端调用
- dotenv 读环境变量

## 项目结构

```
bountyhive/
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── src/
│   ├── lib/
│   │   ├── asset-id.js          # canonicalJSON + computeAssetId + randomMessageId
│   │   ├── evomap-client.js     # 所有 A2A API 封装（信封 + REST）
│   │   ├── bounty-flow.js       # bounty 流程编排
│   │   ├── mock-data.js         # Mock 模式数据生成器（MOCK_MODE=true 时使用）
│   │   └── self-test.js         # asset_id 计算自测
│   ├── demo/
│   │   ├── agent-templates.js   # 3 个 Agent 的 Gene/Capsule 模板
│   │   ├── agent-a.js           # A：发起悬赏 + 失败 Capsule
│   │   ├── agent-b.js           # B：认领 + 成功 Capsule + 溯源 A
│   │   ├── agent-c.js           # C：复用 B 经验 + 秒级修复
│   │   ├── orchestrator.js      # 编排 3 Agent 闭环（真实模式）
│   │   ├── mock-orchestrator.js # Mock 模式编排（带延时，不调用 Hub）
│   │   └── heartbeat.js         # 心跳保活
│   └── server.js                # Express HTTP API + SSE
```

## 启动步骤

### 1. 安装依赖

```bash
cd bountyhive
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入 A/B/C 三组凭证。凭证来源：

- **已有账号**：从 `~/.evomap/node_id` 和 `~/.evomap/node_secret` 读取（Windows 路径 `%USERPROFILE%\.evomap\`）
- **新注册**：留空 `A_NODE_ID`/`A_NODE_SECRET`，运行 `npm run demo` 时会自动注册并打印 `claim_url`，用户在浏览器打开绑定账号后即可

> ⚠️ 必须用 3 个不同账户的 Agent，才能展示真实积分流动（同账户 fetch 不产生奖励，且有环形交易检测）。

### 2.1 Mock 模式（黑客松现场 fallback）

如果遇到以下情况，请开启 Mock 模式：

- **无 EvoMap 账号**：未注册或未绑定 A/B/C 三组凭证
- **网络不稳定**：现场网络无法访问 `https://evomap.ai`
- **前端调试**：只关心前端交互，不需要真实后端
- **Demo fallback**：真实 Demo 失败时立即切换，保证现场可演示

**开启方式**：在 `.env` 中设置

```bash
MOCK_MODE=true
```

或运行时通过环境变量传入（PowerShell）：

```powershell
$env:MOCK_MODE='true'; node src/server.js
```

或使用 `--mock` 一键启动（后端 + 前端）：

```bash
npm run dev:mock
# 等价于 node scripts/start-all.js --mock
```

**Mock 模式下的 Demo 行为**：

- 所有 `/api/*` 端点返回本地 mock 数据，不调用 EvoMap Hub
- `POST /api/demo/start` 触发 mock orchestrator，按 9 个阶段推进（每阶段 2-3 秒延时，总时长约 20 秒）
- 完整保留 5 个视觉高光时刻：
  1. Agent A 发布 failed Capsule + 失败独白
  2. Agent B 搜失败经验 + 溯源 A 成功修复
  3. Agent A 选优胜（accept-submission）
  4. Agent C 复用 B 经验秒级修复
  5. 能力链 `chain_react_useeffect_fix` 完整呈现 A→B→C
- asset_id 用真实 `computeAssetId` 计算（格式正确），但不写入 EvoMap Hub
- 前端无需任何修改，正常调用 `/api/*` 即可看到完整 Demo

### 3. 启动服务

```bash
# 启动 Express API（默认端口 3001，可用 PORT 覆盖）+ 心跳保活
npm start

# 或分开启动
npm run server       # 仅 Express API
npm run heartbeat    # 仅心跳

# Mock 模式一键启动（后端 + 前端，默认 3001/5173；可用 PORT / FRONTEND_PORT 覆盖）
npm run dev:mock
```

### 4. 运行 Demo

```bash
# 命令行直接跑完整闭环
npm run demo

# 或通过 HTTP API 触发（前端调用）
curl -X POST http://localhost:3001/api/demo/start
```

### 5. 验证 asset_id 计算

```bash
npm run self-test
```

## HTTP API（默认端口 3001，可用 PORT 覆盖；CORS 允许前端默认地址 localhost:5173）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/agents` | 返回 A/B/C 三节点状态 |
| GET | `/api/bounties` | 返回悬赏市场列表 |
| GET | `/api/capsules?outcome=failed` | 返回 Capsule 列表（支持 outcome 过滤） |
| GET | `/api/chain/:chainId` | 返回能力链资产列表 |
| GET | `/api/earnings/:agentId` | 返回积分流水 |
| POST | `/api/demo/start` | 触发 orchestrator 异步执行，返回 run_id |
| GET | `/api/demo/status` | 返回当前 Demo 进度 |
| GET | `/api/demo/logs` | SSE 流，实时推送 Demo 日志 |

## 关键设计

### asset_id 计算

```javascript
asset_id = "sha256:" + SHA256(canonicalJSON(asset_without_asset_id_field))
```

canonical JSON = 递归排序 key 后 JSON.stringify。发布前先调 `/a2a/validate` 预检。

### GEP-A2A 信封

`hello`/`publish`/`validate`/`fetch`/`report` 用信封：

```json
{
  "protocol": "gep-a2a",
  "protocol_version": "1.0.0",
  "message_type": "<hello|publish|fetch|...>",
  "message_id": "msg_<timestamp>_<random_hex>",
  "sender_id": "<your_node_id>",
  "timestamp": "<ISO 8601 UTC>",
  "payload": { ... }
}
```

REST 端点（`/a2a/heartbeat`、`/a2a/task/*`、`/a2a/assets/*`、`/billing/*`）不用信封，只需 `Authorization: Bearer <node_secret>`。

### bounty 流程（v5 修正端点）

| 步骤 | 端点 | body |
|---|---|---|
| 悬赏者发起 | `POST /a2a/ask` | title, signals, bounty, body |
| 求解者认领 | `POST /a2a/task/claim` | task_id, node_id |
| 求解者发布方案 | `POST /a2a/publish` | GEP-A2A 信封 |
| 求解者完成任务 | `POST /a2a/task/complete` | task_id, asset_id, node_id |
| 悬赏者选优胜 | `POST /a2a/task/accept-submission` | task_id, submission_id |

### failed Capsule 字段

- `outcome: { status: "failed", score: 0.4 }`
- `confidence: 0.6`
- `source_type: "generated"`
- `chain_id` 必填

### success Capsule 溯源字段

- `source_type: "generated"`
- `reused_asset_id: "sha256:<A的capsule_id>"`
- `parent: "sha256:<A的capsule_id>"`
- `chain_id` 继承自 A

## 已知限制

- 未实测端点：`POST /a2a/task/accept-submission` 是否即时完成（方案 E 命门，需现场验证）
- semantic-search 有 30 秒缓存延迟，Demo 脚本中已预留缓冲
- 跨账户 fetch 真实产生积分依赖环形交易检测不误判（建议 A/B/C 用不同网络）
- Demo 状态用内存 Map 维护，重启丢失
- Mock 模式数据为本地生成，asset_id 用真实 `computeAssetId` 计算（格式正确），但不写入 EvoMap Hub
- Gene/Capsule 模板包含业务 `id` 字段（如 `capsule_lesson_burned_001`）以及 `source_type` / `reused_asset_id` / `parent` 等溯源字段，用于 Demo 叙事；若 EvoMap Hub 的 `validate` 端点拒绝可移除。云端相关问题由 EvoMap 举办方处理

## 参考

- 方案 E 文档：`../方案E-BountyHive-修正版.md`
- 官方 skill 文档：`../evomap-skill-docs/`
