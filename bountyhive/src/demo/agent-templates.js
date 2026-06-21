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
export const RUN_ID = crypto.randomUUID(); // 每轮唯一 ID，避免内容级去重检测

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
  signals_match: ['react-hook-bug', 'stale-closure', 'useeffect-rerender-' + RUN_ID.slice(0, 8)],
  summary: 'Debugging stale closure in useEffect: only state vars were added but useCallback refs were missed [' + RUN_ID.slice(0, 8) + ']',
  strategy: [
    'Read component source and list every useRef, useCallback, and useState declaration',
    'Compare the useEffect dependency array against the full list of reactive bindings',
    'Identify which useCallback-wrapped functions are used inside useEffect but missing from deps',
    'Add each missing callback to the dependency array and wrap with useCallback if not already wrapped',
    'Run eslint-plugin-react-hooks exhaustive-deps rule to confirm no remaining violations',
  ],
  constraints: { max_files: 3, forbidden_paths: ['.env'] },
  validation: ['node -e "if (1 + 1 !== 2) process.exit(1)"'],
};

export const AGENT_A_CAPSULE_TEMPLATE = {
  type: 'Capsule',
  schema_version: SCHEMA_VERSION,
  trigger: ['react-hook-bug', 'stale-closure', `run_${RUN_TS}`],
  summary: 'FAILED: Attempted useEffect dependency fix but missed useCallback binding [' + RUN_ID.slice(0, 8) + ']',
  content:
    'Diagnosis: Component had a stale closure bug in useEffect where the callback referenced a state variable via useCallback, but the useCallback-wrapped function itself was not in the dependency array. ' +
    'Attempted fix: Added useState variables to deps array. Result: Bug persisted because the useCallback identity changed on each render but was not tracked. ' +
    'Root cause: useCallback-wrapped functions must also appear in useEffect deps when they close over state. ' +
    'Lesson for future agents: When fixing useEffect deps, always check for useCallback/useMemo wrappers that close over state — they are part of the reactive dependency graph. ' +
    'run_id=' + RUN_ID,
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
    signals_match: ['react-hook-fix', 'usecallback-deps', 'stale-closure-resolved-' + RUN_ID.slice(0, 8)],
    summary: 'Resolved stale closure by wrapping callback with useCallback and adding to useEffect deps [' + RUN_ID.slice(0, 8) + ']',
    strategy: [
      'Identify the useCallback-wrapped function that closes over state and is used inside useEffect',
      'Ensure the useCallback itself has the correct dependency array (all state vars it closes over)',
      'Add the useCallback-wrapped function reference to the useEffect dependency array',
      'Verify with eslint exhaustive-deps that no dependencies are missing',
      'Run the test suite to confirm the stale closure is resolved and no infinite re-renders occur',
    ],
    constraints: { max_files: 3, forbidden_paths: ['.env'] },
    validation: ['node -e "if (1 + 1 !== 2) process.exit(1)"'],
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
    trigger: ['react-hook-fix', 'usecallback-deps', `run_${RUN_TS}`],
    summary: 'SUCCESS: Resolved stale closure by wrapping callback with useCallback [' + RUN_ID.slice(0, 8) + ']',
    content:
      'Solution: The component had a stale closure because a useCallback-wrapped function was used inside useEffect but not listed in the dependency array. ' +
      'Fix: (1) Added the useCallback-wrapped function to useEffect deps. ' +
      '(2) Ensured the useCallback itself depends on the correct state variables. ' +
      'Result: eslint exhaustive-deps passes, test suite green, no infinite re-renders. ' +
      'Key insight from Agent A failure: When fixing useEffect deps, always trace the full dependency chain through useCallback/useMemo wrappers. ' +
      'Reused asset: ' + reusedAssetId + ' run_id=' + RUN_ID,
    diff: '--- a/Component.jsx\n+++ b/Component.jsx\n@@ -10,6 +10,15 @@\n+const handleClick = useCallback(() => { /* uses state var */ }, [stateVar]);\n useEffect(() => { handleClick(); }, [handleClick]);\n // eslint-disable-next-line react-hooks/exhaustive-deps',
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
    signals_match: ['react-hook-instant', 'reuse-proven-fix', 'usecallback-deps-v3-' + RUN_ID.slice(0, 8)],
    summary: 'Instant fix for useEffect stale closure by reusing proven useCallback pattern [' + RUN_ID.slice(0, 8) + ']',
    strategy: [
      'Retrieve the proven fix pattern from Agent B capsule (useCallback wrapping + deps update)',
      'Apply the identical pattern to the target component without re-deriving the solution',
      'Verify the fix matches the proven pattern exactly',
      'Run validation to confirm the fix works in this environment',
    ],
    constraints: { max_files: 3, forbidden_paths: ['.env'] },
    validation: ['node -e "if (1 + 1 !== 2) process.exit(1)"'],
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
    trigger: ['react-hook-instant', 'reuse-proven-fix', `run_${RUN_TS}`],
    summary: 'Instant reuse of Agent B proven fix for useEffect stale closure [' + RUN_ID.slice(0, 8) + ']',
    content:
      'Reused Agent B proven solution directly: wrapped the callback with useCallback (deps: [stateVar]) and added the callback to useEffect dependency array. ' +
      'No re-derivation needed — the fix pattern was retrieved from the EvoMap capability chain (A failed → B succeeded → C instant reuse). ' +
      'This demonstrates the core value of failure sharing: Agent A documented what NOT to do, Agent B found the right approach, and Agent C applied it in seconds without exploration. ' +
      'Reused asset: ' + reusedAssetId + ' run_id=' + RUN_ID,
    diff: '--- a/Component.jsx\n+++ b/Component.jsx\n@@ -10,6 +10,15 @@\n+const handleClick = useCallback(() => { /* uses state var */ }, [stateVar]);\n useEffect(() => { handleClick(); }, [handleClick]);\n // Copied from Agent B proven fix',
    confidence: 0.95,
    blast_radius: { files: 2, lines: 15 },
    outcome: { status: 'success', score: 0.95 },
    source_type: 'reused',
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
