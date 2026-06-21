# BountyHive Frontend // 蜂群进化看板

> **一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。**

EvoMap 黑客松方案 E（BountyHive）的 React 看板，展示 Demo 的 5 个视觉高光时刻：
蜂群上线 → 失败独白 → 发现瞬间 → 能力链生长 → 积分到账。

## 技术栈

- React 18 + Vite 5
- Tailwind CSS 3（深色赛博朋克主题）
- 原生 fetch 轮询 + EventSource（SSE）实时日志
- 无额外状态管理库，纯 React hooks

## 启动步骤

### 1. 先启动后端

后端运行在 `http://localhost:3001`，提供 `/api/*` 接口。

```bash
cd ..          # 进入 bountyhive 根目录
npm run server # 启动后端（端口 3001）
```

### 2. 再启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`，`/api` 请求自动代理到 `http://localhost:3001`。

### 3. 构建验证

```bash
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

## 目录结构

```
frontend/
├── index.html
├── package.json
├── vite.config.js          # /api 代理到 localhost:3001
├── tailwind.config.js      # 深色主题 + 霓虹色 + 动画
├── postcss.config.js
├── public/
│   └── hive.svg            # 站点图标
└── src/
    ├── main.jsx
    ├── App.jsx             # 单页布局：Header → 控制台 → 蜂群 → 市场 → 独白 → 星图 → 能力链 → 流水 → Footer
    ├── index.css           # Tailwind 指令 + 全局深色主题 + 蜂巢网格 + 扫描线
    ├── hooks/
    │   ├── useAgents.js        # 轮询 GET /api/agents（3s）
    │   ├── useBounties.js      # 轮询 GET /api/bounties（3s）
    │   ├── useCapsules.js      # 轮询 GET /api/capsules?outcome=failed（3s）
    │   ├── useDemoStatus.js    # 轮询 GET /api/demo/status（1s）
    │   └── useDemoLogs.js      # EventSource /api/demo/logs
    └── components/
        ├── AgentStatusCard.jsx       # Agent 状态卡片（心跳动画）
        ├── BountyMarketplace.jsx     # 悬赏市场 + 蜂群上线动画
        ├── FailureMonologueCard.jsx  # 失败独白（情感锚点）
        ├── FailureStarMap.jsx        # 失败经验星图 + 发现瞬间
        ├── CapabilityChainList.jsx   # 能力链列表（A→B→C）
        ├── EarningsLedger.jsx        # 积分流水表格
        └── DemoControlPanel.jsx      # Demo 控制台（启动/状态/日志）
```

## 后端 API 合约

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/agents` | A/B/C 三节点状态 |
| GET | `/api/bounties` | 悬赏市场列表 |
| GET | `/api/capsules?outcome=failed` | 失败 Capsule 列表 |
| GET | `/api/chain/:chainId` | 能力链资产列表 |
| GET | `/api/earnings/:agentId` | 积分流水 |
| POST | `/api/demo/start` | 触发 Demo 编排 |
| GET | `/api/demo/status` | Demo 进度 |
| GET | `/api/demo/logs` | SSE 实时日志流 |

## 5 个视觉高光时刻

| # | 时刻 | 组件 | 触发 |
|---|---|---|---|
| 01 | 蜂群上线 | `BountyMarketplace` 顶部动画 | 3 节点心跳闪烁 |
| 02 | 失败独白 | `FailureMonologueCard` | A 发布 failed Capsule |
| 03 | 发现瞬间 | `FailureStarMap` 点亮动画 | B semantic-search 命中 A |
| 04 | 能力链生长 | `CapabilityChainList` 列表 | A→B→C 逐步长出 |
| 05 | 积分到账 | `EarningsLedger` 高亮行 | B fetch A 的 Capsule |

## 设计要点

- **深色赛博朋克主题**：深空背景 + 蜂巢网格 + 扫描线叠加
- **霓虹色系**：青色（信号）、品红（A 节点）、绿色（成功/在线）、红色（失败）、琥珀（积分）
- **字体**：Orbitron（标题，科幻终端感）+ JetBrains Mono（正文，技术等宽）
- **实时更新**：3s 轮询 + 1s Demo 状态 + SSE 日志流
- **空状态**：Demo 未启动时各区域显示"等待 Demo 启动..."占位
- **错误处理**：API 失败时显示错误提示，不崩溃

## 已知限制

- 能力链用列表展示（v5 决定砍掉图形化），通过缩进 + 连线表达父子关系
- 蜂群热力图收尾用 `EarningsLedger`（积分流水）替代
- 未连接后端时各区域显示占位文案，不会崩溃
- `FailureStarMap` 内部额外轮询 `/api/capsules`（全量）以获取 success 节点
