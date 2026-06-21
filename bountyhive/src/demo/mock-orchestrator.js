// src/demo/mock-orchestrator.js
// Mock 模式下的 Demo 编排器
// 参考：src/demo/orchestrator.js（真实模式）+ src/lib/mock-data.js
//
// 与真实 orchestrator 的差异：
//   1. 不调用 EvoMap Hub，所有数据来自 mock-data.js
//   2. 每阶段用 await sleep(ms) 模拟真实 API 调用耗时（2-3 秒/阶段，总时长约 20 秒）
//   3. 日志格式与真实 orchestrator 一致（前端无需感知差异）
//   4. 失败独白 + 点题句从 agent-templates.js 导入，保证文案一致
//
// 阶段序列（9 个阶段）：
//   1. agent-a-hello        (2s) 加载 A 凭证
//   2. agent-a-ask-publish  (3s) A 发起悬赏 + 发布 failed Capsule + 失败独白
//   3. agent-b-hello        (2s) 加载 B 凭证
//   4. agent-b-claim-solve  (4s) B 认领 + 搜失败经验 + 发布成功 Capsule + task/complete
//   5. agent-a-accept       (2s) A 选优胜
//   6. agent-c-hello        (2s) 加载 C 凭证
//   7. agent-c-reuse        (3s) C 搜 B 成功经验 + 秒级修复
//   8. chain-earnings       (2s) 查询能力链 + A 的积分流水
//   9. done                 (1s) Demo 完成 + 点题句

import {
  CHAIN_ID,
  FAILURE_MONOLOGUE,
  TAGLINE,
} from './agent-templates.js';
import {
  MOCK_NODE_IDS,
  MOCK_TASK_ID,
  MOCK_SUBMISSION_ID,
  MOCK_ASSETS,
  getMockChain,
  getMockEarnings,
} from '../lib/mock-data.js';

function ts() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeLogger(sink, onLog) {
  return (msg, level = 'info') => {
    const line = `[${ts()}] ${msg}`;
    console.log(line);
    const log = { ts: ts(), level, msg };
    if (sink) sink.push(log);
    if (onLog) onLog(log);
  };
}

/**
 * 运行 Mock Demo 编排
 * @param {object} options
 * @param {Array} options.logSink - 可选，日志收集数组（用于 SSE 推送）
 * @param {Function} options.onPhase - 可选，阶段变更回调 (phase) => void
 * @param {Function} options.onLog - 可选，日志写入回调 (log) => void
 * @returns {Promise<object>} 完整结果（结构同真实 orchestrator）
 */
export async function runMockOrchestrator(options = {}) {
  const { logSink = [], onPhase = () => {}, onLog = null } = options;
  const log = makeLogger(logSink, onLog);

  const result = {
    started_at: ts(),
    completed_at: null,
    phase: 'init',
    completed_steps: [],
    stepTimings: [],
    total_duration_ms: null,
    simulated_savings: null,
    a: null,
    b: null,
    c: null,
    accept: null,
    chain: null,
    earnings: null,
    error: null,
    mock_mode: true,
  };

  function setPhase(p) {
    result.phase = p;
    onPhase(p);
    log(`━━━━━━━━━━ 阶段: ${p} ━━━━━━━━━━`, 'phase');
  }

  try {
    // ──────────────────────────────────────────────────────────
    // 阶段 1：Agent A 加载凭证
    // ──────────────────────────────────────────────────────────
    let stepStart = Date.now();
    setPhase('agent-a-hello');
    log('加载 Agent A 凭证...');
    await sleep(2000);
    log(`[mock] node_id=${MOCK_NODE_IDS.a}`);
    result.a_creds = { node_id: MOCK_NODE_IDS.a, claim_url: null };

    // ──────────────────────────────────────────────────────────
    // 阶段 2：Agent A 发起悬赏 + 发布 failed Capsule
    // ──────────────────────────────────────────────────────────
    setPhase('agent-a-ask-publish');
    log('Agent A 发起悬赏 + 发布 failed Capsule...');
    await sleep(1500);
    log(`发起悬赏: Fix React useEffect dependency missing (50 积分)`);
    log(`悬赏已创建: task_id=${MOCK_TASK_ID}`);
    await sleep(1500);
    log('发布 failed Capsule: capsule_lesson_burned_001');
    log(`failed Capsule 已发布: capsule_id=${MOCK_ASSETS.capsules.a.asset_id}`);

    // 失败独白（与真实 orchestrator 一致）
    log(`失败独白:\n${FAILURE_MONOLOGUE}`);

    result.a = {
      task_id: MOCK_TASK_ID,
      gene_id: MOCK_ASSETS.genes.a.asset_id,
      capsule_id: MOCK_ASSETS.capsules.a.asset_id,
      ask_res: { task_id: MOCK_TASK_ID, status: 'open', mock: true },
      publish_res: { published: true, asset_id: MOCK_ASSETS.capsules.a.asset_id, mock: true },
      chain_id: CHAIN_ID,
    };
    result.completed_steps.push('agent-a');
    result.stepTimings.push({ step: 'agent-a', duration_ms: Date.now() - stepStart });

    // ──────────────────────────────────────────────────────────
    // 阶段 3：Agent B 加载凭证
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('agent-b-hello');
    log('加载 Agent B 凭证...');
    await sleep(2000);
    log(`[mock] node_id=${MOCK_NODE_IDS.b}`);
    result.b_creds = { node_id: MOCK_NODE_IDS.b, claim_url: null };

    // ──────────────────────────────────────────────────────────
    // 阶段 4：Agent B 认领 + 搜失败经验 + 发布成功 Capsule + task/complete
    // ──────────────────────────────────────────────────────────
    setPhase('agent-b-claim-solve');
    log('Agent B 认领 + 搜失败经验 + 发布成功 Capsule + task/complete...');
    await sleep(1000);
    log(`认领任务: task_id=${MOCK_TASK_ID}`);
    await sleep(1000);
    log('semantic-search 搜失败经验: q=useEffect dependency, outcome=failed');
    log('搜到 1 条失败 Capsule');
    await sleep(1000);
    log(`fetch A 的 Capsule: asset_ids=[${MOCK_ASSETS.capsules.a.asset_id}]（A 获 5 积分 fetch 奖励）`);
    await sleep(500);
    log('基于 A 的失败经验避开雷区，构造成功方案（含 useCallback）');
    log(`发布成功 Capsule: capsule_success_001（溯源 A: ${MOCK_ASSETS.capsules.a.asset_id}）`);
    log(`success Capsule 已发布: capsule_id=${MOCK_ASSETS.capsules.b.asset_id}`);
    await sleep(500);
    log(`完成任务: task_id=${MOCK_TASK_ID}, asset_id=${MOCK_ASSETS.capsules.b.asset_id}`);
    log('task/complete 完成');

    result.b = {
      gene_id: MOCK_ASSETS.genes.b.asset_id,
      capsule_id: MOCK_ASSETS.capsules.b.asset_id,
      claim_res: { claimed: true, task_id: MOCK_TASK_ID, mock: true },
      publish_res: { published: true, asset_id: MOCK_ASSETS.capsules.b.asset_id, mock: true },
      complete_res: { completed: true, submission_id: MOCK_SUBMISSION_ID, mock: true },
      fetch_res: { fetched: true, reward_to_a: 5, mock: true },
      submission_id: MOCK_SUBMISSION_ID,
      chain_id: CHAIN_ID,
    };
    result.completed_steps.push('agent-b');
    result.stepTimings.push({ step: 'agent-b', duration_ms: Date.now() - stepStart });

    // ──────────────────────────────────────────────────────────
    // 阶段 5：Agent A 选优胜
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('agent-a-accept');
    log(`Agent A 选优胜: submission_id=${MOCK_SUBMISSION_ID}`);
    await sleep(2000);
    log('accept-submission 完成（B 获 50 积分 bounty 奖励）');

    result.accept = {
      accepted: true,
      task_id: MOCK_TASK_ID,
      submission_id: MOCK_SUBMISSION_ID,
      winner: MOCK_NODE_IDS.b,
      reward: 50,
      mock: true,
    };
    result.completed_steps.push('accept-submission');
    result.stepTimings.push({ step: 'accept-submission', duration_ms: Date.now() - stepStart });

    // ──────────────────────────────────────────────────────────
    // 阶段 6：Agent C 加载凭证
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('agent-c-hello');
    log('加载 Agent C 凭证...');
    await sleep(2000);
    log(`[mock] node_id=${MOCK_NODE_IDS.c}`);
    result.c_creds = { node_id: MOCK_NODE_IDS.c, claim_url: null };

    // ──────────────────────────────────────────────────────────
    // 阶段 7：Agent C 搜 B 成功经验 + 秒级修复
    // ──────────────────────────────────────────────────────────
    setPhase('agent-c-reuse');
    log('Agent C 搜 B 成功经验 + 秒级修复...');
    await sleep(1000);
    log('semantic-search: q=useEffect dependency useCallback, outcome=success');
    log('搜到 1 条成功 Capsule');
    await sleep(1000);
    log(`fetch B 的成功 Capsule: asset_ids=[${MOCK_ASSETS.capsules.b.asset_id}]（B 获 5 积分 fetch 奖励）`);
    await sleep(500);
    log('秒级修复：直接复用 B 的策略');
    log(`发布成功 Capsule: capsule_success_002（溯源 B: ${MOCK_ASSETS.capsules.b.asset_id}）`);
    log(`success Capsule 已发布: capsule_id=${MOCK_ASSETS.capsules.c.asset_id}`);

    result.c = {
      gene_id: MOCK_ASSETS.genes.c.asset_id,
      capsule_id: MOCK_ASSETS.capsules.c.asset_id,
      fetch_res: { fetched: true, reward_to_b: 5, mock: true },
      publish_res: { published: true, asset_id: MOCK_ASSETS.capsules.c.asset_id, mock: true },
      chain_id: CHAIN_ID,
    };
    result.completed_steps.push('agent-c');
    result.stepTimings.push({ step: 'agent-c', duration_ms: Date.now() - stepStart });

    // ──────────────────────────────────────────────────────────
    // 阶段 8：查询能力链 + A 的积分流水
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('chain-earnings');
    log(`查询能力链: GET /a2a/assets/chain/${CHAIN_ID}`);
    await sleep(1000);
    const chainResult = getMockChain(CHAIN_ID);
    result.chain = { ...chainResult, mock: true };
    log(`能力链查询完成，共 ${chainResult.assets.length} 个资产（A→B→C）`);

    await sleep(500);
    log(`查询 A 的积分流水: GET /billing/earnings/${MOCK_NODE_IDS.a}`);
    await sleep(500);
    const earningsList = getMockEarnings(MOCK_NODE_IDS.a);
    result.earnings = {
      agent_id: MOCK_NODE_IDS.a,
      entries: earningsList,
      total: earningsList.reduce((s, e) => s + (e.amount || 0), 0),
      mock: true,
    };
    log('积分流水查询完成');

    result.completed_steps.push('chain-earnings');
    result.stepTimings.push({ step: 'chain-earnings', duration_ms: Date.now() - stepStart });

    // ──────────────────────────────────────────────────────────
    // 阶段 9：Demo 完成 + 点题
    // ──────────────────────────────────────────────────────────
    const totalMs = Date.now() - new Date(result.started_at).getTime();
    result.total_duration_ms = totalMs;

    // 模拟失败共享节省的叙事数据（SIMULATED，用于 Demo 展示）
    result.simulated_savings = {
      note: 'SIMULATED numbers for narrative purposes',
      without_sharing: { agent_a: 180, agent_b: 180, agent_c: 180, total_s: 540 },
      with_sharing: { agent_a: 180, agent_b: 120, agent_c: 5, total_s: 305 },
      savings_s: 235,
      savings_pct: '43%',
    };

    setPhase('done');
    await sleep(1000);
    log('━━━━━━━━━━ Demo 完成 ━━━━━━━━━━', 'phase');
    log(`点题: ${TAGLINE}`, 'phase');
    log(`⏱ 总耗时: ${totalMs}ms (${(totalMs / 1000).toFixed(1)}s)`, 'phase');
    for (const t of result.stepTimings) {
      log(`  ├ ${t.step}: ${t.duration_ms}ms (${(t.duration_ms / 1000).toFixed(1)}s)`, 'phase');
    }
    log('━━━━━━━ 失败共享节省（SIMULATED）━━━━━━━', 'phase');
    log(`  无共享: A(180s) + B(180s) + C(180s) = 540s（各 agent 独立探索）`, 'phase');
    log(`  有共享: A(180s) + B(120s) + C(5s) = 305s（B 先搜, C 复用秒级修复）`, 'phase');
    log(`  节省: 235s (43%)`, 'phase');

    result.completed_at = ts();
    return result;
  } catch (err) {
    result.error = {
      phase: result.phase,
      message: err.message,
      stack: err.stack,
    };
    result.completed_at = ts();
    log(`❌ Mock Demo 在阶段 [${result.phase}] 失败: ${err.message}`, 'error');
    throw err;
  }
}

// ── 独立运行入口 ──
async function main() {
  console.log('┌────────────────────────────────────────────┐');
  console.log('│  BountyHive Mock Demo 编排启动             │');
  console.log('│  方案 E：悬赏市场蜂群接单进化体（Mock）    │');
  console.log('└────────────────────────────────────────────┘');
  try {
    const result = await runMockOrchestrator();
    console.log('\n=== Mock Demo 最终结果 ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('\n=== Mock Demo 失败 ===');
    console.error(err.message);
    process.exit(1);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('mock-orchestrator.js');
if (isMain) {
  main();
}
