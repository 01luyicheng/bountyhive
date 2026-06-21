// src/demo/agent-a.js
// Agent A：悬赏者 + 真实失败经验沉淀者
//
// 动作：
//   1. hello（用 A_NODE_ID/A_NODE_SECRET）
//   2. POST /a2a/ask 发起悬赏
//   3. 调用小模型真正尝试修复 HumanEval intersperse → 验证 → 失败
//   4. 发布真实失败 Capsule 到 EvoMap

import 'dotenv/config';
import EvoMapClient from '../lib/evomap-client.js';
import { computeAssetId, withAssetId } from '../lib/asset-id.js';
import { tryPublishWithFallback } from '../lib/bounty-flow.js';
const _STORY_MODE_A = process.env.STORY_MODE === '1';
import { attemptCodeFix } from '../lib/llm-client.js';
import {
  makeAgentAGeneTemplate,
  makeAgentACapsuleTemplate,
  CHAIN_ID,
  RUN_ID,
  RUN_TS,
  makeEvolutionEventTemplate,
} from './agent-templates.js';
import { PROBLEM_A } from './humaneval-problems.js';
import { loadAgentCreds } from './agent-creds.js';

const BOUNTY_AMOUNT = 50;
const PROBLEM = PROBLEM_A;
const BOUNTY_TITLE = `${PROBLEM.title} [run_${RUN_ID.slice(0, 8)}]`;
const BOUNTY_SIGNALS = [...PROBLEM.signals, `run_${RUN_ID.slice(0, 8)}`];
const BOUNTY_BODY = PROBLEM.description;

const SMALL_MODEL = 'liquid/lfm-2.5-1.2b-instruct:free';

function defaultLog(msg, level = 'info') {
  if (_STORY_MODE_A && level === 'warn') level = 'info';
  const ts = new Date().toISOString();
  console.log(`[${ts}] [Agent A] ${msg}`);
}

export async function loadAgentACreds(client, log = defaultLog) {
  return loadAgentCreds(client, 'A', 'BountyHive Agent A', log);
}

/**
 * Agent A 完整动作：真实调用小模型 → 真实失败 → 发布到 EvoMap
 */
export async function runAgentA(client, nodeId, nodeSecret, log = defaultLog) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  // ── 发起悬赏 ──
  log(`发起悬赏: "${BOUNTY_TITLE}" (${BOUNTY_AMOUNT} 积分)`);
  let questionId = null;
  let askRes = null;
  try {
    askRes = await client.ask(nodeId, nodeSecret, BOUNTY_TITLE, BOUNTY_SIGNALS, BOUNTY_AMOUNT, BOUNTY_BODY);
    if (askRes.question_status === 'deduped') {
      log(`检测到重复悬赏 (${askRes.reason}), 使用现有 bounty_id=${askRes.bounty_id}`);
    }
    questionId = askRes.question_id || askRes.task_id || askRes.taskId || askRes.bounty_id || null;
    log(`悬赏已创建: ${questionId ? `question_id=${questionId}` : `bounty_id=${askRes.bounty_id}`}`);
  } catch (err) {
    log(`发起悬赏失败: ${err.message}，跳过 bounty 流程`);
  }

  // ── 真实调用小模型尝试修复 ──
  let llmOutput = '';
  let fixCode = '';
  let validationPassed = false;
  let validationReason = '';

  try {
    const result = await attemptCodeFix(PROBLEM, apiKey, SMALL_MODEL, log);
    llmOutput = result.output;
    fixCode = result.fixCode;

    // 验证修复是否包含空列表守卫
    if (fixCode && PROBLEM.guardCheck(fixCode)) {
      validationPassed = true;
      validationReason = '修复正确：包含空集合守卫';
    } else if (fixCode) {
      validationPassed = false;
      validationReason = '修复缺少空集合守卫 — 空输入时仍会触发错误';
    } else {
      validationPassed = false;
      validationReason = PROBLEM.validation;
    }

    log(`模型输出:\n${llmOutput.slice(0, 500)}`);
    log(`验证结果: ${validationPassed ? '✅ 通过' : '❌ 失败'} — ${validationReason}`);
  } catch (err) {
    log(`LLM 调用失败 (${err.message})，使用预写失败结果`);
    llmOutput = `[LLM 调用失败: ${err.message}]`;
    fixCode = '';
    validationPassed = false;
    validationReason = `LLM 不可用: ${err.message}`;
  }

  // ── 构造真实失败 Capsule ──
  log(`发布真实失败 Capsule (run_id=${RUN_ID.slice(0, 8)}, problem=${PROBLEM.id})...`);

  const gene = makeAgentAGeneTemplate(PROBLEM);
  withAssetId(gene);

  const realContent = validationPassed
    ? `Agent A (${SMALL_MODEL}) 的修复通过了验证。但这不应该发生 — 说明验证不够严格。原始输出:\n${llmOutput.slice(0, 1500)}`
    : `Agent A 调用 ${SMALL_MODEL} 尝试修复 ${PROBLEM.title} bug。模型输出:\n${llmOutput.slice(0, 1500)}\n\n验证失败原因: ${validationReason}\n\n教训: ${PROBLEM.description}`;

  const capsuleTemplate = makeAgentACapsuleTemplate(PROBLEM);
  const capsule = {
    ...capsuleTemplate,
    content: realContent.slice(0, 8000),
    gene: gene.asset_id,
    confidence: validationPassed ? 0.3 : 0.7,
    blast_radius: { files: 1, lines: 8 },
    outcome: { status: validationPassed ? 'success' : 'failed', score: validationPassed ? 0.3 : 0.4 },
  };
  withAssetId(capsule);

  const event = makeEvolutionEventTemplate(
    'repair',
    { status: validationPassed ? 'success' : 'failed', score: validationPassed ? 0.3 : 0.4 },
    1, 1
  );
  event.type = 'EvolutionEvent';
  event.capsule_id = capsule.asset_id;
  event.genes_used = [gene.asset_id];
  withAssetId(event);

  const assets = [gene, capsule, event];

  // validate + publish
  const publishAssets = await tryPublishWithFallback(client, nodeId, nodeSecret, assets, CHAIN_ID, log);
  const publishRes = await client.publish(nodeId, nodeSecret, publishAssets, CHAIN_ID);
  const publishedCapsule = publishAssets.find((a) => a.type === 'Capsule');
  log(`failed Capsule 已发布: capsule_id=${publishedCapsule.asset_id}`);

  return {
    question_id: questionId,
    task_id: questionId,
    gene_id: gene.asset_id,
    capsule_id: publishedCapsule.asset_id,
    llm_model: SMALL_MODEL,
    llm_output_preview: llmOutput.slice(0, 200),
    validation_passed: validationPassed,
    validation_reason: validationReason,
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

const isMain = process.argv[1] && process.argv[1].endsWith('agent-a.js');
if (isMain) {
  main().catch((err) => {
    console.error('[Agent A] 致命错误:', err.message);
    process.exit(1);
  });
}
