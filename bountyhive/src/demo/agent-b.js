import 'dotenv/config';
import EvoMapClient from '../lib/evomap-client.js';
import { withAssetId } from '../lib/asset-id.js';
import { tryPublishWithFallback } from '../lib/bounty-flow.js';
const _STORY_MODE_B = process.env.STORY_MODE === '1';
import {
  makeAgentBGeneTemplate,
  makeAgentBCapsuleTemplate,
  makeEvolutionEventTemplate,
  CHAIN_ID,
} from './agent-templates.js';
import { loadAgentCreds } from './agent-creds.js';

function defaultLog(msg, level = 'info') {
  if (_STORY_MODE_B && level === 'warn') level = 'info';
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Agent B] ${msg}`);
}

export async function loadAgentBCreds(client, log = defaultLog) {
  return loadAgentCreds(client, 'B', 'BountyHive Agent B', log);
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function findFailedCapsule(client, nodeId, nodeSecret, aCapsuleId, log, signal) {
  log('semantic-search 搜失败经验: q=useEffect dependency, outcome=failed');
  for (let attempt = 1; attempt <= 8; attempt++) {
    if (signal?.aborted) throw new Error('search cancelled');
    try {
      const res = await client.semanticSearch(
        nodeId, nodeSecret, 'useEffect dependency',
        { outcome: 'failed', limit: 20, include_context: true }
      );
      const items = res?.results || res?.assets || res?.items || [];
      if (items.length > 0) {
        log(`搜到 ${items.length} 条失败 Capsule`);
        const exact = items.find((it) => it.asset_id === aCapsuleId);
        if (exact) { log(`精确匹配到 A 的 Capsule: ${aCapsuleId}`); return exact; }
        log(`未精确匹配到 A 的 Capsule，取第一条: ${items[0].asset_id || items[0].id}`);
        return items[0];
      }
      log(`第 ${attempt} 次搜索无结果，等待 12 秒后重试（semantic-search 有缓存延迟）...`);
      await sleep(12000);
    } catch (err) {
      const is429 = err.status === 429;
      if (is429) {
        let retryMs = 12000;
        try { const body = JSON.parse(err.body?.toString?.() || '{}'); retryMs = (body.retry_after_ms || 10000) + 2000; } catch {}
        log(`⚠️ 限流，等待 ${Math.round(retryMs/1000)}s 后重试...`, 'warn');
        await sleep(retryMs);
      } else {
        throw err;
      }
    }
  }
  log(`⚠️ semantic-search 8 次重试后仍未搜到，直接使用 a_capsule_id=${aCapsuleId}`, 'warn');
  return { asset_id: aCapsuleId };
}

export async function runAgentB(client, nodeId, nodeSecret, context, log = defaultLog, signal) {
  const { task_id: taskId, a_capsule_id: aCapsuleId, a_gene_id: aGeneId } = context;
  if (!aCapsuleId) throw new Error('[Agent B] 缺少 a_capsule_id');

  if (taskId) {
    try {
      log(`尝试认领任务: task_id=${taskId}`);
      await client.taskClaim(nodeId, nodeSecret, taskId);
      log(`认领成功`);
    } catch (err) {
      log(`⚠️ task/claim 不可用（${err.message}），跳过认领，直接走 publish 链路`, 'warn');
    }

    try {
      log(`尝试 bid/place: bounty_id=${taskId}`);
      await client.bidPlace(nodeId, nodeSecret, taskId, 0);
      log(`bid/place 成功`);
    } catch (err) {
      log(`⚠️ bid/place 不可用，跳过`);
    }
  } else {
    log(`⚠️ 无 task_id，跳过 task/claim 和 bid/place，直接搜 A 的 Capsule`, 'warn');
  }

  const failedCapsule = await findFailedCapsule(client, nodeId, nodeSecret, aCapsuleId, log, signal);

  log(`fetch A 的 Capsule: asset_ids=[${aCapsuleId}]（A 获积分）`);
  await client.fetch(nodeId, nodeSecret, { asset_ids: [aCapsuleId] });
  log(`fetch 完成，A 应获得积分`);

  log('基于 A 的失败经验避开雷区，构造成功方案（含 useCallback）');
  const gene = makeAgentBGeneTemplate(aGeneId);
  withAssetId(gene);
  const capsule = makeAgentBCapsuleTemplate(aCapsuleId, aCapsuleId);
  withAssetId(capsule);
  const event = makeEvolutionEventTemplate('repair', { status: 'success', score: 0.9 }, 2, 3);
  event.type = 'EvolutionEvent';
  event.capsule_id = capsule.asset_id;
  event.genes_used = [gene.asset_id];
  withAssetId(event);

  const assets = [gene, capsule, event];
  const publishAssets = await tryPublishWithFallback(client, nodeId, nodeSecret, assets, CHAIN_ID, log);

  log(`发布成功 Capsule: capsule_success_001（溯源 A: ${aCapsuleId}）`);
  const publishRes = await client.publish(nodeId, nodeSecret, publishAssets, CHAIN_ID);
  const publishedCapsule = publishAssets.find((a) => a.type === 'Capsule');
  log(`success Capsule 已发布: capsule_id=${publishedCapsule.asset_id}`);

  if (taskId) {
    try {
      log(`尝试 task/complete: task_id=${taskId}, asset_id=${publishedCapsule.asset_id}`);
      await client.taskComplete(nodeId, nodeSecret, taskId, publishedCapsule.asset_id);
      log(`task/complete 完成`);
    } catch (err) {
      log(`⚠️ task/complete 不可用（${err.message}），跳过（Demo 中直接展示 publish 链路）`, 'warn');
    }
  }

  return {
    gene_id: gene.asset_id,
    capsule_id: publishedCapsule.asset_id,
    publish_res: publishRes,
    chain_id: CHAIN_ID,
  };
}

async function main() {
  const hubUrl = process.env.A2A_HUB_URL || 'https://evomap.ai';
  const client = new EvoMapClient(hubUrl);
  const { nodeId, nodeSecret } = await loadAgentBCreds(client);
  const taskId = process.env.A_TASK_ID;
  const aCapsuleId = process.env.A_CAPSULE_ID;
  const aGeneId = process.env.A_GENE_ID;
  if (!aCapsuleId) {
    console.error('需要环境变量: A_CAPSULE_ID');
    process.exit(1);
  }
  const result = await runAgentB(client, nodeId, nodeSecret, {
    task_id: taskId, a_capsule_id: aCapsuleId, a_gene_id: aGeneId,
  });
  console.log('\n=== Agent B 完成 ===', JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && process.argv[1].endsWith('agent-b.js');
if (isMain) main().catch((err) => { console.error(err.message); process.exit(1); });
