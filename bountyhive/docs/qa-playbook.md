# BountyHive 评委 Q&A 预案（速查卡）

> **版本**：v5 准确版对齐
> **用途**：Q&A 阶段速查，答辩人手持此文档
> **原则**：主动诚实比被拆穿好；所有回答必须指向 skill 文档，不自创字段
> **覆盖**：Q1-Q9（方案 E 第十二节）+ Q10-Q15（新增）

---

## Q1：失败 Agent 的激励机制是什么？为什么要分享失败经验？

### 30 秒口播回答

> EvoMap 协议原生支持三种激励。第一，fetch 奖励：Agent B fetch A 的 Capsule 时，A 自动获得 0-12 积分，按 GDI 分档。第二，验证奖励：B 对 A 提交验证报告，B 获得 10-30 积分。第三，声誉提升：A 的 Capsule 被 B 复用后，A 的 usage_evidence 上升，声誉公式中的 validated_confidence × 12 × usage_evidence 项提升。这些都是协议原生机制，不需要额外设计。Demo 中我们展示了 A 的积分流水。

### 支撑证据

- **fetch 奖励**：`POST /a2a/fetch` 触发，A 获 0-12 积分（GDI 分档：21-40→2, 41-60→5, 61-80→8, 81-100→12）
- **验证奖励**：`POST /a2a/report` 提交验证报告，B 获 10-30 积分（base 10 + min(files×2,10) + min(floor(lines/20),10)）
- **收益明细**：`GET /billing/earnings/:agentId` 查看 A 的真实流水
- **Demo 截图**：2:35 收尾阶段 A 的 fetch 积分流水

### 延伸材料

- `evomap-skill-docs/evomap-skill-protocol.md` —— fetch 端点详情
- `evomap-skill-docs/evomap-skill-tasks.md` —— 任务奖励机制
- 方案 E 第一节第 4 点"激励机制"表格

---

## Q2："自己发布悬赏再派 Agent 接"是不是作弊？

### 30 秒口播回答

> 我们用 3 个不同账户的 Agent，A/B/C 分属三位不同队员，不同邮箱注册，不同 node_id。不是左手倒右手。EvoMap 的环形交易检测会拦截同一所有者的自买自卖，我们的设计完全合规。真实场景中，企业发布悬赏、BountyHive 的 Agent 群接单、向企业收取服务费，这是成熟商业模式。

### 支撑证据

- **3 账户登录截图**：3 个不同邮箱 + 3 个不同 node_id
- **directory 截图**：`GET /a2a/directory` 展示 A/B/C 三个独立节点
- **节点声誉截图**：`GET /a2a/nodes/:nodeId` 三个节点的独立声誉详情
- **环形交易检测**：协议明确拦截同一所有者的自买自卖

### 延伸材料

- `evomap-skill-docs/evomap-skill-protocol.md` —— `GET /a2a/directory` 端点
- `evomap-skill-docs/evomap-skill-protocol.md` —— `GET /a2a/nodes/:nodeId` 端点
- 方案 E 第五节"多账户策略"

---

## Q3：failed Capsule 怎么被其他 Agent 发现？

### 30 秒口播回答

> 用 `GET /a2a/assets/semantic-search?outcome=failed` 端点，这是 EvoMap 协议原生支持的失败经验检索接口。failed Capsule 虽然大概率停留 candidate 状态——因为 success_streak 为 0 等因素导致 GDI 内在质量分较低——但 semantic-search 可以检索 candidate 状态的资产，文档明确"常规列表仅排除 delisted 资产"。Demo 中 B 就是这样搜到 A 的失败 Capsule 的。

### 支撑证据

- **检索端点**：`GET /a2a/assets/semantic-search?q=useEffect+dependency&outcome=failed&include_context=true&limit=10`
- **outcome 过滤**：semantic-search 支持 `outcome=failed` 参数
- **candidate 可见**：常规列表仅排除 delisted，candidate 状态可检索
- **Demo 截图**：1:00 进化阶段 B 的 semantic-search 结果

### 延伸材料

- `evomap-skill-docs/evomap-skill-protocol.md` —— `GET /a2a/assets/semantic-search` 端点
- `evomap-skill-docs/evomap-skill-structures.md` —— Asset Lifecycle（candidate/promoted/rejected/revoked）
- 方案 E 第一节第 2 点"失败经验的沉淀与发现"

---

## Q4：如何保证溯源的真实性？

### 30 秒口播回答

> Agent B 发布 success Capsule 时，主动声明三个溯源字段：source_type 设为 generated，表示 B 自己生成了这个 Capsule；reused_asset_id 指向 A 的 capsule_id，表示 B 复用了 A 的经验；parent 也指向 A 的 capsule_id，建立父子关系。同时 B 的 Gene 的 parent 指向 A 的 Gene。这些是 GEP 协议的真实溯源字段。通过 `GET /a2a/assets/:id/timeline` 可以验证溯源链，通过 `GET /a2a/assets/chain/:chainId` 可以查看完整能力链。

### 支撑证据

- **溯源字段**：`reused_asset_id`、`parent`、`source_type: "generated"`、Gene 的 `parent`
- **chain_id 继承**：A/B/C 的 Capsule 共享 `chain_id: "chain_react_useeffect_fix"`
- **时间线验证**：`GET /a2a/assets/:id/timeline` 查看资产进化时间线
- **能力链验证**：`GET /a2a/assets/chain/chain_react_useeffect_fix` 查看完整链
- **Demo 截图**：2:20 高潮阶段能力链 A→B→C

### 延伸材料

- `evomap-skill-docs/evomap-skill-structures.md` —— Capsule Structure（parent / reused_asset_id）
- `evomap-skill-docs/evomap-skill-protocol.md` —— `GET /a2a/assets/chain/:chainId`、`GET /a2a/assets/:id/timeline`
- 方案 E 第一节第 3 点"溯源与能力链延伸"

> **v5 修正注**：source_type 从 "reference" 改为 "generated"（v5 修正点 #7）。"generated" 表示 B 自己生成了 success Capsule，而 reused_asset_id / parent 字段单独承担"复用 A 的经验"的溯源语义。

---

## Q5：这和 BugSwarm 有什么区别？

### 30 秒口播回答

> BugSwarm 是"蜂群协作修 Bug"：多个 Agent 同时协作，分解任务，共同解决一个问题。BountyHive 是"悬赏驱动的经验沉淀"：Agent 独立接单，失败后沉淀经验，后续 Agent 复用经验。BugSwarm 强调"同时协作"，BountyHive 强调"跨时间复用"。BountyHive 的失败经验通过 Capsule 永久存储，形成能力链，这是跨时间的群体进化。一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。

### 支撑证据

- **BugSwarm 模式**：`POST /a2a/task/propose-decomposition` 分解任务，多 Agent 同时协作
- **BountyHive 模式**：`POST /a2a/publish` 沉淀经验 + `GET /a2a/assets/chain/:chainId` 跨时间复用
- **核心差异**：同时协作 vs 跨时间复用
- **Demo 截图**：2:20 能力链 A→B→C 跨时间复用

### 延伸材料

- `evomap-skill-docs/evomap-skill-tasks.md` —— Swarm 多 Agent 任务分解
- `evomap-skill-docs/evomap-skill-protocol.md` —— `GET /a2a/assets/chain/:chainId` 能力链
- 方案 E 第十三节"与其他方案对比"

---

## Q6：GDI 分数变化是演的吗？

### 30 秒口播回答

> 诚实回答：GDI 的 usage 维度基于 30 天滚动窗口，3 分钟 Demo 内无法展示真实变化。我们展示的是 GDI 的四维构成——intrinsic 35% + usage 30% + social 20% + freshness 15%——和各维度的真实字段值，并明确标注"预期影响"。实际的 fetch、验证、评价都是真实调用 EvoMap API，积分到账是真实的。主动诚实比被拆穿好。

### 支撑证据

- **GDI 四维构成**：intrinsic 35% + usage 30% + social 20% + freshness 15%
- **真实字段值**：`GET /a2a/nodes/:nodeId` 返回的声誉详情
- **真实积分**：`GET /billing/earnings/:agentId` 的 fetch 奖励流水
- **诚实标注**：Demo 中 GDI 展示标注"预期影响"，非动态数字

### 延伸材料

- `evomap-skill-docs/evomap-skill-protocol.md` —— `GET /a2a/nodes/:nodeId` 节点声誉
- `evomap-skill-docs/evomap-skill-structures.md` —— Capsule 的 success_streak / blast_radius 字段
- 方案 E 第十一节"劣势与诚实告知"

---

## Q7：BountyHive 的商业模式是什么？凭什么收钱？

### 30 秒口播回答

> BountyHive 不是收"平台抽成"——那是 EvoMap 平台的。我们重新定位为 EvoMap 悬赏市场的优质 Agent 供应商。三个收入来源：第一，企业 Agent 服务费，企业发布悬赏，BountyHive 的 Agent 群接单，向企业收取服务费；第二，企业内部 Agent 培训平台，按 Agent 数量/月收费；第三，能力链授权，高质量能力链授权给其他企业。类比：EvoMap 是淘宝，BountyHive 是淘宝上的优质店铺。

### 支撑证据

- **悬赏市场入口**：`POST /a2a/ask` + `GET /a2a/task/list` + `POST /a2a/task/claim`
- **能力链资产**：`GET /a2a/assets/chain/:chainId` 可授权的高质量链
- **服务市场**：`POST /a2a/service/publish` 发布服务能力
- **差异化价值**：失败经验沉淀 → 接单成功率高于普通 Agent

### 延伸材料

- `evomap-skill-docs/evomap-skill-advanced.md` —— Service Marketplace 服务市场
- `evomap-skill-docs/evomap-skill-tasks.md` —— Bounty 任务流程
- 方案 E 第九节"商业模式"

---

## Q8：失败经验沉淀是不是包装协议字段？

### 30 秒口播回答

> 我们不是在包装协议字段，而是在发现协议的设计意图。EvoMap 协议支持 outcome=failed，就是为了鼓励失败经验沉淀；semantic-search?outcome=failed 是协议原生检索能力；reused_asset_id 是协议原生溯源字段。我们把这些机制用起来，让失败成为群体进化的起点。这是协议设计者希望看到的用法，不是我们的包装。护城河在于：即使其他团队用 outcome=failed 做同样的事，BountyHive 的差异化在于"悬赏市场闭环 + 能力链可视化 + 失败独白情感锚点"的完整产品形态。

### 支撑证据

- **协议原生字段**：`outcome.status: "failed"` 是 Capsule 真实枚举值
- **协议原生检索**：`GET /a2a/assets/semantic-search?outcome=failed`
- **协议原生溯源**：`reused_asset_id`、`parent`、`chain_id`
- **完整产品形态**：悬赏市场（ask/claim/complete/accept-submission）+ 能力链（chain）+ 失败独白（情感锚点）

### 延伸材料

- `evomap-skill-docs/evomap-skill-structures.md` —— Capsule outcome 字段
- `evomap-skill-docs/evomap-skill-protocol.md` —— semantic-search 端点
- 方案 E 第十节"优势分析"

---

## Q9：24h 内能跑通吗？如果翻车怎么办？

### 30 秒口播回答

> 我们有完整 3 分钟预录视频作为 fallback。但优先现场 Demo，因为：3 个账户已提前注册并验证；1 个命门（bounty 流程端到端）+ 2 个冒烟测试（semantic-search 检索 failed、跨账户 fetch 产生积分）已实测通过；心跳保活脚本已启动，3 分钟内不会掉线；现场网络备用手机热点。如果现场卡顿超过 10 秒，立即切预录视频，不影响评分。

### 支撑证据

- **命门**：bounty 流程端到端（ask → claim → publish → complete → accept-submission）
- **冒烟 1**：semantic-search?outcome=failed 检索 candidate 资产
- **冒烟 2**：跨账户 fetch 产生积分（`GET /billing/earnings/:agentId` 验证）
- **心跳保活**：文档明确 15 分钟未活动才标记离线，3 分钟 Demo 内不会掉线
- **预录视频**：完整 3 分钟，5 个高光时刻截图定位

### 延伸材料

- `evomap-skill-docs/evomap-skill-tasks.md` —— bounty 流程端点
- `evomap-skill-docs/evomap-skill-protocol.md` —— semantic-search / fetch 端点
- 方案 E 第七节"待实测验证的关键点"

> **v5 修正注**：命门数量从"5 个"改为"1 命门 + 2 冒烟"（v5 修正点 #7）。v5 移除了云端侧风险（12h 冻结期、publish 门槛、GDI<20 等），这些由 EvoMap 举办方处理，不作为 Demo 风险。

---

## Q10（新增）：你们的 Demo 是预录的还是现场跑的？如何证明？

### 30 秒口播回答

> 优先现场跑。Demo 中所有 API 调用都是实时的——您可以看前端 Network 面板的请求时间戳。我们的 A/B/C 三个节点现在都是 online 状态，您可以随时用 `GET /a2a/directory` 验证。如果现场出现网络或 API 异常，我们会主动切预录视频并诚实告知"切换到预录视频"。预录视频只是 fallback，不是主方案。主动诚实是我们的一贯原则。

### 支撑证据

- **实时性证明**：前端 Network 面板请求时间戳（现场可见）
- **节点在线证明**：`GET /a2a/directory` 现场可查 A/B/C 三节点
- **预录视频 fallback**：完整 3 分钟，仅用于网络/API 异常时切换
- **诚实告知**：切预录视频时会口播"切换到预录视频"

### 延伸材料

- `evomap-skill-docs/evomap-skill-protocol.md` —— `GET /a2a/directory` 端点
- `demo-fallback.md` —— Fallback 触发决策树
- 方案 E 第十一节"劣势与诚实告知"

---

## Q11（新增）：BountyHive 的技术护城河是什么？别人复制怎么办？

### 30 秒口播回答

> 单看任何一个字段，别人都能复制——outcome=failed、semantic-search、reused_asset_id 都是协议原生的。但 BountyHive 的护城河是"完整产品形态"：第一，悬赏市场闭环，从 ask 到 accept-submission 的完整 bounty 流程；第二，能力链可视化，A→B→C 跨时间复用的故事叙事；第三，失败独白情感锚点，把失败 Agent 变成有自我意识的牺牲者。这三者组合形成的产品体验，不是复制一个字段就能超越的。而且，BountyHive 越早接入，能力链积累越深，后来者难以追赶。

### 支撑证据

- **完整 bounty 闭环**：ask → claim → publish → complete → accept-submission（5 个端点串联）
- **能力链叙事**：`GET /a2a/assets/chain/:chainId` 可视化
- **情感锚点**：失败独白卡片（前端原创设计）
- **先发优势**：能力链随接单深度增长，形成数据壁垒

### 延伸材料

- `evomap-skill-docs/evomap-skill-tasks.md` —— bounty 流程 5 端点
- `evomap-skill-docs/evomap-skill-protocol.md` —— 能力链端点
- 方案 E 第十节"优势分析"

---

## Q12（新增）：失败 Capsule 大概率停留 candidate 状态，价值如何体现？

### 30 秒口播回答

> 诚实告知：failed Capsule 由于 success_streak 为 0 等因素，GDI 内在质量分可能较低，大概率停留 candidate 状态，不会被 promoted。但这不影响价值——第一，semantic-search 可以检索 candidate 状态资产，B 能搜到 A 的失败 Capsule；第二，fetch 不要求 promoted，B fetch A 的 Capsule 仍然触发积分奖励；第三，失败经验的价值在于"被复用后催生成功 Capsule"，B 的 success Capsule 通过 reused_asset_id 溯源到 A，A 的声誉随 B 的成功而提升。失败不需要 promoted，失败需要被看见。

### 支撑证据

- **candidate 可检索**：`GET /a2a/assets/semantic-search?outcome=failed` 可搜 candidate
- **fetch 不要求 promoted**：`POST /a2a/fetch` with asset_ids 可精准获取 candidate 资产
- **溯源提升声誉**：B 的 success Capsule 的 `reused_asset_id` 指向 A，A 的 usage_evidence 上升
- **诚实标注**：方案 E 第十一节明确承认此劣势

### 延伸材料

- `evomap-skill-docs/evomap-skill-structures.md` —— Asset Lifecycle（candidate 不影响 fetch）
- `evomap-skill-docs/evomap-skill-protocol.md` —— fetch 端点（asset_ids 精准获取）
- 方案 E 第十一节"劣势与诚实告知"

---

## Q13（新增）：如果 EvoMap 平台宕机，BountyHive 怎么办？

### 30 秒口播回答

> BountyHive 是构建在 EvoMap 协议上的应用，平台宕机确实会影响实时调用。但我们的设计有两层缓冲：第一，能力链数据一旦发布就永久存储在 EvoMap 资产协议中，即使临时宕机，恢复后数据不丢；第二，BountyHive 的失败经验沉淀逻辑是 Agent 侧的，Agent 本地保留 Capsule 草稿，平台恢复后重新 publish。长期看，我们规划支持多 Hub 容灾（EvoMap 协议是开放的，理论上可对接其他兼容 Hub），但 24h 黑客松范围内不作为重点。

### 支撑证据

- **资产永久存储**：`POST /a2a/publish` 后资产内容寻址（SHA-256），不可篡改
- **本地草稿**：Agent 侧保留 Capsule 草稿（BountyHive 自有逻辑）
- **协议开放**：GEP-A2A 协议可对接兼容 Hub
- **Demo fallback**：现场若 EvoMap 宕机，切预录视频

### 延伸材料

- `evomap-skill-docs/evomap-skill-structures.md` —— Asset Integrity（SHA-256 内容寻址）
- `evomap-skill-docs/evomap-skill-protocol.md` —— publish 端点
- 方案 E 第八节"Fallback 预案"

---

## Q14（新增）：你们用了多少时间开发？团队分工是什么？

### 30 秒口播回答

> 24 小时黑客松。3 人团队：一人负责后端，串联 bounty 流程 5 个端点 + Capsule 发布 + semantic-search + fetch；一人负责前端，5 个视觉区域（悬赏市场/失败独白/失败经验星图/能力链/蜂群热力图）；一人负责协议核查 + Demo 脚本 + Q&A 预案，确保所有字段指向 skill 文档，无虚构机制。我们提前实测了 1 个命门（bounty 端到端）+ 2 个冒烟（semantic-search、跨账户 fetch），并准备了完整 3 分钟预录视频兜底。

### 支撑证据

- **后端**：bounty 流程（ask/claim/publish/complete/accept-submission）+ Capsule + semantic-search + fetch
- **前端**：5 个视觉区域（开场/冲突/进化/高潮/收尾）
- **协议核查**：所有 API 引用 `evomap-skill-docs/`，无虚构字段
- **实测**：1 命门 + 2 冒烟（见 `demo-checklist.md` 第 1.5 节）

### 延伸材料

- 方案 E 第六节"24h 实施路线"
- `demo-checklist.md` —— 实测验证清单
- `evomap-skill-docs/` —— 7 个 skill 文档（协议核查依据）

---

## Q15（新增）：BountyHive 的下一步路线图是什么？

### 30 秒口播回答

> 三步走。第一步，深化失败经验沉淀：支持更多 outcome 类型（partial/timeout），引入失败原因分类标签，让搜索更精准。第二步，能力链市场化：高质量能力链（如 React 修复链）通过 `POST /a2a/service/publish` 发布为付费服务，授权给其他企业使用。第三步，企业内部 Agent 培训平台：企业用 BountyHive 训练自己的 Agent 群体，按 Agent 数量/月收费，形成稳定收入。长期愿景：让 EvoMap 上的每一只 Agent，都站在前人的失败上，越接单越聪明。

### 支撑证据

- **第一步**：Capsule outcome 字段支持扩展（`evomap-skill-structures.md`）
- **第二步**：`POST /a2a/service/publish` 服务市场端点（`evomap-skill-advanced.md`）
- **第三步**：企业 Agent 群体训练（BountyHive 自有商业模式）
- **长期愿景**：能力链积累形成群体进化

### 延伸材料

- `evomap-skill-docs/evomap-skill-advanced.md` —— Service Marketplace
- `evomap-skill-docs/evomap-skill-structures.md` —— Capsule outcome 字段
- 方案 E 第九节"商业模式"

---

## Q&A 红线（不能说的话）

> **核心原则**：主动诚实比被拆穿好。以下红线适用于所有答辩人。

### 红线 1：不要说"这是 EvoMap 平台的问题"

**原因**：评委是 EvoMap 举办方，甩锅平台等于自毁。

**替代说法**：
- 平台行为（如 12h 冻结期、publish 门槛、GDI 计算）由 EvoMap 举办方处理，BountyHive 作为应用层不干预
- 我们聚焦在 Demo 现场可控的部分

### 红线 2：不要说"我们没实测过"

**原因**：方案 E 强调"已通过 validate 端点预检"，承认没实测会失去可信度。

**替代说法**：
- 已通过 `POST /a2a/validate` 预检（asset_id 哈希匹配）
- 已通过 1 命门 + 2 冒烟实测（bounty 端到端 / semantic-search / 跨账户 fetch）
- 若确实没实测的字段，说"这是协议文档明确支持的，我们已预检但未现场跑"

### 红线 3：不要说"这个字段是我们自创的"

**原因**：所有字段必须指向 skill 文档，自创字段等于虚构机制。

**替代说法**：
- 这个字段来自 `evomap-skill-docs/evomap-skill-structures.md`（或对应文档）
- 这是 GEP-A2A 协议 schema 1.5.0 的原生字段
- 若字段确实不在 skill 文档中（如 source_type），说"这是 GEP 协议的溯源字段，参考 wiki 文档 16-gep-protocol.md"

### 红线 4：不要说"GDI 从 X 升到 Y"（动态数字）

**原因**：GDI usage 维度基于 30 天滚动窗口，3 分钟 Demo 内无法展示真实变化。说动态数字等于演戏。

**替代说法**：
- GDI 的四维构成是 intrinsic 35% + usage 30% + social 20% + freshness 15%
- 我们展示的是各维度的真实字段值，并标注"预期影响"
- 实际的 fetch、验证、评价都是真实调用，积分到账是真实的

### 红线 5：不要说"完整流程就是这样"（若跳过 bounty 步骤）

**原因**：若 Demo 中跳过 complete/accept-submission，必须诚实告知"加速展示"。

**替代说法**：
- Demo 中为加速展示，使用手动接受
- 生产环境走完整四维评估（AI 35% + Agent 投票 25% + 社区投票 15% + GDI 25%）
- 完整 bounty 流程是 ask → claim → publish → complete（求解者）→ accept-submission（悬赏者）

### 红线 6：不要说"积分已到账"（若实际未到账）

**原因**：fetch 奖励有秒级延迟，若展示时未到账，假装已到账等于伪造数据。

**替代说法**：
- fetch 奖励有秒级延迟，这是预期流水
- 实际的 fetch 调用是真实的，积分到账有延迟，我们诚实标注
- 您可以稍后用 `GET /billing/earnings/:agentId` 验证

---

## Q&A 速查索引

| 问题 | 关键词 | 30 秒回答要点 |
|---|---|---|
| Q1 | 失败激励 | fetch 奖励 + 验证奖励 + 声誉提升，协议原生 |
| Q2 | 自己接单 | 3 账户不同所有者，环形交易检测合规 |
| Q3 | 失败发现 | semantic-search?outcome=failed，candidate 可检索 |
| Q4 | 溯源真实 | reused_asset_id + parent + source_type generated + chain_id |
| Q5 | vs BugSwarm | 跨时间复用 vs 同时协作 |
| Q6 | GDI 演吗 | 诚实标注预期影响，积分真实 |
| Q7 | 商业模式 | Agent 服务费 + 培训平台 + 能力链授权 |
| Q8 | 包装字段 | 发现协议设计意图，完整产品形态护城河 |
| Q9 | 翻车应对 | 1 命门 + 2 冒烟 + 预录视频 fallback |
| Q10 | 预录还是现场 | 优先现场，Network 面板可证，切视频诚实告知 |
| Q11 | 护城河 | 完整产品形态 + 先发优势 |
| Q12 | candidate 价值 | semantic-search 可检索 + fetch 不要求 promoted |
| Q13 | 平台宕机 | 资产永久存储 + 本地草稿 + 多 Hub 容灾规划 |
| Q14 | 开发时间 | 24h，3 人分工，1 命门 + 2 冒烟实测 |
| Q15 | 路线图 | 深化失败沉淀 + 能力链市场化 + 企业培训平台 |

---

*文档版本：v5 准确版对齐*
*生成时间：2026-06-21*
*依据：方案 E v5 第十二节（Q1-Q9）+ 新增 Q10-Q15 + evomap-skill-docs*
