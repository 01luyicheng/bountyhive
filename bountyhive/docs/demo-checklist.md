# BountyHive Demo 现场 Checklist（按时间顺序）

> **版本**：v5 准确版对齐
> **用途**：现场执行清单，由讲解人、后端操作员、Q&A 答辩人共同遵循
> **原则**：每一项必须打勾确认，不得跳过

---

## 一、Demo 前 1 小时

### 1.1 后端启动

- [ ] 后端启动：`npm run server`（默认端口 3001，可用 `PORT` 覆盖）
- [ ] 确认 `http://localhost:3001/api/agents` 返回 3 节点（A/B/C，状态 online）（若修改了 `PORT` 请使用对应端口）
- [ ] 确认后端日志无报错
- [ ] 确认 `.env` 中 `A2A_HUB_URL=https://evomap.ai` 配置正确
- [ ] 确认安全刹车已生效：`EVOLVER_VALIDATOR_ENABLED=false`、`EVOLVER_AUTO_PUBLISH=false`、`EVOLVER_DEFAULT_VISIBILITY=private`

### 1.2 前端启动

- [ ] 前端启动：`npm run dev`（默认端口 5173，可用 `FRONTEND_PORT` 覆盖）
- [ ] 确认 `http://localhost:5173` 正常加载（若修改了 `FRONTEND_PORT` 请使用对应端口）
- [ ] 确认 5 个区域空状态正常：
  - [ ] 悬赏市场总览图（开场用）
  - [ ] 失败独白卡片区域（冲突用）
  - [ ] 失败经验星图（进化用）
  - [ ] 能力链视图（高潮用）
  - [ ] 蜂群进化热力图（收尾用）
- [ ] 确认"启动 Demo"按钮可点击

### 1.3 心跳启动

- [ ] 心跳启动：`npm run heartbeat`
- [ ] 确认 3 节点 AgentStatusCard 绿点（online）
- [ ] 确认心跳间隔 60 秒（Demo 期间缩短保活）
- [ ] 确认心跳脚本日志无 timeout

### 1.4 账户与凭证

- [ ] A/B/C 三账户凭证已填入 `.env`：
  - [ ] `A_NODE_ID` / `A_NODE_SECRET`
  - [ ] `B_NODE_ID` / `B_NODE_SECRET`
  - [ ] `C_NODE_ID` / `C_NODE_SECRET`
- [ ] 三账户已认领节点（claim_url 已访问）
- [ ] 三账户已启用"Agent 自主行为"（否则 `/a2a/ask` 失败）
- [ ] 三账户余额充足（A 至少 50 积分用于 ask 悬赏）

### 1.5 预发布校验（v5 命门 + 冒烟）

- [ ] **命门：bounty 流程端到端**
  - [ ] A: `POST /a2a/ask`（50 积分悬赏）→ 返回 task_id
  - [ ] B: `POST /a2a/task/claim`（task_id, node_id_B）→ 返回 claimed
  - [ ] B: `POST /a2a/publish`（success Capsule）→ 返回 asset_id
  - [ ] B: `POST /a2a/task/complete`（task_id, asset_id, node_id_B）→ 返回 completed
  - [ ] A: `POST /a2a/task/accept-submission`（task_id, submission_id）→ 返回 accepted
  - [ ] **若任一步骤失败 → 切预录视频，不现场跑 bounty 流程**
- [ ] **冒烟 1：semantic-search 检索 failed Capsule**
  - [ ] 预发布一个 failed Capsule，等待 30 秒
  - [ ] `GET /a2a/assets/semantic-search?q=useEffect+dependency&outcome=failed` → 确认能搜到
- [ ] **冒烟 2：跨账户 fetch 产生积分**
  - [ ] B fetch A 的预发布 Capsule
  - [ ] `GET /billing/earnings/node_agent_a` → 确认 A 有 fetch 奖励流水
- [ ] 所有 Capsule（capsule_lesson_burned_001 / capsule_success_001 / C 的 Capsule）已用 `POST /a2a/validate` 预检通过（asset_id 哈希匹配）

### 1.6 备用资源

- [ ] 完整 3 分钟预录视频已下载到本地，可离线播放
- [ ] 预录视频播放器（VLC/PotPlayer）已打开，快捷键已绑定
- [ ] 手机热点已开启，流量充足（>500MB）
- [ ] 3 账户登录截图已准备（3 个不同邮箱 + 3 个不同 node_id）
- [ ] `GET /a2a/directory` 页面截图已准备（证明 3 节点独立）
- [ ] 3 节点声誉详情截图已准备（`GET /a2a/nodes/:nodeId`）
- [ ] 评委 Q&A 速查卡（`qa-playbook.md` 精简版）已打印
- [ ] "预期流水"截图已准备（标注"预期流水"水印）
- [ ] 本地能力链关系图已准备（fallback 最后手段）

---

## 二、Demo 前 5 分钟

### 2.1 干跑验证

- [ ] 运行 `npm run demo` 干跑一次（不真的发布，只验证流程）
- [ ] 确认前端各阶段切换正常
- [ ] 确认 API 调用时序与脚本一致

### 2.2 节点状态

- [ ] 确认 3 节点 AgentStatusCard 全绿（online）
- [ ] 确认心跳脚本运行中，无 timeout
- [ ] 确认 hello 限流余量充足（Demo 前不再 hello）

### 2.3 前端状态

- [ ] 确认前端各区域空状态正常（无残留数据）
- [ ] 确认"启动 Demo"按钮可点击
- [ ] 确认 fallback 视图切换快捷键可用（candidate 列表 / 本地能力链 / 预期流水）

### 2.4 网络状态

- [ ] 确认网络稳定：`ping evomap.ai` < 100ms
- [ ] 确认 `curl https://evomap.ai/a2a/stats` 响应 <2s
- [ ] 备用网络（手机热点）已就绪，可一键切换

### 2.5 人员就位

- [ ] 讲解人就位，口播词熟悉（`demo-script.md` 第五节节奏提示）
- [ ] 后端操作员就位，fallback 快捷键熟悉
- [ ] Q&A 答辩人就位，`qa-playbook.md` 速查卡在手
- [ ] 三人通讯渠道畅通（微信/对讲机）

---

## 三、Demo 中（按时间点核对）

### 3.1 开场阶段（0:00-0:20）

- [ ] **0:00** 启动 Demo（点击前端"启动 Demo"按钮）
- [ ] **0:00** 蜂群上线动画播放，3 节点心跳闪烁
- [ ] **0:10** A 调用 `POST /a2a/ask`（50 积分悬赏），确认返回 task_id
- [ ] **0:10** 悬赏市场总览图弹出 A 的悬赏卡片

### 3.2 冲突阶段（0:20-1:00）

- [ ] **0:20** A 本地修复动画播放（添加 state 变量到依赖数组）
- [ ] **0:35** 测试变红，A 调用 `POST /a2a/publish`（failed Capsule）
- [ ] **0:35** **失败独白卡片弹出**（暗红色背景，打字机文字）—— 核心情感锚点 1
- [ ] **0:35** 确认 publish 响应 200 OK，高亮 confidence 0.6 / outcome failed / chain_id
- [ ] **0:50** Capsule 在失败经验星图中以暗红色脉冲出现

### 3.3 进化阶段（1:00-1:55）

- [ ] **1:00** B 调用 `GET /a2a/assets/semantic-search?outcome=failed`
- [ ] **1:00** **发现瞬间**：A 的 Capsule 被金色高亮点亮 —— 核心情感锚点 2
- [ ] **1:15** B 调用 `POST /a2a/fetch`（asset_ids: A的capsule_id），确认返回完整 payload
- [ ] **1:15** A 的账户旁出现"+积分"提示
- [ ] **1:30** B 修复动画播放（添加 useCallback 回调到依赖数组），测试变绿
- [ ] **1:30** B 调用 `POST /a2a/publish`（success Capsule，含 reused_asset_id / parent / chain_id）
- [ ] **1:45** B 调用 `POST /a2a/task/complete`，A 调用 `POST /a2a/task/accept-submission`
- [ ] **1:45** 前端展示 chain_id 关联 A 和 B 的 Capsule

### 3.4 高潮阶段（1:55-2:35）

- [ ] **1:55** C 调用 `GET /a2a/assets/semantic-search?outcome=failed` 和 `outcome=success`
- [ ] **1:55** C 搜索结果同时显示 A（failed）和 B（success）
- [ ] **2:00** C 调用 `POST /a2a/fetch`（B的capsule_id），秒级修复
- [ ] **2:10** C 调用 `POST /a2a/publish`（Capsule 继承 chain_id）
- [ ] **2:20** 前端调用 `GET /a2a/assets/chain/chain_react_useeffect_fix`
- [ ] **2:20** **能力链生长动画**：A→B→C 三节点依次亮起 —— 核心情感锚点 3
- [ ] **2:20** 确认能力链列表展示 A→B→C 三节点

### 3.5 收尾阶段（2:35-3:00）

- [ ] **2:35** 前端调用 `GET /billing/earnings/node_agent_a`
- [ ] **2:35** A 的 fetch 积分流水展示（若到账延迟，切"预期流水"截图 + 诚实标注）
- [ ] **2:45** 蜂群进化热力图展示，镜头拉远，热力图从红转绿
- [ ] **2:55** 点题句大字居中展示："一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。"
- [ ] **3:00** Demo 结束，确认总时长 ≤190 秒

---

## 四、Demo 后 Q&A

### 4.1 Q&A 流程

- [ ] 评委提问时，先指派一人查 `qa-playbook.md` 速查卡
- [ ] 涉及 API 细节时，打开 `evomap-skill-docs/` 对应章节
- [ ] 涉及"自己发布自己接"质疑时，展示 3 账户登录截图 + directory 页面截图
- [ ] 涉及 GDI 变化时，主动诚实标注"预期影响"
- [ ] 涉及 bounty 流程时，确认口述：ask → claim → publish → complete（求解者）→ accept-submission（悬赏者）

### 4.2 Q&A 红线（不能说的话）

- [ ] 确认所有答辩人知晓 Q&A 红线（见 `qa-playbook.md` 末尾）
- [ ] 不说"这是 EvoMap 平台的问题"（评委是 EvoMap 举办方）
- [ ] 不说"我们没实测过"（即使没实测，也要说"已通过 validate 端点预检"）
- [ ] 不说"这个字段是我们自创的"（所有字段指向 skill 文档）
- [ ] 不说"GDI 从 X 升到 Y"（动态数字，改说"预期影响"）
- [ ] 不说"完整流程就是这样"（若跳过 bounty 步骤，必须说"加速展示"）

### 4.3 Q&A 收尾

- [ ] 评委无更多问题后，讲解人致谢
- [ ] 后端操作员关闭心跳脚本（避免持续占用 hello 限流配额）
- [ ] 收集评委名片/联系方式（若有后续合作意向）

---

## 五、应急联络

| 角色 | 职责 | 联络方式 |
|---|---|---|
| 讲解人 | 口播、节奏控制、切预录视频决策 | ________ |
| 后端操作员 | API 调用、fallback 切换、网络切换 | ________ |
| Q&A 答辩人 | Q&A 阶段回答、查速查卡、展示截图 | ________ |

> **三人通讯原则**：Demo 中只用文字通讯（微信），不用语音（避免被评委听到）。Q&A 阶段可语音协调。

---

*文档版本：v5 准确版对齐*
*生成时间：2026-06-21*
*依据：方案 E v5 + evomap-skill-docs*
