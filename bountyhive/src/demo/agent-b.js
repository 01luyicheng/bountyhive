// src/demo/agent-b.js
// Agent B：求解者 + 成功经验沉淀者（溯源 A）
// 参考：方案E-BountyHive-修正版.md 第二节"进化"阶段
//
// 动作：
//   1. hello（用 B_NODE_ID/B_NODE_SECRET）
//   2. GET /a2a/task/list 找到 A 的悬赏
//   3. POST /a2a/task/claim 认领
//   4. GET /a2a/assets/semantic-search?q=useEffect+dependency&outcome=failed 搜到 A 的 Capsule
//   5. POST /a2a/fetch asset_ids=[A的capsule_id] 获取（A 获积分）
//   6. 基于失败经验避开雷区，构造成功 Gene+Capsule（reused_asset_id 指向 A, parent 指向 A）
//   7. POST /a2a/publish 发布成功 Capsule
//   8. POST /a2a/task/complete（body: task_id, asset_id, node_id）

import 'dotenv/config';
import EvoMapClient from '../lib/evomap-client.js';
import { withAssetId } from '../lib/asset-id.js';
import { tryPublishWithFallback } from '../lib/bounty-flow.js';
import {
  makeAgentBGeneTemplate,
  makeAgentBCapsuleTemplate,
  makeEvolutionEventTemplate,
  CHAIN_ID,
} from './agent-templates.js';
import { loadAgentCreds } from './agent-creds.js';

function defaultLog(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Agent B] ${msg}`);
}

/**
 * 加载 B 凭证
 */
export async function loadAgentBCreds(client, log = defaultLog) {
  return loadAgentCreds(client, 'B', 'BountyHive Agent B', log);
}

/**
 * 通过 semantic-search 找到 A 的 failed Capsule
 * @param {EvoMapClient} client
 * @param {string} nodeId
 * @param {string} nodeSecret
 * @param {string} aCapsuleId - A 的 capsule asset_id（用于精确匹配）
 * @param {Function} log
 * @returns {Promise<object>} 搜索结果中的 A 的 Capsule 条目
 */
async function findFailedCapsule(client, nodeId, nodeSecret, aCapsuleId, log, signal) {
  log('semantic-search 搜失败经验: q=useEffect dependency, outcome=failed');
  // 注意：semantic-search 有 30 秒缓存延迟，A 刚 publish 后可能搜不到
  // 多次重试（支持外部取消）
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (signal?.aborted) {
      throw new Error('search cancelled');
    }
    const res = await client.semanticSearch(
      nodeId,
      nodeSecret,
      'useEffect dependency',
      { outcome: 'failed', limit: 20, include_context: true }
    );
    const items = res?.results || res?.assets || res?.items || [];
    if (items.length > 0) {
      log(`搜到 ${items.length} 条失败 Capsule`);
      // 优先精确匹配 A 的 capsule_id
      const exact = items.find((it) => it.asset_id === aCapsuleId);
      if (exact) {
        log(`精确匹配到 A 的 Capsule: ${aCapsuleId}`);
        return exact;
      }
      // 否则返回第一条（fallback）
      log(`未精确匹配，取第一条: ${items[0].asset_id || items[0].id}`);
      return items[0];
    }
    log(`第 ${attempt} 次搜索无结果，等待 10 秒后重试（semantic-search 30s 缓存延迟）...`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error(
    `[Agent B] semantic-search 5 次重试后仍未搜到 A 的 failed Capsule\n` +
      `下一步建议: 1) 确认 A 已 publish 成功 2) 改用 GET /a2a/assets?status=candidate 列出 candidate 资产`
  );
}

/**
 * Agent B 完整动作
 * @param {EvoMapClient} client
 * @param {string} nodeId
 * @param {string} nodeSecret
 * @param {object} context - { task_id, a_capsule_id, a_gene_id }
 * @param {Function} log
 * @returns {Promise<object>} { gene_id, capsule_id, claim_res, publish_res, complete_res, submission_id }
 */
export async function runAgentB(client, nodeId, nodeSecret, context, log = defaultLog, signal) {
  const { task_id: taskId, a_capsule_id: aCapsuleId, a_gene_id: aGeneId } = context;
  if (!taskId || !aCapsuleId) {
    throw new Error('[Agent B] 缺少 task_id 或 a_capsule_id');
  }

  // ── 第 2 步：task/list 确认悬赏存在（可选，主要为了日志展示） ──
  log(`查询任务列表，确认 task_id=${taskId} 存在`);
  const taskListRes = await client.taskList(nodeId, nodeSecret, { limit: 20 });
  const tasks = taskListRes?.tasks || taskListRes?.items || [];
  const found = tasks.find((t) => (t.task_id || t.id) === taskId);
  if (found) {
    log(`任务列表中找到: ${found.title || '(no title)'}`);
  } else {
    log(`任务列表中未直接找到（可能已被认领或缓存延迟），继续用传入的 task_id`);
  }

  // ── 第 3 步：认领任务（方案 E v5 修正端点） ──
  log(`认领任务: task_id=${taskId}`);
  const claimRes = await client.taskClaim(nodeId, nodeSecret, taskId);
  log(`认领成功: ${JSON.stringify(claimRes).slice(0, 200)}`);

  // ── 第 4 步：semantic-search 搜到 A 的 failed Capsule ──
  const failedCapsule = await findFailedCapsule(client, nodeId, nodeSecret, aCapsuleId, log, signal);

  // ── 第 5 步：fetch A 的 Capsule（A 获积分） ──
  log(`fetch A 的 Capsule: asset_ids=[${aCapsuleId}]（A 获积分）`);
  const fetchRes = await client.fetch(nodeId, nodeSecret, { asset_ids: [aCapsuleId] });
  log(`fetch 完成，A 应获得 0-12 积分（GDI 分档）`);

  // ── 第 6 步：构造成功 Gene+Capsule（溯源 A） ──
  log('基于 A 的失败经验避开雷区，构造成功方案（含 useCallback）');
  const gene = makeAgentBGeneTemplate(aGeneId);
  withAssetId(gene);

  const capsule = makeAgentBCapsuleTemplate(aCapsuleId, aCapsuleId);
  withAssetId(capsule);

  // EvolutionEvent
  const event = makeEvolutionEventTemplate('repair', { status: 'success', score: 0.9 }, 2, 3);
  event.type = 'EvolutionEvent';
  event.capsule_id = capsule.asset_id;
  event.genes_used = [gene.asset_id];
  withAssetId(event);

  const assets = [gene, capsule, event];

  // validate 预检（含 Capsule 未知字段 fallback）
  const publishAssets = await tryPublishWithFallback(
    client,
    nodeId,
    nodeSecret,
    assets,
    CHAIN_ID,
    log
  );

  // ── 第 7 步：publish 成功 Capsule ──
  log(`发布成功 Capsule: capsule_success_001（溯源 A: ${aCapsuleId}）`);
  const publishRes = await client.publish(nodeId, nodeSecret, publishAssets, CHAIN_ID);
  const publishedCapsule = publishAssets.find((a) => a.type === 'Capsule');
  log(`success Capsule 已发布: capsule_id=${publishedCapsule.asset_id}`);

  // ── 第 8 步：task/complete（body: task_id, asset_id, node_id） ──
  log(`完成任务: task_id=${taskId}, asset_id=${publishedCapsule.asset_id}`);
  const completeRes = await client.taskComplete(nodeId, nodeSecret, taskId, publishedCapsule.asset_id);
  log(`task/complete 完成`);

  // submission_id 通常在 complete_res 或 task/my 中返回
  const submissionId =
    completeRes?.submission_id ||
    completeRes?.submissionId ||
    publishRes?.submission_id ||
    null;
  if (submissionId) {
    log(`submission_id=${submissionId}（待 A 调用 accept-submission）`);
  } else {
    log(`⚠️ 未从 complete/publish 响应中获取 submission_id，A 需通过 GET /a2a/task/my 查询`);
  }

  return {
    gene_id: gene.asset_id,
    capsule_id: publishedCapsule.asset_id,
    claim_res: claimRes,
    publish_res: publishRes,
    complete_res: completeRes,
    fetch_res: fetchRes,
    submission_id: submissionId,
    chain_id: CHAIN_ID,
  };
}

// ── 独立运行入口 ──
async function main() {
  const hubUrl = process.env.A2A_HUB_URL || 'https://evomap.ai';
  const client = new EvoMapClient(hubUrl);
  const { nodeId, nodeSecret } = await loadAgentBCreds(client);

  // 独立运行时需要手动传入 task_id 和 a_capsule_id
  const taskId = process.env.A_TASK_ID;
  const aCapsuleId = process.env.A_CAPSULE_ID;
  const aGeneId = process.env.A_GENE_ID;
  if (!taskId || !aCapsuleId) {
    console.error('独立运行 Agent B 需要环境变量: A_TASK_ID, A_CAPSULE_ID, A_GENE_ID');
    console.error('或通过 orchestrator 编排运行');
    process.exit(1);
  }
  const result = await runAgentB(client, nodeId, nodeSecret, {
    task_id: taskId,
    a_capsule_id: aCapsuleId,
    a_gene_id: aGeneId,
  });
  console.log('\n=== Agent B 完成 ===');
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && process.argv[1].endsWith('agent-b.js');
if (isMain) {
  main().catch((err) => {
    console.error('[Agent B] 致命错误:', err.message);
    process.exit(1);
  });
}
