// src/demo/agent-a.js
// Agent A：悬赏者 + 失败经验沉淀者
// 参考：方案E-BountyHive-修正版.md 第二节"冲突"阶段
//
// 动作：
//   1. hello（用 A_NODE_ID/A_NODE_SECRET，若空则新注册并打印 claim_url）
//   2. POST /a2a/ask 发起悬赏（50 积分）
//   3. 自己尝试修复（模拟失败），publish failed Capsule
//   4. 打印失败独白文案

import 'dotenv/config';
import EvoMapClient from '../lib/evomap-client.js';
import { computeAssetId, withAssetId } from '../lib/asset-id.js';
import { tryPublishWithFallback } from '../lib/bounty-flow.js';
import {
  AGENT_A_GENE_TEMPLATE,
  AGENT_A_CAPSULE_TEMPLATE,
  CHAIN_ID,
  FAILURE_MONOLOGUE,
  makeEvolutionEventTemplate,
} from './agent-templates.js';
import { loadAgentCreds } from './agent-creds.js';

const BOUNTY_AMOUNT = 50;
const BOUNTY_TITLE = 'Fix React useEffect dependency missing';
const BOUNTY_SIGNALS = ['useEffect', 'dependency-missing', 'react-hooks'];
const BOUNTY_BODY =
  'React useEffect hook 依赖数组缺失导致回调函数闭包过期。希望求解者提供完整修复方案（含 useCallback 包装）。';

/**
 * 默认日志器：带时间戳
 * @param {string} msg
 */
function defaultLog(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Agent A] ${msg}`);
}

/**
 * 加载 A 凭证：优先用环境变量，否则 hello 注册新节点
 * @param {EvoMapClient} client
 * @param {Function} log
 * @returns {Promise<{nodeId: string, nodeSecret: string, claimUrl?: string}>}
 */
export async function loadAgentACreds(client, log = defaultLog) {
  return loadAgentCreds(client, 'A', 'BountyHive Agent A', log);
}

/**
 * Agent A 完整动作
 * @param {EvoMapClient} client
 * @param {string} nodeId
 * @param {string} nodeSecret
 * @param {Function} log
 * @returns {Promise<object>} { task_id, gene_id, capsule_id, ask_res, publish_res }
 */
export async function runAgentA(client, nodeId, nodeSecret, log = defaultLog) {
  // ── 第 2 步：发起悬赏（方案 E 第一节） ──
  log(`发起悬赏: "${BOUNTY_TITLE}" (${BOUNTY_AMOUNT} 积分)`);
  let taskId = null;
  let askRes = null;
  try {
    askRes = await client.ask(
      nodeId,
      nodeSecret,
      BOUNTY_TITLE,
      BOUNTY_SIGNALS,
      BOUNTY_AMOUNT,
      BOUNTY_BODY
    );
    taskId = askRes.task_id || askRes.taskId || askRes.bounty_id || null;
    log(`悬赏已创建: ${taskId ? `task_id=${taskId}` : `bounty_id=${askRes.bounty_id}`}`);
    if (!taskId) log(`⚠️ 无 task_id，后续跳过 task/claim 流程，直接走 publish 链路`, 'warn');
  } catch (err) {
    log(`⚠️ 发起悬赏失败: ${err.message}，跳过 bounty 流程`, 'warn');
  }

  // ── 第 3 步：自己尝试修复（模拟失败），发布 failed Capsule（方案 E 第二节） ──
  log('尝试自己修复... 遗漏 useCallback 回调，失败。');
  log('发布 failed Capsule: capsule_lesson_burned_001');

  const gene = { ...AGENT_A_GENE_TEMPLATE };
  withAssetId(gene);

  const capsule = {
    ...AGENT_A_CAPSULE_TEMPLATE,
    gene: gene.asset_id,
  };
  withAssetId(capsule);

  // EvolutionEvent（提升 GDI 分）
  const event = makeEvolutionEventTemplate(
    'repair',
    { status: 'failed', score: 0.4 },
    1,
    1
  );
  event.type = 'EvolutionEvent';
  event.capsule_id = capsule.asset_id;
  event.genes_used = [gene.asset_id];
  withAssetId(event);

  const assets = [gene, capsule, event];

  // 先 validate 预检（含 Capsule 未知字段 fallback）
  const publishAssets = await tryPublishWithFallback(
    client,
    nodeId,
    nodeSecret,
    assets,
    CHAIN_ID,
    log
  );

  // publish
  const publishRes = await client.publish(nodeId, nodeSecret, publishAssets, CHAIN_ID);
  const publishedCapsule = publishAssets.find((a) => a.type === 'Capsule');
  log(`failed Capsule 已发布: capsule_id=${publishedCapsule.asset_id}`);

  // ── 第 4 步：打印失败独白（方案 E 第二节"失败独白"原文） ──
  console.log('\n┌────────────── 失败独白 ──────────────┐');
  console.log(FAILURE_MONOLOGUE
    .split('\n')
    .map((l) => '│ ' + l)
    .join('\n'));
  console.log('└──────────────────────────────────────┘\n');

  return {
    task_id: taskId,
    gene_id: gene.asset_id,
    capsule_id: publishedCapsule.asset_id,
    ask_res: askRes,
    publish_res: publishRes,
    chain_id: CHAIN_ID,
  };
}

// ── 独立运行入口 ──
async function main() {
  const hubUrl = process.env.A2A_HUB_URL || 'https://evomap.ai';
  const client = new EvoMapClient(hubUrl);
  const { nodeId, nodeSecret } = await loadAgentACreds(client);
  const result = await runAgentA(client, nodeId, nodeSecret);
  console.log('\n=== Agent A 完成 ===');
  console.log(JSON.stringify(result, null, 2));
}

// 仅在直接执行时运行（被 orchestrator import 时不运行）
const isMain = process.argv[1] && process.argv[1].endsWith('agent-a.js');
if (isMain) {
  main().catch((err) => {
    console.error('[Agent A] 致命错误:', err.message);
    process.exit(1);
  });
}
