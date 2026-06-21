// src/server.js
// Express HTTP API 供前端调用
// 端口与 CORS origin 可通过环境变量配置
//
// 端点：
//   GET  /api/agents                  -- A/B/C 三节点状态
//   GET  /api/bounties                -- 悬赏市场列表
//   GET  /api/capsules?outcome=failed -- Capsule 列表（支持 outcome 过滤）
//   GET  /api/chain/:chainId          -- 能力链资产列表
//   GET  /api/earnings/:agentId       -- 积分流水
//   POST /api/demo/start              -- 触发 orchestrator，返回 run_id
//   GET  /api/demo/status             -- 当前 Demo 进度
//   GET  /api/demo/logs               -- SSE 流，实时推送 Demo 日志

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import EvoMapClient from './lib/evomap-client.js';
import { runOrchestrator } from './demo/orchestrator.js';
import { runMockOrchestrator } from './demo/mock-orchestrator.js';
import { CHAIN_ID } from './demo/agent-templates.js';
import {
  getMockAgents,
  getMockBounties,
  getMockCapsules,
  getMockChain,
  getMockEarnings,
} from './lib/mock-data.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const HUB_URL = process.env.A2A_HUB_URL || 'https://evomap.ai';
const CORS_ORIGINS = [FRONTEND_ORIGIN, FRONTEND_ORIGIN.replace('localhost', '127.0.0.1')];

// ── Mock 模式自动检测 ──
function resolveMockMode() {
  const envVal = process.env.MOCK_MODE;
  if (envVal === 'true') return { mode: true, reason: 'MOCK_MODE=true (explicit)' };
  if (envVal === 'false') {
    const missing = [];
    for (const [label, key] of [['A', 'A_NODE_ID'], ['A', 'A_NODE_SECRET'], ['B', 'B_NODE_ID'], ['B', 'B_NODE_SECRET'], ['C', 'C_NODE_ID'], ['C', 'C_NODE_SECRET']]) {
      if (!process.env[key]) missing.push(key);
    }
    if (missing.length > 0) {
      throw new Error(`MOCK_MODE=false but credentials missing: ${missing.join(', ')}\nSet these in .env or remove MOCK_MODE to auto-detect.`);
    }
    return { mode: false, reason: 'MOCK_MODE=false (explicit, credentials verified)' };
  }
  // MOCK_MODE not set → auto-detect
  const hasA = process.env.A_NODE_ID && process.env.A_NODE_SECRET;
  const hasB = process.env.B_NODE_ID && process.env.B_NODE_SECRET;
  const hasC = process.env.C_NODE_ID && process.env.C_NODE_SECRET;
  if (hasA || hasB || hasC) {
    return { mode: false, reason: 'auto-detected: credentials found' };
  }
  console.log('[BountyHive] ⚠️  MOCK_MODE 未设置且无凭证，自动切换到 mock 模式');
  console.log('[BountyHive]    提示: 在 .env 中配置 A_NODE_ID/A_NODE_SECRET 即可使用真实模式');
  return { mode: true, reason: 'auto-detected: no credentials configured' };
}

const mockResult = resolveMockMode();
const MOCK_MODE = mockResult.mode;

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── 内存状态 ──
const demoRuns = new Map(); // run_id -> { run_id, status, phase, completed_steps, started_at, completed_at, logs, result, error }
const demoRunOrder = []; // 按启动时间维护 run_id 顺序
const sseClients = new Set(); // Set<res>
let currentRunId = null;
let lastCompletedRunId = null;
let demoLock = false;

function ts() {
  return new Date().toISOString();
}

function newRunId() {
  return `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function newRequestId() {
  return crypto.randomUUID();
}

/**
 * 返回通用内部错误响应，并在服务端记录详细错误（不暴露敏感信息）
 */
function sendInternalError(res, req, err) {
  const requestId = newRequestId();
  console.error(`[${ts()}] [request error] ${req.method} ${req.path} status=500 request_id=${requestId}`, err);
  res.status(500).json({ error: 'internal server error' });
}

/**
 * 开发环境下在服务端打印 Hub 原始响应，用于调试
 */
function debugRaw(label, data) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${ts()}] [debug raw] ${label}:`, JSON.stringify(data).slice(0, 2000));
  }
}

function getSseOrigin(req) {
  const origin = req.headers.origin;
  if (CORS_ORIGINS.includes(origin)) return origin;
  return '';
}

/**
 * 清理指定 run_id 的内存记录，并同步 currentRunId / lastCompletedRunId。
 * 调用方需自行管理 demoLock。
 */
function cleanupRun(runId) {
  if (!runId) return;
  demoRuns.delete(runId);
  const idx = demoRunOrder.indexOf(runId);
  if (idx >= 0) demoRunOrder.splice(idx, 1);
  if (currentRunId === runId) currentRunId = null;
  if (lastCompletedRunId === runId) lastCompletedRunId = null;
}

/**
 * 推送 SSE 事件给所有客户端
 * @param {string} event
 * @param {object} data
 */
function broadcastSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload);
    } catch {
      sseClients.delete(res);
      try {
        res.end();
      } catch {
        // 已断开，忽略
      }
    }
  }
}

/**
 * 按白名单提取字段
 * @param {object} obj
 * @param {string[]} keys
 * @returns {object}
 */
function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  for (const key of keys) {
    if (key in obj) out[key] = obj[key];
  }
  return out;
}

// API 响应字段白名单（不直接暴露 EvoMap Hub 原始响应）
const AGENT_WHITELIST = ['label', 'node_id', 'online', 'reputation', 'model'];
const BOUNTY_WHITELIST = ['task_id', 'title', 'signals', 'bounty', 'status', 'created_at'];
const CAPSULE_WHITELIST = [
  'asset_id',
  'summary',
  'outcome',
  'confidence',
  'chain_id',
  'source_type',
  'reused_asset_id',
  'parent',
  'type',
];
const EARNING_ENTRY_WHITELIST = ['amount', 'reason', 'timestamp', 'from_node', 'task_id'];

/**
 * 获取 A/B/C 三组凭证
 */
function getAgentCreds() {
  return {
    a: { nodeId: process.env.A_NODE_ID, nodeSecret: process.env.A_NODE_SECRET },
    b: { nodeId: process.env.B_NODE_ID, nodeSecret: process.env.B_NODE_SECRET },
    c: { nodeId: process.env.C_NODE_ID, nodeSecret: process.env.C_NODE_SECRET },
  };
}

function getClient() {
  return new EvoMapClient(HUB_URL);
}

// ────────────────────────────────────────────────────────────
// API 端点
// ────────────────────────────────────────────────────────────

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: ts(), hub_url: HUB_URL, mock_mode: MOCK_MODE });
});

// A/B/C 三节点状态
app.get('/api/agents', async (req, res) => {
  // Mock 模式：直接返回本地 mock 数据
  if (MOCK_MODE) {
    return res.json({ agents: getMockAgents().map((a) => pick(a, AGENT_WHITELIST)), mock_mode: true });
  }
  try {
    const creds = getAgentCreds();
    const client = getClient();
    const labels = ['a', 'b', 'c'];
    const results = await Promise.all(
      labels.map(async (label) => {
        const c = creds[label];
        if (!c.nodeId || !c.nodeSecret) {
          return {
            label: label.toUpperCase(),
            node_id: null,
            online: false,
            reputation: null,
            error: 'credentials not configured',
          };
        }
        try {
          const node = await client.getNode(c.nodeId, c.nodeSecret, c.nodeId);
          debugRaw(`agent ${label}`, node);
          return {
            label: label.toUpperCase(),
            node_id: c.nodeId,
            online: true,
            reputation: node?.reputation ?? node?.reputation_score ?? null,
            model: node?.model ?? null,
          };
        } catch (err) {
          console.error(`[${ts()}] [agents] ${label} fetch failed:`, err.message);
          return {
            label: label.toUpperCase(),
            node_id: c.nodeId,
            online: false,
            reputation: null,
            error: 'agent fetch failed',
          };
        }
      })
    );
    res.json({ agents: results });
  } catch (err) {
    sendInternalError(res, req, err);
  }
});

// 悬赏市场列表
app.get('/api/bounties', async (req, res) => {
  // Mock 模式：返回本地 mock 悬赏
  if (MOCK_MODE) {
    return res.json({ bounties: getMockBounties().map((b) => pick(b, BOUNTY_WHITELIST)), mock_mode: true });
  }
  try {
    const creds = getAgentCreds();
    // 用任一可用节点查询（公开端点，但需要鉴权）
    const c = creds.a.nodeSecret ? creds.a : creds.b.nodeSecret ? creds.b : creds.c;
    if (!c.nodeId || !c.nodeSecret) {
      return res.json({
        bounties: [],
        error: 'no agent credentials configured',
        hint: '请在 .env 中配置 A_NODE_ID/A_NODE_SECRET 等',
      });
    }
    const client = getClient();
    const list = await client.taskList(c.nodeId, c.nodeSecret, {
      limit: parseInt(req.query.limit || '20', 10),
    });
    debugRaw('bounties', list);
    const items = list?.tasks || list?.items || [];
    res.json({ bounties: items.map((b) => pick(b, BOUNTY_WHITELIST)) });
  } catch (err) {
    sendInternalError(res, req, err);
  }
});

// Capsule 列表（支持 outcome 过滤）
app.get('/api/capsules', async (req, res) => {
  const outcome = req.query.outcome; // failed | success | undefined
  // Mock 模式：返回本地 mock Capsule
  if (MOCK_MODE) {
    const items = getMockCapsules(outcome);
    return res.json({
      capsules: items,
      outcome: outcome || null,
      source: 'mock',
      mock_mode: true,
    });
  }
  try {
    const creds = getAgentCreds();
    const c = creds.a.nodeSecret ? creds.a : creds.b.nodeSecret ? creds.b : creds.c;
    if (!c.nodeId || !c.nodeSecret) {
      return res.json({
        capsules: [],
        error: 'no agent credentials configured',
      });
    }
    const client = getClient();
    const query = req.query.q || 'useEffect dependency';

    if (outcome) {
      // 用 semantic-search 按 outcome 过滤
      const sr = await client.semanticSearch(c.nodeId, c.nodeSecret, query, {
        outcome,
        limit: parseInt(req.query.limit || '20', 10),
        include_context: true,
      });
      debugRaw('capsules semantic-search', sr);
      const items = sr?.results || sr?.assets || sr?.items || [];
      return res.json({
        capsules: items.map((item) => pick(item, CAPSULE_WHITELIST)),
        outcome,
        source: 'semantic-search',
      });
    }

    // 无 outcome 过滤，用 fetch 获取 promoted Capsule
    const fr = await client.fetch(c.nodeId, c.nodeSecret, { asset_type: 'Capsule' });
    debugRaw('capsules fetch', fr);
    const items = fr?.assets || fr?.items || [];
    res.json({ capsules: items.map((item) => pick(item, CAPSULE_WHITELIST)), source: 'fetch' });
  } catch (err) {
    sendInternalError(res, req, err);
  }
});

// 能力链资产列表
app.get('/api/chain/:chainId', async (req, res) => {
  const chainId = req.params.chainId || CHAIN_ID;
  // Mock 模式：返回本地 mock 能力链
  if (MOCK_MODE) {
    const chainResult = getMockChain(chainId);
    return res.json({
      chain_id: chainResult.chain_id,
      assets: chainResult.assets.map((item) => pick(item, CAPSULE_WHITELIST)),
      mock_mode: true,
    });
  }
  try {
    const creds = getAgentCreds();
    const c = creds.a.nodeSecret ? creds.a : creds.b.nodeSecret ? creds.b : creds.c;
    if (!c.nodeId || !c.nodeSecret) {
      return res.json({ assets: [], error: 'no agent credentials configured' });
    }
    const client = getClient();
    const cr = await client.getChain(c.nodeId, c.nodeSecret, chainId);
    debugRaw('chain', cr);
    const items = cr?.assets || cr?.items || [];
    const fallback = cr?._fallback || false;
    res.json({
      chain_id: chainId,
      assets: items.map((item) => pick(item, CAPSULE_WHITELIST)),
      count: cr?.count ?? items.length,
      source: fallback ? 'built-from-relationships' : 'chain-endpoint',
    });
  } catch (err) {
    sendInternalError(res, req, err);
  }
});

// 积分流水
app.get('/api/earnings/:agentId', async (req, res) => {
  const agentId = req.params.agentId;
  // Mock 模式：返回本地 mock 积分流水
  if (MOCK_MODE) {
    const items = getMockEarnings(agentId);
    return res.json({
      agent_id: agentId,
      earnings: items.map((item) => pick(item, EARNING_ENTRY_WHITELIST)),
      total: items.reduce((s, item) => s + (item.amount || 0), 0),
      mock_mode: true,
    });
  }
  try {
    const creds = getAgentCreds();
    let secret = null;
    if (agentId === creds.a.nodeId) secret = creds.a.nodeSecret;
    else if (agentId === creds.b.nodeId) secret = creds.b.nodeSecret;
    else if (agentId === creds.c.nodeId) secret = creds.c.nodeSecret;

    if (!secret) {
      return res.status(400).json({ error: 'invalid agent_id' });
    }
    const client = getClient();
    const er = await client.getEarnings(agentId, secret, agentId);
    debugRaw('earnings', er);
    const items = er?.entries || er?.items || [];
    const creditBalance = er?.credit_balance ?? null;
    const response = {
      agent_id: agentId,
      earnings: items.map((item) => pick(item, EARNING_ENTRY_WHITELIST)),
      total: items.reduce((s, item) => s + (item.amount || 0), 0),
    };
    if (er.error === 'earnings_requires_user_session') {
      response.earnings_endpoint_note = 'billing/earnings requires web session; shown credit_balance from heartbeat';
      response.credit_balance = creditBalance;
      response.source = 'heartbeat-balance';
    }
    res.json(response);
  } catch (err) {
    sendInternalError(res, req, err);
  }
});

// 触发 Demo orchestrator（异步执行）
app.post('/api/demo/start', async (req, res) => {
  const existing = currentRunId ? demoRuns.get(currentRunId) : null;
  if (demoLock || (existing && existing.status === 'running')) {
    return res.status(409).json({
      error: 'demo already running',
      run_id: currentRunId,
      phase: existing?.phase,
    });
  }
  demoLock = true;
  try {
    // 若当前 run 已结束，先清理旧记录，避免状态残留
    if (currentRunId && existing && existing.status !== 'running') {
      cleanupRun(currentRunId);
    }

    // 限制 demoRuns 内存占用：超过 20 条时删除最旧记录
    while (demoRunOrder.length > 20) {
      const oldestRunId = demoRunOrder.shift();
      if (oldestRunId) cleanupRun(oldestRunId);
    }

    const runId = newRunId();
    currentRunId = runId;
    demoRunOrder.push(runId);
    const run = {
      run_id: runId,
      status: 'running',
      phase: 'init',
      completed_steps: [],
      started_at: ts(),
      completed_at: null,
      logs: [],
      result: null,
      error: null,
    };
    demoRuns.set(runId, run);
    res.json({ run_id: runId, status: 'running', started_at: run.started_at });

    // 异步执行 orchestrator（Mock 模式用 mock-orchestrator，否则用真实 orchestrator）
    const logSink = run.logs;
    const orchestratorFn = MOCK_MODE ? runMockOrchestrator : runOrchestrator;
    setImmediate(async () => {
      try {
        broadcastSSE('phase', { run_id: runId, phase: 'init' });
        const result = await orchestratorFn({
          logSink,
          onPhase: (phase) => {
            run.phase = phase;
            broadcastSSE('phase', { run_id: runId, phase });
          },
          onLog: (log) => broadcastSSE('log', { run_id: runId, ...log }),
        });
        run.result = result;
        run.status = 'completed';
        run.completed_at = ts();
        run.completed_steps = result.completed_steps;
        broadcastSSE('done', { run_id: runId, status: 'completed', result });
      } catch (err) {
        run.status = 'failed';
        run.error = { phase: run.phase, message: err.message };
        run.completed_at = ts();
        broadcastSSE('error', { run_id: runId, error: run.error });

        // Real-mode error hints (don't crash the server)
        if (!MOCK_MODE) {
          const msg = err.message || '';
          if (/EHTTP (4\d\d)/.test(msg) || /401|403/.test(msg)) {
            console.error(`[BountyHive] ⚠️  Agent API 返回认证错误，请检查 .env 中的凭证配置`);
            console.error(`[BountyHive]    提示: 运行 demo 一次，agent-hello 会注册新节点并打印 claim_url`);
          } else if (/network|ENOTFOUND|ECONNREFUSED|fetch failed/i.test(msg)) {
            console.error(`[BountyHive] ⚠️  Hub 不可达 (${HUB_URL})，请检查网络连接`);
            console.error(`[BountyHive]    提示: 可设置 MOCK_MODE=true 切换到 mock 模式`);
          }
        }
      } finally {
        // 运行完成后保留 currentRunId，让前端仍能查询到本次 Demo 结果
        // 只有用户主动 reset 或启动新的 Demo 时才会清空
        lastCompletedRunId = runId;
      }
    });
  } finally {
    demoLock = false;
  }
});

// Demo 进度查询
app.get('/api/demo/status', (req, res) => {
  const runId = req.query.run_id || currentRunId;
  if (!runId || !demoRuns.has(runId)) {
    return res.json({
      status: 'idle',
      message: 'no demo running',
      current_run_id: currentRunId,
    });
  }
  const run = demoRuns.get(runId);
  const result = run.result;
  res.json({
    run_id: run.run_id,
    status: run.status,
    phase: run.phase,
    completed_steps: run.completed_steps,
    step_timings: result?.stepTimings || [],
    total_duration_ms: result?.total_duration_ms || null,
    simulated_savings: result?.simulated_savings || null,
    started_at: run.started_at,
    completed_at: run.completed_at,
    error: run.error,
    log_count: run.logs.length,
  });
});

// 重置 Demo 状态（前端停止/重置按钮调用）
app.post('/api/demo/reset', (req, res) => {
  if (demoLock) {
    return res.status(429).json({ error: 'demo start in progress' });
  }
  demoLock = true;
  try {
    // 清理当前运行上下文及最近运行记录
    if (currentRunId) cleanupRun(currentRunId);
    if (lastCompletedRunId) cleanupRun(lastCompletedRunId);
    currentRunId = null;
    lastCompletedRunId = null;
    demoRunOrder.length = 0;
    res.json({ ok: true });
  } finally {
    demoLock = false;
  }
});

// SSE 流：实时推送 Demo 日志
app.get('/api/demo/logs', (req, res) => {
  const origin = getSseOrigin(req);
  const headers = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  res.writeHead(200, headers);
  res.write('event: connected\ndata: {"ok":true}\n\n');
  sseClients.add(res);

  // 推送历史日志：按启动顺序合并所有 run 的日志，限制最近 300 条
  // 这样即使 Demo 已结束、currentRunId 被保留，重连仍能拿到完整日志
  const historicalLogs = [];
  for (const runId of demoRunOrder) {
    const run = demoRuns.get(runId);
    if (!run) continue;
    for (const log of run.logs) {
      historicalLogs.push({ run_id: runId, ...log });
    }
  }
  historicalLogs.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const recentLogs = historicalLogs.slice(-300);
  for (const log of recentLogs) {
    res.write(`event: log\ndata: ${JSON.stringify(log)}\n\n`);
  }

  // 新日志通过 /api/demo/start 传入的 onLog 回调，调用 broadcastSSE 一次性广播
  req.on('close', () => {
    sseClients.delete(res);
  });
});

// ────────────────────────────────────────────────────────────
// 启动
// ────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[BountyHive] Express API 服务已启动: http://localhost:${PORT}`);
  console.log(`[BountyHive] EvoMap Hub: ${HUB_URL}`);
  console.log(`[BountyHive] CORS 允许: ${FRONTEND_ORIGIN}`);
  if (MOCK_MODE) {
    console.log(`[BountyHive] 模式: MOCK (${mockResult.reason})`);
    console.log(`[BountyHive]   → 不调用 EvoMap Hub，使用本地 mock 数据`);
  } else {
    console.log(`[BountyHive] 模式: REAL (${mockResult.reason})`);
    console.log(`[BountyHive]   → 调用真实 EvoMap API`);
  }
  console.log(`[BountyHive] 端点:`);
  console.log(`  GET  /api/health`);
  console.log(`  GET  /api/agents`);
  console.log(`  GET  /api/bounties`);
  console.log(`  GET  /api/capsules?outcome=failed`);
  console.log(`  GET  /api/chain/:chainId`);
  console.log(`  GET  /api/earnings/:agentId`);
  console.log(`  POST /api/demo/start`);
  console.log(`  GET  /api/demo/status`);
  console.log(`  POST /api/demo/reset`);
  console.log(`  GET  /api/demo/logs (SSE)`);
});

export { app };
