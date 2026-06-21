// src/lib/bounty-flow.js
// bounty 流程编排（基于方案 E v5 修正端点）
// 参考：方案E-BountyHive-修正版.md 第一节 + evomap-skill-docs/evomap-skill-tasks.md
//
// v5 修正后的 bounty 流程（必须严格按此顺序）：
//   1. 悬赏者发起：POST /a2a/ask
//   2. 求解者认领：POST /a2a/task/claim        (body: task_id, node_id)
//   3. 求解者发布方案：POST /a2a/publish        (GEP-A2A 信封)
//   4. 求解者完成任务：POST /a2a/task/complete  (body: task_id, asset_id, node_id)
//   5. 悬赏者选优胜：POST /a2a/task/accept-submission (body: task_id, submission_id)

import { computeAssetId, withAssetId } from './asset-id.js';

/**
 * 第 1 步：发起悬赏（方案 E 第一节"悬赏发布与发现"）
 * @param {import('./evomap-client.js').EvoMapClient} client
 * @param {string} nodeId - 悬赏者节点 ID
 * @param {string} nodeSecret
 * @param {string} title
 * @param {Array<string>} signals
 * @param {number} bounty - 积分数
 * @param {string} body - 详细描述
 * @returns {Promise<object>} { task_id, bounty_id, ... }
 */
export async function createBounty(client, nodeId, nodeSecret, title, signals, bounty, body) {
  const res = await client.ask(nodeId, nodeSecret, title, signals, bounty, body);
  if (!res || (!res.task_id && !res.bounty_id)) {
    throw new Error(
      `[bounty-flow] createBounty 未返回 task_id/bounty_id，响应: ${JSON.stringify(res)}`
    );
  }
  return res;
}

/**
 * 第 2-4 步：认领 + 发布方案 + 完成任务（方案 E 第一节 + skill-tasks.md Flow）
 *
 * @param {import('./evomap-client.js').EvoMapClient} client
 * @param {string} nodeId - 求解者节点 ID
 * @param {string} nodeSecret
 * @param {string} taskId
 * @param {object} geneTemplate - Gene 资产模板（不含 asset_id）
 * @param {object} capsuleTemplate - Capsule 资产模板（不含 asset_id，gene 字段会被自动填充）
 * @param {object} options
 * @param {string|null} options.chainId - 能力链 ID（继承自失败 Capsule）
 * @param {object|null} options.evolutionEventTemplate - 可选 EvolutionEvent 模板
 * @param {boolean} options.skipValidate - 是否跳过 /a2a/validate 预检（默认 false）
 * @returns {Promise<object>} { claim_res, publish_res, complete_res, gene_id, capsule_id }
 */
export async function claimAndSolve(
  client,
  nodeId,
  nodeSecret,
  taskId,
  geneTemplate,
  capsuleTemplate,
  options = {}
) {
  const { chainId = null, evolutionEventTemplate = null, skipValidate = false } = options;

  // ── 第 2 步：认领任务（skill-tasks.md Flow 第 3 步） ──
  const claimRes = await client.taskClaim(nodeId, nodeSecret, taskId);

  // ── 第 3 步：构造资产 + 计算 asset_id + 预检 + 发布（skill-tasks.md Flow 第 5 步） ──
  // 先算 Gene 的 asset_id
  const gene = { ...geneTemplate, type: 'Gene' };
  withAssetId(gene);

  // Capsule 的 gene 字段指向同 bundle 的 Gene asset_id
  const capsule = {
    ...capsuleTemplate,
    type: 'Capsule',
    gene: gene.asset_id,
  };
  withAssetId(capsule);

  const assets = [gene, capsule];

  // 可选 EvolutionEvent（提升 GDI 分）
  if (evolutionEventTemplate) {
    const event = {
      ...evolutionEventTemplate,
      type: 'EvolutionEvent',
      capsule_id: capsule.asset_id,
      genes_used: [gene.asset_id],
    };
    withAssetId(event);
    assets.push(event);
  }

  // 预检（推荐）：dry-run 校验 asset_id 哈希 + bundle 结构
  if (!skipValidate) {
    const validateRes = await client.validate(nodeId, nodeSecret, assets, chainId);
    if (validateRes && validateRes.valid === false) {
      throw new Error(
        `[bounty-flow] /a2a/validate 预检失败: ${JSON.stringify(validateRes)}\n` +
          `下一步建议: 检查 canonicalJSON 排序、asset_id 计算、必填字段是否齐全`
      );
    }
  }

  // 发布方案
  const publishRes = await client.publish(nodeId, nodeSecret, assets, chainId);

  // ── 第 4 步：完成任务（skill-tasks.md Flow 第 6 步，body: task_id, asset_id, node_id） ──
  const completeRes = await client.taskComplete(
    nodeId,
    nodeSecret,
    taskId,
    capsule.asset_id
  );

  return {
    claim_res: claimRes,
    publish_res: publishRes,
    complete_res: completeRes,
    gene_id: gene.asset_id,
    capsule_id: capsule.asset_id,
    assets,
  };
}

/**
 * 第 5 步：悬赏者选优胜答案（方案 E 第一节 + skill-tasks.md）
 *
 * 注意：方案 E 第七节将此端点列为"命门"——是否即时完成需现场实测。
 * 若失败，fallback 是直接展示 publish 链路 + 手动声明"Demo 中为加速展示"。
 *
 * @param {import('./evomap-client.js').EvoMapClient} client
 * @param {string} nodeId - 悬赏者节点 ID
 * @param {string} nodeSecret
 * @param {string} taskId
 * @param {string} submissionId - 求解者 complete 后产生的 submission_id
 * @returns {Promise<object>}
 */
export async function acceptWinner(client, nodeId, nodeSecret, taskId, submissionId) {
  const res = await client.taskAcceptSubmission(nodeId, nodeSecret, taskId, submissionId);
  return res;
}

/**
 * 预检 publish bundle；若因 Capsule 未知溯源字段失败，移除后重试并重新计算 asset_id
 * @param {import('./evomap-client.js').EvoMapClient} client
 * @param {string} nodeId
 * @param {string} nodeSecret
 * @param {Array<object>} assets
 * @param {string|null} chainId
 * @param {Function} log
 * @returns {Promise<Array<object>>} 可发布的 assets（可能是精简字段后的副本）
 */
export async function tryPublishWithFallback(client, nodeId, nodeSecret, assets, chainId, log) {
  log('调用 /a2a/validate 预检 bundle...');
  let validateRes = await client.validate(nodeId, nodeSecret, assets, chainId);

  if (!validateRes || validateRes.valid !== false) {
    log(`预检通过，computed_bundle_id=${validateRes?.computed_bundle_id || 'N/A'}`);
    return assets;
  }

  const errText = JSON.stringify(validateRes);
  const looksLikeUnknownField =
    /unknown|unrecognized|invalid field|not allowed|schema|source_type|reused_asset_id|parent/i.test(
      errText
    );

  // duplicate_asset：该资产已存在，跳过 validation 直接 publish（publish 端幂等）
  if (validateRes?.reason === 'duplicate_asset') {
    log(`检测到 duplicate_asset (${validateRes.target_asset_id})，跳过预检直接发布`);
    return assets;
  }

  if (!looksLikeUnknownField) {
    throw new Error(`[bounty-flow] /a2a/validate 预检失败: ${errText}`);
  }

  // 增量式降级：按 least-critical → most-critical 顺序逐个尝试移除，
  // 每次移除后重新计算 asset_id 并 re-validate，只剥离真正需要移除的字段。
  const CANDIDATE_FIELDS = ['parent', 'reused_asset_id', 'source_type'];

  // 从 errText 中提取实际触发错误的字段名（如果能识别出来）
  const mentionedFields = CANDIDATE_FIELDS.filter((f) => errText.includes(f));
  // 如果能精确识别，只按提及顺序尝试；否则按默认 least-critical 顺序
  const fieldsToTry = mentionedFields.length > 0 ? mentionedFields : CANDIDATE_FIELDS;

  const alreadyStripped = new Set();
  let currentAssets = assets;
  let lastErr = errText;

  for (const field of fieldsToTry) {
    const candidateAssets = currentAssets.map((asset) => {
      if (asset.type !== 'Capsule') return asset;
      if (!(field in asset)) return asset;
      const { [field]: _removed, asset_id: _oldId, ...rest } = asset;
      const stripped = { ...rest };
      withAssetId(stripped);
      return { stripped, _oldId };
    });

    // 检查是否真的有 Capsule 被修改（field 可能不在某些 Capsule 上）
    const hadField = candidateAssets.some(
      (c) => c.stripped && c._oldId !== undefined
    );
    if (!hadField) continue;

    // 构建 oldToNew 映射 + 重建 assets
    const oldToNewCapsuleId = new Map();
    const rebuiltAssets = candidateAssets.map((c) => {
      if (!c.stripped) return c;
      oldToNewCapsuleId.set(c._oldId, c.stripped.asset_id);
      return c.stripped;
    });

    // 更新 EvolutionEvent 对 capsule_id 的引用
    for (const asset of rebuiltAssets) {
      if (
        asset.type === 'EvolutionEvent' &&
        asset.capsule_id &&
        oldToNewCapsuleId.has(asset.capsule_id)
      ) {
        asset.capsule_id = oldToNewCapsuleId.get(asset.capsule_id);
        withAssetId(asset);
      }
    }

    log(`尝试移除 ${field} 后重新验证...`);
    const trialRes = await client.validate(nodeId, nodeSecret, rebuiltAssets, chainId);
    if (!trialRes || trialRes.valid !== false) {
      log(`移除 ${field} 后验证通过`);
      return rebuiltAssets;
    }

    // 未通过，记录错误并继续尝试下一个字段
    lastErr = JSON.stringify(trialRes);
    log(`移除 ${field} 后仍失败: ${lastErr}`);
    alreadyStripped.add(field);
    currentAssets = rebuiltAssets;
  }

  // 所有候选字段都试过了，用最后的 assets 再做一次最终验证
  validateRes = await client.validate(nodeId, nodeSecret, currentAssets, chainId);
  if (validateRes && validateRes.valid === false) {
    throw new Error(
      `[bounty-flow] 尝试移除 ${[...alreadyStripped].join(', ') || '无'} 后 /a2a/validate 仍失败: ${JSON.stringify(validateRes)}`
    );
  }

  log(`精简字段后预检通过（移除: ${[...alreadyStripped].join(', ')}），computed_bundle_id=${validateRes?.computed_bundle_id || 'N/A'}`);
  return currentAssets;
}

export default { createBounty, claimAndSolve, acceptWinner, tryPublishWithFallback };
