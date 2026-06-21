// src/lib/self-test.js
// asset_id 计算自测
// 用法: node src/lib/self-test.js
// 验证 canonicalJSON + computeAssetId 的确定性 + 格式正确性

import { canonicalJSON, computeAssetId, randomMessageId, withAssetId } from './asset-id.js';

function assert(cond, msg) {
  if (!cond) {
    console.error('❌ FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('✅ PASS:', msg);
  }
}

// ── 测试 1：canonicalJSON 对 key 顺序不敏感 ──
{
  const a = { b: 2, a: 1, c: { z: 26, a: 1 } };
  const b = { a: 1, b: 2, c: { a: 1, z: 26 } };
  assert(canonicalJSON(a) === canonicalJSON(b), 'canonicalJSON 对 key 顺序不敏感');
  assert(
    canonicalJSON(a) === '{"a":1,"b":2,"c":{"a":1,"z":26}}',
    'canonicalJSON 输出格式正确（key 排序）'
  );
}

// ── 测试 2：canonicalJSON 处理数组（保持顺序） ──
{
  const a = { signals: ['useEffect', 'dependency-missing', 'react-hooks'] };
  const expected = '{"signals":["useEffect","dependency-missing","react-hooks"]}';
  assert(canonicalJSON(a) === expected, 'canonicalJSON 数组保持原顺序');
}

// ── 测试 3：canonicalJSON 处理嵌套 + 混合类型 ──
{
  const a = { z: 1, a: [3, 2, 1], m: { b: true, a: null } };
  const expected = '{"a":[3,2,1],"m":{"a":null,"b":true},"z":1}';
  assert(canonicalJSON(a) === expected, 'canonicalJSON 嵌套 + 混合类型正确');
}

// ── 测试 4：computeAssetId 格式正确（sha256: + 64 hex） ──
{
  const gene = {
    type: 'Gene',
    schema_version: '1.5.0',
    category: 'repair',
    signals_match: ['TimeoutError', 'ECONNREFUSED'],
    summary: 'Retry with exponential backoff on timeout errors',
    validation: ['node tests/retry.test.js'],
  };
  const id = computeAssetId(gene);
  assert(/^sha256:[0-9a-f]{64}$/.test(id), `computeAssetId 格式正确: ${id}`);
}

// ── 测试 5：computeAssetId 对 key 顺序不敏感 ──
{
  const a = {
    type: 'Gene',
    schema_version: '1.5.0',
    category: 'repair',
    signals_match: ['TimeoutError'],
    summary: 'Retry with exponential backoff on timeout errors',
    validation: ['node tests/retry.test.js'],
  };
  const b = {
    validation: ['node tests/retry.test.js'],
    summary: 'Retry with exponential backoff on timeout errors',
    signals_match: ['TimeoutError'],
    category: 'repair',
    schema_version: '1.5.0',
    type: 'Gene',
  };
  assert(computeAssetId(a) === computeAssetId(b), 'computeAssetId 对 key 顺序不敏感');
}

// ── 测试 6：computeAssetId 剔除 asset_id 字段 ──
{
  const without = { type: 'Gene', summary: 'some summary here' };
  const withId = { type: 'Gene', summary: 'some summary here', asset_id: 'sha256:deadbeef' };
  assert(
    computeAssetId(without) === computeAssetId(withId),
    'computeAssetId 自动剔除 asset_id 字段'
  );
}

// ── 测试 7：computeAssetId 确定性（同输入同输出） ──
{
  const capsule = {
    type: 'Capsule',
    schema_version: '1.5.0',
    trigger: ['useEffect', 'dependency-missing'],
    gene: 'sha256:abc123',
    summary: 'Fix useEffect dependency missing with useCallback',
    content: 'Intent: fix useEffect dependency missing\n\nStrategy:\n1. Wrap callbacks with useCallback\n2. Add all callbacks to dependency array',
    confidence: 0.9,
    blast_radius: { files: 2, lines: 15 },
    outcome: { status: 'success', score: 0.9 },
    source_type: 'generated',
    env_fingerprint: { platform: 'linux', arch: 'x64' },
  };
  const id1 = computeAssetId(capsule);
  const id2 = computeAssetId(capsule);
  assert(id1 === id2, `computeAssetId 确定性: ${id1}`);
}

// ── 测试 8：withAssetId 原地填充 ──
{
  const asset = { type: 'Gene', summary: 'some summary here' };
  withAssetId(asset);
  assert(asset.asset_id && asset.asset_id.startsWith('sha256:'), 'withAssetId 原地填充 asset_id');
  assert(
    computeAssetId(asset) === asset.asset_id,
    'withAssetId 填充的 asset_id 与重算一致'
  );
}

// ── 测试 9：randomMessageId 格式 ──
{
  const id = randomMessageId();
  assert(/^msg_\d+_[0-9a-f]{8}$/.test(id), `randomMessageId 格式正确: ${id}`);
}

// ── 测试 10：canonicalJSON 跳过 undefined 字段 ──
{
  const withUndefined = { a: 1, b: undefined, c: 'hello' };
  const withoutUndefined = { a: 1, c: 'hello' };
  assert(
    canonicalJSON(withUndefined) === canonicalJSON(withoutUndefined),
    'canonicalJSON 对 undefined 字段与 omit 等效'
  );
  const assetWith = { type: 'Gene', summary: 'x', extra: undefined };
  const assetWithout = { type: 'Gene', summary: 'x' };
  assert(
    computeAssetId(assetWith) === computeAssetId(assetWithout),
    '含 undefined 字段的资产 ID 与不含该字段相同'
  );
}

// ── 测试 11：方案 E Demo 数据稳定性 ──
// 用 Agent A 的 failed Capsule 模板验证（与 agent-templates.js 一致）
{
  const failedCapsule = {
    type: 'Capsule',
    schema_version: '1.5.0',
    trigger: ['useEffect', 'dependency-missing'],
    gene: 'sha256:placeholder_gene_a',
    summary: 'Failed to fix useEffect dependency missing',
    content:
      '失败原因：遗漏了 useCallback 包装的回调函数。lesson：useCallback 的回调也必须加入依赖数组。尝试过的策略：仅添加 state 变量到依赖数组。',
    confidence: 0.6,
    blast_radius: { files: 1, lines: 8 },
    outcome: { status: 'failed', score: 0.4 },
    source_type: 'generated',
    env_fingerprint: { platform: 'linux', arch: 'x64' },
  };
  const id = computeAssetId(failedCapsule);
  assert(/^sha256:[0-9a-f]{64}$/.test(id), `Agent A failed Capsule asset_id 计算成功: ${id}`);

  // 重新计算应得到相同结果（确定性）
  const id2 = computeAssetId(failedCapsule);
  assert(id === id2, 'Agent A failed Capsule asset_id 确定性');
}

console.log('\n自我测试完成。');
