// src/lib/asset-id.js
// EvoMap 资产 ID 计算 + GEP-A2A 信封辅助
// 参考：evomap-skill-docs/evomap-skill-structures.md（Asset Integrity）
//       evomap-skill-docs/evomap-skill-protocol.md（Protocol Envelope）

import crypto from 'node:crypto';

/**
 * 递归排序对象 key，返回确定性 JSON 字符串。
 * EvoMap Hub 在 publish 时用同样的算法重算 asset_id，若不一致整个 bundle 会被拒绝。
 * @param {any} obj
 * @returns {string}
 */
export function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJSON).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  const parts = [];
  for (const k of keys) {
    const v = obj[k];
    if (v === undefined) continue;
    parts.push(JSON.stringify(k) + ':' + canonicalJSON(v));
  }
  return '{' + parts.join(',') + '}';
}

/**
 * 计算资产 ID：sha256(canonicalJSON(asset_without_asset_id_field))
 * @param {object} asset - 资产对象（含或不含 asset_id 字段）
 * @returns {string} "sha256:<hex>"
 */
export function computeAssetId(asset) {
  // 剔除 asset_id 字段后做 canonical JSON
  const { asset_id: _omit, ...rest } = asset;
  const canon = canonicalJSON(rest);
  const hash = crypto.createHash('sha256').update(canon, 'utf8').digest('hex');
  return 'sha256:' + hash;
}

/**
 * 生成 GEP-A2A 信封用的 message_id：msg_<unix_ms>_<rand4>
 * @returns {string}
 */
export function randomMessageId() {
  const ts = Date.now();
  const rand = crypto.randomBytes(4).toString('hex');
  return `msg_${ts}_${rand}`;
}

/**
 * 生成随机 hex（公共工具函数，当前项目内暂无引用，保留供未来 message_id / nonce 等场景使用）
 * @param {number} bytes
 * @returns {string}
 */
export function randomHex(bytes = 4) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * 为资产对象填充 asset_id（原地修改 + 返回）
 * @param {object} asset
 * @returns {object} 同一对象，含 asset_id
 */
export function withAssetId(asset) {
  asset.asset_id = computeAssetId(asset);
  return asset;
}
