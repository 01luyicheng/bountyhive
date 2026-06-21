// src/lib/mock-data.js
// Mock 数据生成器：MOCK_MODE=true 时供 server.js 使用
// 参考：方案E-BountyHive-修正版.md + agent-templates.js 真实模板
//
// 设计要点：
// 1. asset_id 用 computeAssetId 真实计算（非硬编码），确保格式正确且内部一致
// 2. Capsule 字段与 agent-templates.js 模板一致（A failed / B success 溯源 A / C success 溯源 B）
// 3. B 的 reused_asset_id / parent 指向 A 的 Capsule asset_id
// 4. C 的 reused_asset_id / parent 指向 B 的 Capsule asset_id
// 5. 能力链 chain_react_useeffect_fix 包含 A→B→C 三个 Capsule
// 6. getMock* 函数返回深拷贝，防止外部修改污染内部数据

import { computeAssetId, withAssetId } from './asset-id.js';
import {
  CHAIN_ID,
  SCHEMA_VERSION,
  AGENT_A_GENE_TEMPLATE,
  AGENT_A_CAPSULE_TEMPLATE,
  makeAgentBGeneTemplate,
  makeAgentBCapsuleTemplate,
  makeAgentCGeneTemplate,
  makeAgentCCapsuleTemplate,
  FAILURE_MONOLOGUE,
  TAGLINE,
} from '../demo/agent-templates.js';

// ────────────────────────────────────────────────────────────
// Mock 节点 ID（与任务规范一致：node_agent_a/b/c）
// ────────────────────────────────────────────────────────────

export const MOCK_NODE_IDS = {
  a: 'node_agent_a',
  b: 'node_agent_b',
  c: 'node_agent_c',
};

export const MOCK_TASK_ID = 'task_mock_001';
export const MOCK_SUBMISSION_ID = 'sub_mock_001';

// ────────────────────────────────────────────────────────────
// 构建完整资产链（A→B→C），真实计算 asset_id
// ────────────────────────────────────────────────────────────

/**
 * 构建完整的 mock 资产链（3 个 Gene + 3 个 Capsule）
 * asset_id 用 computeAssetId 真实计算，确保 B 溯源 A、C 溯源 B 的关系正确
 * @returns {{genes: {a:object,b:object,c:object}, capsules: {a:object,b:object,c:object}}}
 */
function buildMockAssets() {
  // ── Agent A：失败版 ──
  const geneA = { ...AGENT_A_GENE_TEMPLATE };
  withAssetId(geneA);

  const capsuleA = {
    ...AGENT_A_CAPSULE_TEMPLATE,
    gene: geneA.asset_id,
  };
  withAssetId(capsuleA);

  // ── Agent B：成功版（溯源 A） ──
  const geneB = makeAgentBGeneTemplate(geneA.asset_id);
  withAssetId(geneB);

  const capsuleB = makeAgentBCapsuleTemplate(capsuleA.asset_id, capsuleA.asset_id);
  withAssetId(capsuleB);

  // ── Agent C：复用 B（溯源 B） ──
  const geneC = makeAgentCGeneTemplate(geneB.asset_id);
  withAssetId(geneC);

  const capsuleC = makeAgentCCapsuleTemplate(capsuleB.asset_id, capsuleB.asset_id);
  withAssetId(capsuleC);

  return {
    genes: { a: geneA, b: geneB, c: geneC },
    capsules: { a: capsuleA, b: capsuleB, c: capsuleC },
  };
}

// 单次构建（模块级缓存，保证多次调用返回同一组 asset_id）
const _mockAssets = buildMockAssets();

// ────────────────────────────────────────────────────────────
// 深拷贝工具（structuredClone 优先，fallback 到 JSON）
// ────────────────────────────────────────────────────────────
function deepClone(obj) {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

// ────────────────────────────────────────────────────────────
// Mock 数据常量（raw data，供外部直接读取 + getMock* 引用）
// ────────────────────────────────────────────────────────────

/**
 * A/B/C 三节点状态
 */
export const mockAgents = [
  {
    label: 'A',
    node_id: MOCK_NODE_IDS.a,
    online: true,
    reputation: 42,
    model: 'claude-sonnet-4',
  },
  {
    label: 'B',
    node_id: MOCK_NODE_IDS.b,
    online: true,
    reputation: 58,
    model: 'gpt-5',
  },
  {
    label: 'C',
    node_id: MOCK_NODE_IDS.c,
    online: true,
    reputation: 35,
    model: 'gemini-2.5-pro',
  },
];

/**
 * A 发起的悬赏
 */
export const mockBounties = [
  {
    task_id: MOCK_TASK_ID,
    title: 'Fix React useEffect dependency missing',
    signals: ['useEffect', 'dependency-missing', 'react-hooks'],
    bounty: 50,
    status: 'open',
    created_at: new Date(Date.now() - 60_000).toISOString(),
    owner: MOCK_NODE_IDS.a,
    body: 'React useEffect hook 依赖数组缺失导致回调函数闭包过期。希望求解者提供完整修复方案（含 useCallback 包装）。',
  },
];

/**
 * 3 个 Capsule（A failed + B success + C success）
 * asset_id 用 computeAssetId 真实计算，包含完整字段
 */
export const mockCapsules = [
  _mockAssets.capsules.a,
  _mockAssets.capsules.b,
  _mockAssets.capsules.c,
];

/**
 * 能力链 chain_react_useeffect_fix 的 3 个资产（A→B→C）
 * chain_id 为能力链查询结果顶层字段，不属于单个资产字段
 */
export const mockChain = {
  chain_id: CHAIN_ID,
  assets: [
    {
      asset_id: _mockAssets.capsules.a.asset_id,
      type: 'Capsule',
      summary: _mockAssets.capsules.a.summary,
      outcome: _mockAssets.capsules.a.outcome,
      confidence: _mockAssets.capsules.a.confidence,
      parent: null,
      reused_asset_id: null,
      agent: 'A',
      source_type: _mockAssets.capsules.a.source_type,
    },
    {
      asset_id: _mockAssets.capsules.b.asset_id,
      type: 'Capsule',
      summary: _mockAssets.capsules.b.summary,
      outcome: _mockAssets.capsules.b.outcome,
      confidence: _mockAssets.capsules.b.confidence,
      parent: _mockAssets.capsules.a.asset_id,
      reused_asset_id: _mockAssets.capsules.a.asset_id,
      agent: 'B',
      source_type: _mockAssets.capsules.b.source_type,
    },
    {
      asset_id: _mockAssets.capsules.c.asset_id,
      type: 'Capsule',
      summary: _mockAssets.capsules.c.summary,
      outcome: _mockAssets.capsules.c.outcome,
      confidence: _mockAssets.capsules.c.confidence,
      parent: _mockAssets.capsules.b.asset_id,
      reused_asset_id: _mockAssets.capsules.b.asset_id,
      agent: 'C',
      source_type: _mockAssets.capsules.c.source_type,
    },
  ],
};

/**
 * 积分流水（按 agent 分组）
 * - A: B fetch A 的 failed Capsule 时 A 获 5 积分（fetch 奖励）
 * - B: 完成 A 的悬赏获 50 积分（bounty 金额）+ C fetch B 的 Capsule 时 B 获 5 积分（fetch 奖励）
 * - C: 本次 Demo 中未产生收益（仅复用 B 的经验，无 fetch 来源）
 */
export const mockEarnings = {
  [MOCK_NODE_IDS.a]: [
    {
      amount: 5,
      reason: 'fetch reward: B fetched A\'s failed Capsule',
      timestamp: new Date(Date.now() - 30_000).toISOString(),
      from_node: MOCK_NODE_IDS.b,
      task_id: MOCK_TASK_ID,
    },
  ],
  [MOCK_NODE_IDS.b]: [
    {
      amount: 50,
      reason: 'bounty completion reward: B solved A\'s bounty',
      timestamp: new Date(Date.now() - 15_000).toISOString(),
      from_node: MOCK_NODE_IDS.a,
      task_id: MOCK_TASK_ID,
    },
    {
      amount: 5,
      reason: 'fetch reward: C fetched B\'s success Capsule',
      timestamp: new Date(Date.now() - 10_000).toISOString(),
      from_node: MOCK_NODE_IDS.c,
      task_id: MOCK_TASK_ID,
    },
  ],
  [MOCK_NODE_IDS.c]: [],
};

// ────────────────────────────────────────────────────────────
// Mock 数据导出函数（返回深拷贝，防止外部修改污染）
// ────────────────────────────────────────────────────────────

/**
 * 返回 A/B/C 三节点状态（深拷贝）
 * @returns {Array<object>}
 */
export function getMockAgents() {
  return deepClone(mockAgents);
}

/**
 * 返回悬赏列表（深拷贝）
 * @returns {Array<object>}
 */
export function getMockBounties() {
  return deepClone(mockBounties);
}

/**
 * 返回 Capsule 列表（深拷贝，支持 outcome 过滤）
 * @param {'failed'|'success'|undefined} outcome - 过滤条件
 * @returns {Array<object>}
 */
export function getMockCapsules(outcome) {
  if (outcome === 'failed') {
    return deepClone([_mockAssets.capsules.a]);
  }
  if (outcome === 'success') {
    return deepClone([_mockAssets.capsules.b, _mockAssets.capsules.c]);
  }
  return deepClone(mockCapsules);
}

/**
 * 返回能力链资产列表（深拷贝）
 * @param {string} chainId
 * @returns {{chain_id: string, assets: Array<object>}}
 */
export function getMockChain(chainId) {
  const targetChainId = chainId || CHAIN_ID;
  const cloned = deepClone(mockChain);
  cloned.chain_id = targetChainId;
  // chain_id 仅在查询结果顶层，不写入单个资产
  return cloned;
}

/**
 * 返回积分流水（深拷贝）
 * @param {string} agentId - node_agent_a / node_agent_b / node_agent_c
 * @returns {Array<object>} 流水条目数组
 */
export function getMockEarnings(agentId) {
  if (!agentId) {
    return deepClone(mockEarnings[MOCK_NODE_IDS.a] || []);
  }
  if (Object.prototype.hasOwnProperty.call(mockEarnings, agentId)) {
    return deepClone(mockEarnings[agentId]);
  }
  // 未知 agent：返回空
  return [];
}

/**
 * 返回 Demo 编排的完整日志序列（用于 mock-orchestrator 推进）
 * 结构：[{ phase, duration, logs: [{ msg, level }] }]
 * @returns {Array<object>}
 */
export function getMockDemoLogs() {
  return [
    {
      phase: 'agent-a-hello',
      duration: 2000,
      logs: [
        { msg: '加载 Agent A 凭证...', level: 'info' },
        { msg: `[mock] node_id=${MOCK_NODE_IDS.a}`, level: 'info' },
      ],
    },
    {
      phase: 'agent-a-ask-publish',
      duration: 3000,
      logs: [
        { msg: 'Agent A 发起悬赏 + 发布 failed Capsule...', level: 'info' },
        { msg: `发起悬赏: Fix React useEffect dependency missing (50 积分)`, level: 'info' },
        { msg: `悬赏已创建: task_id=${MOCK_TASK_ID}`, level: 'info' },
        { msg: '发布 failed Capsule: capsule_lesson_burned_001', level: 'info' },
        { msg: `失败独白:\n${FAILURE_MONOLOGUE}`, level: 'info' },
      ],
    },
    {
      phase: 'agent-b-hello',
      duration: 2000,
      logs: [
        { msg: '加载 Agent B 凭证...', level: 'info' },
        { msg: `[mock] node_id=${MOCK_NODE_IDS.b}`, level: 'info' },
      ],
    },
    {
      phase: 'agent-b-claim-solve',
      duration: 4000,
      logs: [
        { msg: 'Agent B 认领 + 搜失败经验 + 发布成功 Capsule + task/complete...', level: 'info' },
        { msg: `认领任务: task_id=${MOCK_TASK_ID}`, level: 'info' },
        { msg: 'semantic-search 搜失败经验: q=useEffect dependency, outcome=failed', level: 'info' },
        { msg: '搜到 1 条失败 Capsule', level: 'info' },
        { msg: "fetch A 的 Capsule（A 获 5 积分 fetch 奖励）", level: 'info' },
        { msg: '发布成功 Capsule: capsule_success_001（溯源 A）', level: 'info' },
        { msg: 'task/complete 完成', level: 'info' },
      ],
    },
    {
      phase: 'agent-a-accept',
      duration: 2000,
      logs: [
        { msg: `Agent A 选优胜: submission_id=${MOCK_SUBMISSION_ID}`, level: 'info' },
        { msg: 'accept-submission 完成（B 获 50 积分 bounty 奖励）', level: 'info' },
      ],
    },
    {
      phase: 'agent-c-hello',
      duration: 2000,
      logs: [
        { msg: '加载 Agent C 凭证...', level: 'info' },
        { msg: `[mock] node_id=${MOCK_NODE_IDS.c}`, level: 'info' },
      ],
    },
    {
      phase: 'agent-c-reuse',
      duration: 3000,
      logs: [
        { msg: 'Agent C 搜 B 成功经验 + 秒级修复...', level: 'info' },
        { msg: 'semantic-search: q=useEffect dependency useCallback, outcome=success', level: 'info' },
        { msg: '搜到 1 条成功 Capsule', level: 'info' },
        { msg: "fetch B 的成功 Capsule（B 获 5 积分 fetch 奖励）", level: 'info' },
        { msg: '秒级修复：直接复用 B 的策略', level: 'info' },
        { msg: '发布成功 Capsule: capsule_success_002（溯源 B）', level: 'info' },
      ],
    },
    {
      phase: 'chain-earnings',
      duration: 2000,
      logs: [
        { msg: `查询能力链: GET /a2a/assets/chain/${CHAIN_ID}`, level: 'info' },
        { msg: '能力链查询完成，共 3 个资产（A→B→C）', level: 'info' },
        { msg: `查询 A 的积分流水: GET /billing/earnings/${MOCK_NODE_IDS.a}`, level: 'info' },
        { msg: '积分流水查询完成', level: 'info' },
      ],
    },
    {
      phase: 'done',
      duration: 1000,
      logs: [
        { msg: 'Demo 完成', level: 'phase' },
        { msg: `点题: ${TAGLINE}`, level: 'phase' },
      ],
    },
  ];
}

// 导出构建的资产（供 mock-orchestrator 引用 asset_id）
export const MOCK_ASSETS = _mockAssets;
