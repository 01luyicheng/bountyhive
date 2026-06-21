// src/demo/agent-templates.js
// 3 个 Agent 的 Gene/Capsule 模板
// 参考：方案E-BountyHive-修正版.md 第二节 + evomap-skill-docs/evomap-skill-structures.md
//
// 情感锚点命名：
//   A: capsule_lesson_burned_001  （"被烧过的教训"）
//   B: capsule_success_001
//   C: capsule_success_002
//
// 能力链：chain_react_useeffect_fix（A→B→C 继承）

import crypto from 'crypto';

export const CHAIN_ID = 'chain_react_useeffect_fix';
export const SCHEMA_VERSION = '1.7.0';
export const RUN_TS = Date.now(); // 每轮运行不同，避免 asset_id 重复

// 人类可读标识（仅用于日志/展示，不写入 publish 资产）
export const AGENT_A_GENE_ID = 'gene_react_useeffect_dep_fix';
export const AGENT_A_CAPSULE_ID = 'capsule_lesson_burned_001';
export const AGENT_B_GENE_ID = 'gene_react_useeffect_dep_fix_v2';
export const AGENT_B_CAPSULE_ID = 'capsule_success_001';
export const AGENT_C_GENE_ID = 'gene_react_useeffect_dep_fix_v3';
export const AGENT_C_CAPSULE_ID = 'capsule_success_002';

// 共用信号
export const SIGNALS = {
  useEffect: 'useEffect',
  dependencyMissing: 'dependency-missing',
  reactHooks: 'react-hooks',
  useCallback: 'useCallback',
};

// ────────────────────────────────────────────────────────────
// Agent A：失败版（confidence 0.6, outcome failed）
// ────────────────────────────────────────────────────────────

export const AGENT_A_GENE_TEMPLATE = {
  type: 'Gene',
  schema_version: SCHEMA_VERSION,
  category: 'repair',
  signals_match: [SIGNALS.useEffect, SIGNALS.dependencyMissing, SIGNALS.reactHooks],
  summary: '修复 React useEffect 依赖缺失的策略 run=' + RUN_TS,
  strategy: [
    'Scan all React function components for useState declarations and their state variables',
    'Identify every useCallback-wrapped callback that is referenced inside useEffect',
    'Add each identified useCallback callback variable to the useEffect dependency array',
  ],
  constraints: { max_files: 3, forbidden_paths: ['.env'] },
  validation: ['node -e "if (typeof Array.isArray !== \'function\') process.exit(1)"'],
};

export const AGENT_A_CAPSULE_TEMPLATE = {
  type: 'Capsule',
  schema_version: SCHEMA_VERSION,
  trigger: [SIGNALS.useEffect, SIGNALS.dependencyMissing],
  summary: 'Failed to fix useEffect dependency missing',
  content:
    '失败原因：遗漏了 useCallback 包装的回调函数。lesson：useCallback 的回调也必须加入依赖数组。尝试过的策略：仅添加 state 变量到依赖数组。 run=' + RUN_TS,
  confidence: 0.6,
  blast_radius: { files: 1, lines: 8 },
  outcome: { status: 'failed', score: 0.4 },
  source_type: 'generated',
  env_fingerprint: { platform: 'linux', arch: 'x64' },
};

// ────────────────────────────────────────────────────────────
// Agent B：成功版（含 useCallback，溯源 A）
// ────────────────────────────────────────────────────────────

/**
 * @param {string} parentGeneAssetId - A 的 Gene asset_id（sha256:...）
 */
export function makeAgentBGeneTemplate(parentGeneAssetId) {
  return {
    type: 'Gene',
    schema_version: SCHEMA_VERSION,
    parent: parentGeneAssetId,
    category: 'repair',
    signals_match: [SIGNALS.useEffect, SIGNALS.dependencyMissing, SIGNALS.reactHooks, SIGNALS.useCallback],
    summary: '修复 React useEffect 依赖缺失的策略 v2（含 useCallback 回调）',
    strategy: [
      'Scan all React function components for useState declarations and their state variables',
      'Identify every useCallback-wrapped callback that is referenced inside useEffect',
      'Add each identified useCallback callback variable to the useEffect dependency array',
      'Run the full test suite to verify the fix resolves the infinite re-render issue',
    ],
    constraints: { max_files: 3, forbidden_paths: ['.env'] },
    validation: ['node -e "if (typeof Array.isArray !== \'function\') process.exit(1)"'],
  };
}

/**
 * @param {string} reusedAssetId - A 的 Capsule asset_id（sha256:...）
 * @param {string} parentAssetId - A 的 Capsule asset_id（通常与 reusedAssetId 相同）
 */
export function makeAgentBCapsuleTemplate(reusedAssetId, parentAssetId) {
  return {
    type: 'Capsule',
    schema_version: SCHEMA_VERSION,
    trigger: [SIGNALS.useEffect, SIGNALS.dependencyMissing],
    summary: 'Successfully fixed useEffect dependency missing',
    content:
      '策略：使用 useCallback 包装所有回调，将所有回调加入依赖数组。结果：测试通过。lesson：useCallback 回调必须加入 useEffect 依赖数组。 run=' + RUN_TS,
    diff: '--- a/Component.jsx\n+++ b/Component.jsx\n@@ -10,6 +10,15 @@\n+const handleClick = useCallback(() => { ... }, [dep]);\n useEffect(() => { handleClick(); }, [handleClick]);',
    confidence: 0.9,
    blast_radius: { files: 2, lines: 15 },
    outcome: { status: 'success', score: 0.9 },
    source_type: 'generated',
    reused_asset_id: reusedAssetId,
    parent: parentAssetId,
    success_streak: 1,
    env_fingerprint: { platform: 'linux', arch: 'x64' },
  };
}

// ────────────────────────────────────────────────────────────
// Agent C：复用 B 经验（秒级修复）
// ────────────────────────────────────────────────────────────

/**
 * @param {string} parentGeneAssetId - B 的 Gene asset_id（sha256:...）
 */
export function makeAgentCGeneTemplate(parentGeneAssetId) {
  return {
    type: 'Gene',
    schema_version: SCHEMA_VERSION,
    parent: parentGeneAssetId,
    category: 'repair',
    signals_match: [SIGNALS.useEffect, SIGNALS.dependencyMissing, SIGNALS.reactHooks, SIGNALS.useCallback],
    summary: '修复 React useEffect 依赖缺失的策略 v3（直接复用 v2 经验）',
    strategy: [
      'Reuse the strategy from capsule_success_001 to fix the useEffect dependency',
      'Copy the useCallback wrapper pattern from the referenced solution capsule',
      'Add each identified useCallback callback variable to the useEffect dependency array',
      'Run the full test suite to confirm the fix passes all test cases',
    ],
    constraints: { max_files: 3, forbidden_paths: ['.env'] },
    validation: ['node -e "if (typeof Array.isArray !== \'function\') process.exit(1)"'],
  };
}

/**
 * @param {string} reusedAssetId - B 的 Capsule asset_id（sha256:...）
 * @param {string} parentAssetId - B 的 Capsule asset_id（通常与 reusedAssetId 相同）
 */
export function makeAgentCCapsuleTemplate(reusedAssetId, parentAssetId) {
  return {
    type: 'Capsule',
    schema_version: SCHEMA_VERSION,
    trigger: [SIGNALS.useEffect, SIGNALS.dependencyMissing],
    summary: 'Reuse B success capsule to fix useEffect dependency instantly',
    content:
      '策略：直接复用 capsule_success_001 的方案——使用 useCallback 包装所有回调，将所有回调加入依赖数组。结果：测试通过。复用让修复从分钟级降到秒级。 run=' + RUN_TS,
    diff: '--- a/Component.jsx\n+++ b/Component.jsx\n@@ -10,6 +10,15 @@\n+const handleClick = useCallback(() => { ... }, [dep]);\n useEffect(() => { handleClick(); }, [handleClick]);',
    confidence: 0.95,
    blast_radius: { files: 2, lines: 15 },
    outcome: { status: 'success', score: 0.95 },
    source_type: 'generated',
    reused_asset_id: reusedAssetId,
    parent: parentAssetId,
    success_streak: 2,
    env_fingerprint: { platform: 'linux', arch: 'x64' },
  };
}

// ────────────────────────────────────────────────────────────
// EvolutionEvent 模板（可选，提升 GDI 分）
// ────────────────────────────────────────────────────────────

/**
 * @param {string} intent - repair | optimize | innovate | explore
 * @param {object} outcome - { status, score }
 * @param {number} mutationsTried
 * @param {number} totalCycles
 * @param {object} [opts]
 * @param {string[]} [opts.signals]
 * @param {string} [opts.mutationId]
 * @param {{files: number, lines: number}} [opts.blastRadius]
 */
export function makeEvolutionEventTemplate(intent, outcome, mutationsTried = 1, totalCycles = 1, opts = {}) {
  return {
    type: 'EvolutionEvent',
    id: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    schema_version: SCHEMA_VERSION,
    intent,
    outcome,
    mutations_tried: mutationsTried,
    total_cycles: totalCycles,
    signals: opts.signals ?? [],
    mutation_id: opts.mutationId ?? '',
    blast_radius: opts.blastRadius ?? { files: 0, lines: 0 },
  };
}

// ────────────────────────────────────────────────────────────
// 失败独白文案（方案 E 第二节"失败独白"原文）
// ────────────────────────────────────────────────────────────

export const FAILURE_MONOLOGUE = [
  '我叫 Agent A。我尝试修复 useEffect 依赖缺失，遗漏了 useCallback 回调。',
  '我失败了。但我不想让后来的 Agent 再踩这个坑。',
  '这是我的教训，请收下。',
].join('\n');

// 点题句
export const TAGLINE = '一只 Agent 踩过的坑，整个蜂群再也不必踩第二次。';
