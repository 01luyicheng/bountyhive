// src/demo/orchestrator.js
// 编排 3 个 Agent 的完整闭环
// 参考：方案E-BountyHive-修正版.md 第二节 Demo 脚本
//
// 流程：
//   1. Agent A: hello → ask（发起悬赏）→ publish failed Capsule
//   2. Agent B: hello → task/list → task/claim → semantic-search → fetch A → publish success Capsule → task/complete
//   3. Agent A: accept-submission（选 B 为优胜）
//   4. Agent C: hello → semantic-search → fetch B → publish success Capsule（复用 B）
//   5. 打印能力链 GET /a2a/assets/chain/:chainId
//   6. 打印 A 的积分流水 GET /billing/earnings/:agentId

import 'dotenv/config';
import EvoMapClient from '../lib/evomap-client.js';
import { loadAgentACreds, runAgentA } from './agent-a.js';
import { loadAgentBCreds, runAgentB } from './agent-b.js';
import { loadAgentCCreds, runAgentC } from './agent-c.js';
import { CHAIN_ID, TAGLINE } from './agent-templates.js';
import { runMockOrchestrator } from './mock-orchestrator.js';
import { STORY_MODE, SKIP_SEARCH, storyAct1, storyAct2, storyAct3, storyAct4, storyAct5, storyFinale, makeStoryLogger } from './story-printer.js';

function ts() {
  return new Date().toISOString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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
 * 运行完整 Demo 编排
 * @param {object} options
 * @param {Array} options.logSink - 可选，日志收集数组（用于 SSE 推送）
 * @param {Function} options.onPhase - 可选，阶段变更回调 (phase) => void
 * @param {Function} options.onLog - 可选，日志写入回调 (log) => void
 * @returns {Promise<object>} 完整结果
 */
export async function runOrchestrator(options = {}) {
  const { logSink = [], onPhase = () => {}, onLog = null, storyMode = false, skipSearch = false } = options;
  const log = storyMode ? makeStoryLogger(logSink, onLog) : makeLogger(logSink, onLog);

  const hubUrl = process.env.A2A_HUB_URL || 'https://evomap.ai';
  const client = new EvoMapClient(hubUrl);

  const result = {
    started_at: ts(),
    completed_at: null,
    phase: 'init',
    completed_steps: [],
    stepTimings: [],
    total_duration_ms: null,
    a: null,
    b: null,
    c: null,
    accept: null,
    chain: null,
    earnings: null,
    error: null,
  };

  function setPhase(p) {
    result.phase = p;
    onPhase(p);
    log(`━━━━━━━━━━ 阶段: ${p} ━━━━━━━━━━`, 'phase');
  }

  try {
    // ──────────────────────────────────────────────────────────
    // 阶段 1：Agent A 发起悬赏 + 失败 Capsule
    // ──────────────────────────────────────────────────────────
    let stepStart = Date.now();
    setPhase('agent-a-hello');
    log('加载 Agent A 凭证...');
    const aCreds = await loadAgentACreds(client, (m) => log(m));
    result.a_creds = { node_id: aCreds.nodeId, claim_url: aCreds.claimUrl };

    setPhase('agent-a-ask-publish');
    log('Agent A 发起悬赏 + 发布 failed Capsule...');
    const aResult = await runAgentA(client, aCreds.nodeId, aCreds.nodeSecret, (m) => log(m));
    result.a = aResult;
    result.completed_steps.push('agent-a');
    result.stepTimings.push({ step: 'agent-a', duration_ms: Date.now() - stepStart });
    if (storyMode) storyAct1(aResult);

    // Wait for Hub indexing (semantic-search has cache delay; 8s is typically sufficient)
    if (skipSearch) {
      log('SKIP_SEARCH 模式：跳过等待');
    } else {
      log('等待 8 秒让 Hub 索引新发布的 Capsule...');
      await sleep(8000);
    }

    // ──────────────────────────────────────────────────────────
    // 阶段 2：Agent B 认领 + 成功 Capsule + task/complete
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('agent-b-hello');
    log('加载 Agent B 凭证...');
    const bCreds = await loadAgentBCreds(client, (m) => log(m));
    result.b_creds = { node_id: bCreds.nodeId, claim_url: bCreds.claimUrl };

    setPhase('agent-b-claim-solve');
    log('Agent B 认领 + 搜失败经验 + 发布成功 Capsule + task/complete...');
    const bResult = await runAgentB(
      client,
      bCreds.nodeId,
      bCreds.nodeSecret,
      {
        task_id: aResult.task_id,
        a_capsule_id: aResult.capsule_id,
        a_gene_id: aResult.gene_id,
      },
      (m) => log(m)
    );
    result.b = bResult;
    result.completed_steps.push('agent-b');
    result.stepTimings.push({ step: 'agent-b', duration_ms: Date.now() - stepStart });
    if (storyMode) storyAct2();

    // ──────────────────────────────────────────────────────────
    // 阶段 3：Agent A 调用 accept-submission 选优胜
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('agent-a-accept');
    if (aResult.task_id && bResult.submission_id) {
      log(`Agent A 选优胜: submission_id=${bResult.submission_id}`);
      try {
        const acceptRes = await client.taskAcceptSubmission(
          aCreds.nodeId, aCreds.nodeSecret,
          aResult.task_id, bResult.submission_id
        );
        result.accept = acceptRes;
        result.completed_steps.push('accept-submission');
        log(`accept-submission 完成`);
      } catch (err) {
        log(`⚠️ accept-submission 失败: ${err.message}`, 'warn');
        log(`fallback: 直接展示 publish 链路`, 'warn');
        result.accept = { error: err.message, fallback: 'skipped' };
        result.completed_steps.push('accept-submission-skipped');
      }
    } else {
      log(`⚠️ 跳过 accept-submission（task_id=${aResult.task_id}, submission_id=${bResult.submission_id}）`, 'warn');
      log(`Demo 中展示 publish 链路 + 手动声明"加速展示"`, 'warn');
      result.accept = { fallback: 'skipped (no task/submission)' };
      result.completed_steps.push('accept-submission-skipped');
    }
    result.stepTimings.push({ step: 'accept-submission', duration_ms: Date.now() - stepStart });

    // Wait for Hub to index B's success Capsule (5s is sufficient after accept-submission)
    if (skipSearch) {
      log('SKIP_SEARCH 模式：跳过等待');
    } else {
      log('等待 5 秒让 Hub 索引 B 的 success Capsule...');
      await sleep(5000);
    }

    // ──────────────────────────────────────────────────────────
    // 阶段 4：Agent C 复用 B 经验秒级修复
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('agent-c-hello');
    log('加载 Agent C 凭证...');
    const cCreds = await loadAgentCCreds(client, (m) => log(m));
    result.c_creds = { node_id: cCreds.nodeId, claim_url: cCreds.claimUrl };

    setPhase('agent-c-reuse');
    log('Agent C 搜 B 成功经验 + 秒级修复...');
    const cResult = await runAgentC(
      client,
      cCreds.nodeId,
      cCreds.nodeSecret,
      {
        b_capsule_id: bResult.capsule_id,
        b_gene_id: bResult.gene_id,
      },
      (m) => log(m)
    );
    result.c = cResult;
    result.completed_steps.push('agent-c');
    result.stepTimings.push({ step: 'agent-c', duration_ms: Date.now() - stepStart });
    if (storyMode) storyAct3();

    // ──────────────────────────────────────────────────────────
    // 阶段 5：打印能力链 + A 的积分流水
    // ──────────────────────────────────────────────────────────
    stepStart = Date.now();
    setPhase('chain-earnings');
    log(`查询能力链: GET /a2a/assets/chain/${CHAIN_ID}`);
    try {
      const chainRes = await client.getChain(aCreds.nodeId, aCreds.nodeSecret, CHAIN_ID);
      result.chain = chainRes;
      const chainItems = chainRes?.assets || chainRes?.items || [];
      const chainCount = Array.isArray(chainItems) ? chainItems.length : 0;
      const chainSource = chainRes?._fallback ? '（从 published-by-me 溯源构建）' : '';
      log(`能力链查询完成，共 ${chainCount} 个资产（A→B→C）${chainSource}`);
    } catch (err) {
      log(`⚠️ 能力链查询失败: ${err.message}`, 'warn');
      // 即使失败也尝试用 published-by-me 构建
      try {
        const fallbackChain = await client.buildChainFromPublished(aCreds.nodeId, aCreds.nodeSecret, CHAIN_ID);
        result.chain = { ...fallbackChain, _fallback: true, _fallback_error: err.message };
        log(`fallback: 从 published-by-me 构建能力链，共 ${fallbackChain.assets.length} 个资产`);
      } catch (err2) {
        result.chain = { error: err.message, fallback_error: err2.message };
      }
    }

    if (storyMode) storyAct4(result.chain);

    log(`查询 A 的积分流水: GET /billing/earnings/${aCreds.nodeId}`);
    try {
      const earningsRes = await client.getEarnings(aCreds.nodeId, aCreds.nodeSecret, aCreds.nodeId);
      result.earnings = earningsRes;
      if (earningsRes.error === 'earnings_requires_user_session') {
        log(`⚠️ 积分流水端点需用户浏览器 session，fallback 到心跳余额`, 'warn');
        log(`   credit_balance ≈ ${earningsRes.credit_balance ?? '未知'} 积分`);
      } else {
        log(`积分流水查询完成`);
      }
    } catch (err) {
      log(`⚠️ 积分流水查询失败: ${err.message}`, 'warn');
      try {
        const hb = await client.heartbeat(aCreds.nodeId, aCreds.nodeSecret);
        const balance = hb?.credit_balance ?? null;
        result.earnings = { error: err.message, credit_balance: balance, entries: [], total: 0 };
        log(`fallback: 心跳余额 ≈ ${balance ?? '未知'} 积分`);
      } catch {
        result.earnings = { error: err.message, entries: [], total: 0 };
      }
    }
    if (storyMode) storyAct5(result.earnings);
    result.stepTimings.push({ step: 'chain-earnings', duration_ms: Date.now() - stepStart });

    // ──────────────────────────────────────────────────────────
    // 收尾：点题
    // ──────────────────────────────────────────────────────────
    const totalMs = Date.now() - new Date(result.started_at).getTime();
    result.total_duration_ms = totalMs;
    setPhase('done');
    if (storyMode) {
      storyFinale(TAGLINE, totalMs, result.simulated_savings);
    } else {
      log('━━━━━━━━━━ Demo 完成 ━━━━━━━━━━', 'phase');
      log(`点题: ${TAGLINE}`, 'phase');
      log(`⏱ 总耗时: ${totalMs}ms (${(totalMs / 1000).toFixed(1)}s)`, 'phase');
      for (const t of result.stepTimings) {
        log(`  ├ ${t.step}: ${t.duration_ms}ms (${(t.duration_ms / 1000).toFixed(1)}s)`, 'phase');
      }
    }
    result.completed_at = ts();
    return result;
  } catch (err) {
    result.error = {
      phase: result.phase,
      message: err.message,
      stack: err.stack,
    };
    result.completed_at = ts();
    log(`❌ Demo 在阶段 [${result.phase}] 失败: ${err.message}`, 'error');
    log(`下一步建议: 检查上述错误信息，对照方案 E 文档第七节"待实测验证的关键点"`, 'error');
    // Auto-fallback: return partial result so the frontend still has data to display
    // Don't rethrow — let the caller handle the graceful degradation
    if (process.env.MOCK_MODE !== 'true') {
      log(`💡 如果 Hub 不可达，可在 .env 中设置 MOCK_MODE=true 切换到 mock 模式`, 'warn');
    }
    return result;
  }
}

function hasCredentials() {
  return !!(process.env.A_NODE_ID && process.env.A_NODE_SECRET) ||
         !!(process.env.B_NODE_ID && process.env.B_NODE_SECRET) ||
         !!(process.env.C_NODE_ID && process.env.C_NODE_SECRET);
}

// ── 独立运行入口 ──
async function main() {
  const args = process.argv.slice(2);
  const useMock = args.includes('--mock');
  const forceReal = args.includes('--force-real');
  const help = args.includes('--help') || args.includes('-h');

  if (help) {
    console.log('用法: node src/demo/orchestrator.js [options]');
    console.log('');
    console.log('选项:');
    console.log('  --mock       强制 Mock 模式');
    console.log('  --force-real 强制真实模式');
    console.log('  -h, --help   显示帮助');
    console.log('');
    console.log('环境变量:');
    console.log('  STORY_MODE=1  故事模式');
    console.log('  SKIP_SEARCH=1 跳过搜索等待');
    process.exit(0);
  }

  const storyMode = STORY_MODE;

  if (storyMode) {
    console.log('\n  🍯  BountyHive Demo · 故事模式  🍯');
    console.log('  ======================================\n');
  } else {
    console.log('┌────────────────────────────────────────────┐');
    console.log('│  BountyHive Demo 编排启动                  │');
    console.log('│  方案 E：悬赏市场蜂群接单进化体            │');
    console.log('└────────────────────────────────────────────┘');
  }

  try {
    let result;
    if (useMock || (!forceReal && !hasCredentials())) {
      if (!useMock && !storyMode) {
        console.log('⚠️  未检测到凭证，自动切换到 Mock 模式');
      }
      result = await runMockOrchestrator({ storyMode, skipSearch: SKIP_SEARCH });
    } else {
      result = await runOrchestrator({ storyMode, skipSearch: SKIP_SEARCH });
    }
    if (!storyMode) {
      console.log('\n=== 最终结果 ===');
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(0);
  } catch (err) {
    if (!storyMode) {
      console.error('\n=== Demo 失败 ===');
      console.error(err.message);
    } else {
      console.log(`\n  ❌ Demo 失败: ${err.message}`);
    }
    process.exit(1);
  }
}

const isMain = process.argv[1] && process.argv[1].endsWith('orchestrator.js');
if (isMain) {
  main();
}
