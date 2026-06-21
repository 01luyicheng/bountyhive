// src/demo/agent-c.js
// Agent C：经验复用者（秒级修复，溯源 B）
// 参考：方案E-BountyHive-修正版.md 第二节"高潮"阶段
//
// 动作：
//   1. hello（用 C_NODE_ID/C_NODE_SECRET）
//   2. semantic-search 搜到 A 失败 + B 成功
//   3. fetch B 的成功 Capsule
//   4. 秒级修复（直接复用 B 的策略），publish success Capsule（溯源 B）

import 'dotenv/config';
import EvoMapClient from '../lib/evomap-client.js';
import { loadAgentCreds } from './agent-creds.js';
import { withAssetId } from '../lib/asset-id.js';
import { tryPublishWithFallback } from '../lib/bounty-flow.js';
import {
  makeAgentCGeneTemplate,
  makeAgentCCapsuleTemplate,
  makeEvolutionEventTemplate,
  CHAIN_ID,
} from './agent-templates.js';

function defaultLog(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Agent C] ${msg}`);
}

/**
 * 加载 C 凭证
 */
export async function loadAgentCCreds(client, log = defaultLog) {
  return loadAgentCreds(client, 'C', 'BountyHive Agent C', log);
}

/**
 * 通过 semantic-search 找到 B 的 success Capsule
 * @param {EvoMapClient} client
 * @param {string} nodeId
 * @param {string} nodeSecret
 * @param {string} bCapsuleId - B 的 capsule asset_id
 * @param {Function} log
 */
async function findSuccessCapsule(client, nodeId, nodeSecret, bCapsuleId, log, signal) {
  log('semantic-search 搜成功经验: q=useEffect dependency, outcome=success');
  for (let attempt = 1; attempt <= 5; attempt++) {
    if (signal?.aborted) {
      throw new Error('search cancelled');
    }
    const res = await client.semanticSearch(
      nodeId,
      nodeSecret,
      'useEffect dependency useCallback',
      { outcome: 'success', limit: 20, include_context: true }
    );
    const items = res?.results || res?.assets || res?.items || [];
    if (items.length > 0) {
      log(`搜到 ${items.length} 条成功 Capsule`);
      const exact = items.find((it) => it.asset_id === bCapsuleId);
      if (exact) {
        log(`精确匹配到 B 的 Capsule: ${bCapsuleId}`);
        return exact;
      }
      log(`未精确匹配，取第一条: ${items[0].asset_id || items[0].id}`);
      return items[0];
    }
    log(`第 ${attempt} 次搜索无结果，等待 10 秒后重试（semantic-search 30s 缓存延迟）...`);
    await new Promise((r) => setTimeout(r, 10000));
  }
  throw new Error(
    `[Agent C] semantic-search 5 次重试后仍未搜到 B 的 success Capsule\n` +
      `下一步建议: 1) 确认 B 已 publish 成功 2) 改用 GET /a2a/assets?status=promoted`
  );
}

/**
 * Agent C 完整动作
 * @param {EvoMapClient} client
 * @param {string} nodeId
 * @param {string} nodeSecret
 * @param {object} context - { b_capsule_id, b_gene_id }
 * @param {Function} log
 * @returns {Promise<object>} { gene_id, capsule_id, publish_res, fetch_res }
 */
export async function runAgentC(client, nodeId, nodeSecret, context, log = defaultLog, signal) {
  const { b_capsule_id: bCapsuleId, b_gene_id: bGeneId } = context;
  if (!bCapsuleId) {
    throw new Error('[Agent C] 缺少 b_capsule_id');
  }

  // ── 第 2 步：semantic-search 搜到 A 失败 + B 成功 ──
  log('同时搜 A 失败 + B 成功经验...');
  const successCapsule = await findSuccessCapsule(client, nodeId, nodeSecret, bCapsuleId, log, signal);

  // 也搜一下 A 的失败经验（展示用，方案 E 第二节"高潮"）
  try {
    const failedRes = await client.semanticSearch(
      nodeId,
      nodeSecret,
      'useEffect dependency',
      { outcome: 'failed', limit: 5 }
    );
    const failedItems = failedRes?.results || failedRes?.assets || failedRes?.items || [];
    log(`同时搜到 ${failedItems.length} 条失败经验（A 的教训）`);
  } catch (err) {
    log(`搜失败经验时出错（非致命）: ${err.message}`);
  }

  // ── 第 3 步：fetch B 的成功 Capsule（B 获积分） ──
  log(`fetch B 的成功 Capsule: asset_ids=[${bCapsuleId}]（B 获积分）`);
  const fetchRes = await client.fetch(nodeId, nodeSecret, { asset_ids: [bCapsuleId] });
  log(`fetch 完成，B 应获得 0-12 积分`);

  // ── 第 4 步：秒级修复（直接复用 B 的策略），publish success Capsule ──
  log('秒级修复：直接复用 B 的策略（useCallback + 依赖数组）');
  const gene = makeAgentCGeneTemplate(bGeneId);
  withAssetId(gene);

  const capsule = makeAgentCCapsuleTemplate(bCapsuleId, bCapsuleId);
  withAssetId(capsule);

  // EvolutionEvent
  const event = makeEvolutionEventTemplate('repair', { status: 'success', score: 0.95 }, 1, 1);
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

  // publish
  log(`发布成功 Capsule: capsule_success_002（溯源 B: ${bCapsuleId}）`);
  const publishRes = await client.publish(nodeId, nodeSecret, publishAssets, CHAIN_ID);
  const publishedCapsule = publishAssets.find((a) => a.type === 'Capsule');
  log(`success Capsule 已发布: capsule_id=${publishedCapsule.asset_id}`);

  return {
    gene_id: gene.asset_id,
    capsule_id: publishedCapsule.asset_id,
    publish_res: publishRes,
    fetch_res: fetchRes,
    chain_id: CHAIN_ID,
  };
}

// ── 独立运行入口 ──
async function main() {
  const hubUrl = process.env.A2A_HUB_URL || 'https://evomap.ai';
  const client = new EvoMapClient(hubUrl);
  const { nodeId, nodeSecret } = await loadAgentCCreds(client);

  const bCapsuleId = process.env.B_CAPSULE_ID;
  const bGeneId = process.env.B_GENE_ID;
  if (!bCapsuleId) {
    console.error('独立运行 Agent C 需要环境变量: B_CAPSULE_ID, B_GENE_ID');
    console.error('或通过 orchestrator 编排运行');
    process.exit(1);
  }
  const result = await runAgentC(client, nodeId, nodeSecret, {
    b_capsule_id: bCapsuleId,
    b_gene_id: bGeneId,
  });
  console.log('\n=== Agent C 完成 ===');
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && process.argv[1].endsWith('agent-c.js');
if (isMain) {
  main().catch((err) => {
    console.error('[Agent C] 致命错误:', err.message);
    process.exit(1);
  });
}
