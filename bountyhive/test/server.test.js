// test/server.test.js
// Server 集成测试 - 验证 Express 端点响应格式 + 数据正确性
//
// 使用 Node.js 内置 node:test 框架，不引入新依赖
// 测试策略:
//   - 启动真实 server（MOCK_MODE=true，不依赖真实 EvoMap 账号）
//   - 用 fetch 调用各端点，验证响应格式 + 数据内容
//   - 依赖 mock-orchestrator.js 和 mock-data.js（由另一个 subagent 创建）
//   - 若 mock 模块未就绪，测试会失败 —— 这是预期的
//
// 运行: node --test test/server.test.js
// 或:   npm test

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// 测试端口：从 3099 开始找一个空闲端口，避免与开发端口（3001/5173）冲突
const TEST_PORT_BASE = 3099;
const TEST_PORT_END = 3199;
const BASE_URL = 'http://localhost';

let testPort = TEST_PORT_BASE;
let serverProc = null;

function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port);
  });
}

async function findFreePort() {
  for (let p = TEST_PORT_BASE; p <= TEST_PORT_END; p++) {
    if (await isPortFree(p)) return p;
  }
  throw new Error('未找到空闲端口（范围 ' + TEST_PORT_BASE + '-' + TEST_PORT_END + '）');
}

function httpRequest(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL + ':' + testPort);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {},
    };
    const bodyStr = body ? JSON.stringify(body) : null;
    if (bodyStr) {
      opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }
    const req = http.request(opts, (res) => {
      let chunks = '';
      res.on('data', (c) => (chunks += c));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(chunks);
        } catch (e) {
          // 非 JSON 响应
        }
        resolve({ status: res.statusCode, body: chunks, json });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function waitForServer(port, timeoutMs) {
  const timeout = timeoutMs || 15000;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function tryConnect() {
      const req = http.get('http://localhost:' + port + '/api/health', (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else if (Date.now() - start > timeout) {
          reject(new Error('server 启动超时（HTTP ' + res.statusCode + '）'));
        } else {
          setTimeout(tryConnect, 300);
        }
      });
      req.on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error('server 启动超时（连接失败）'));
        } else {
          setTimeout(tryConnect, 300);
        }
      });
    }
    tryConnect();
  });
}

function killServer(proc) {
  if (!proc || !proc.pid) return;
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /pid ' + proc.pid + ' /T /F', { stdio: 'ignore' });
    } else {
      try {
        process.kill(proc.pid, 'SIGTERM');
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        try {
          process.kill(proc.pid, 'SIGKILL');
        } catch (e) {
          // already dead
        }
      }, 1000);
    }
  } catch (e) {
    // ignore
  }
}

describe('Server 集成测试 - Mock 模式端点验证', () => {
  before(async () => {
    // 找一个空闲端口（从 3099 开始）
    testPort = await findFreePort();
    console.log('[test] 使用端口 ' + testPort + '（MOCK_MODE=true）');

    // 启动 server 子进程
    serverProc = spawn('node', ['src/server.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        MOCK_MODE: 'true', // 便于测试，不依赖真实账号
        PORT: String(testPort),
        A2A_HUB_URL: 'https://evomap.ai',
        // 清空凭证，确保测试不依赖真实账号
        A_NODE_ID: '',
        A_NODE_SECRET: '',
        B_NODE_ID: '',
        B_NODE_SECRET: '',
        C_NODE_ID: '',
        C_NODE_SECRET: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 转发 server 日志到 stderr（不干扰 test 输出）
    serverProc.stdout.on('data', (d) => {
      process.stderr.write('[server:out] ' + d);
    });
    serverProc.stderr.on('data', (d) => {
      process.stderr.write('[server:err] ' + d);
    });

    // 等待 server 就绪
    await waitForServer(testPort);
    console.log('[test] server 已就绪');
  });

  after(async () => {
    if (serverProc) {
      killServer(serverProc);
      serverProc = null;
    }
    // 给端口释放一点时间
    await new Promise((r) => setTimeout(r, 300));
  });

  // ── 测试 1: 健康检查 ──
  test('GET /api/health 返回 200 + { ok: true, mock_mode: true }', async () => {
    const res = await httpRequest('GET', '/api/health');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.strictEqual(res.json.ok, true, 'ok 应为 true');
    assert.strictEqual(res.json.mock_mode, true, 'mock_mode 应为 true（MOCK_MODE=true 时）');
  });

  // ── 测试 2: 三节点状态 ──
  test('GET /api/agents 返回 3 个 agent（A/B/C）', async () => {
    const res = await httpRequest('GET', '/api/agents');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok(Array.isArray(res.json.agents), 'agents 应为数组');
    assert.strictEqual(res.json.agents.length, 3, '应返回 3 个 agent');
    const labels = res.json.agents.map((a) => a.label).sort();
    assert.deepStrictEqual(labels, ['A', 'B', 'C'], '应包含 A/B/C 三个 agent');
  });

  // ── 测试 3: 悬赏列表 ──
  test('GET /api/bounties 返回至少 1 个悬赏', async () => {
    const res = await httpRequest('GET', '/api/bounties');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok(Array.isArray(res.json.bounties), 'bounties 应为数组');
    assert.ok(res.json.bounties.length >= 1, '应至少返回 1 个悬赏');
  });

  // ── 测试 4: failed Capsule 过滤 ──
  test('GET /api/capsules?outcome=failed 返回的 capsules 都有 outcome.status === "failed"', async () => {
    const res = await httpRequest('GET', '/api/capsules?outcome=failed');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok(Array.isArray(res.json.capsules), 'capsules 应为数组');
    assert.ok(res.json.capsules.length >= 1, '应至少返回 1 个 failed Capsule');
    for (const cap of res.json.capsules) {
      assert.ok(
        cap.outcome && cap.outcome.status === 'failed',
        '每个 Capsule 的 outcome.status 应为 "failed"，实际: ' + JSON.stringify(cap.outcome)
      );
    }
  });

  // ── 测试 5: success Capsule 过滤 ──
  test('GET /api/capsules?outcome=success 返回的 capsules 都有 outcome.status === "success"', async () => {
    const res = await httpRequest('GET', '/api/capsules?outcome=success');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok(Array.isArray(res.json.capsules), 'capsules 应为数组');
    assert.ok(res.json.capsules.length >= 1, '应至少返回 1 个 success Capsule');
    for (const cap of res.json.capsules) {
      assert.ok(
        cap.outcome && cap.outcome.status === 'success',
        '每个 Capsule 的 outcome.status 应为 "success"，实际: ' + JSON.stringify(cap.outcome)
      );
    }
  });

  // ── 测试 6: 能力链 ──
  test('GET /api/chain/chain_react_useeffect_fix 返回 3 个资产', async () => {
    const res = await httpRequest('GET', '/api/chain/chain_react_useeffect_fix');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok(Array.isArray(res.json.assets), 'assets 应为数组');
    assert.strictEqual(res.json.assets.length, 3, '能力链应包含 3 个资产（A→B→C）');
  });

  // ── 测试 7: 积分流水 ──
  test('GET /api/earnings/node_agent_a 返回积分流水', async () => {
    const res = await httpRequest('GET', '/api/earnings/node_agent_a');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok(Array.isArray(res.json.earnings), 'earnings 应为数组');
    assert.ok(res.json.earnings.length >= 1, '应至少返回 1 条积分流水');
    // 每条流水应有 amount 字段
    for (const e of res.json.earnings) {
      assert.ok('amount' in e, '每条流水应包含 amount 字段');
    }
  });

  // ── 测试 8: 触发 Demo ──
  test('POST /api/demo/start 返回 run_id', async () => {
    const res = await httpRequest('POST', '/api/demo/start', {});
    // 200（新启动）或 409（已有运行中）均合法
    assert.ok(res.status === 200 || res.status === 409, 'HTTP 200 或 409');
    assert.ok(res.json, '应返回 JSON');
    assert.ok(res.json.run_id, '应包含 run_id');
    assert.ok(typeof res.json.run_id === 'string', 'run_id 应为字符串');
  });

  // ── 测试 9: Demo 状态查询 ──
  test('GET /api/demo/status 返回 status 字段', async () => {
    const res = await httpRequest('GET', '/api/demo/status');
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok('status' in res.json, '应包含 status 字段');
    assert.ok(typeof res.json.status === 'string', 'status 应为字符串');
    // idle / running / completed / failed 均合法
    assert.ok(
      ['idle', 'running', 'completed', 'failed'].includes(res.json.status),
      'status 应为 idle/running/completed/failed 之一，实际: ' + res.json.status
    );
  });

  // ── 测试 10: Demo 编排推进（5 秒后 phase 不为 init） ──
  test('启动 Demo 后 5 秒，GET /api/demo/status 应显示 phase 不为 "init"', async () => {
    // 先触发 Demo（若已有运行中则复用）
    const startRes = await httpRequest('POST', '/api/demo/start', {});
    let runId = startRes.json?.run_id;
    if (!runId) {
      // 可能已有运行中的 Demo，从 status 获取
      const statusRes = await httpRequest('GET', '/api/demo/status');
      runId = statusRes.json?.run_id;
    }
    assert.ok(runId, '应能获取到 run_id');

    // 等待 5 秒，让 mock-orchestrator 推进
    await new Promise((r) => setTimeout(r, 5000));

    const res = await httpRequest('GET', '/api/demo/status?run_id=' + encodeURIComponent(runId));
    assert.strictEqual(res.status, 200, 'HTTP 200');
    assert.ok(res.json, '应返回 JSON');
    assert.ok('phase' in res.json, '应包含 phase 字段');
    assert.notStrictEqual(
      res.json.phase,
      'init',
      '5 秒后 phase 不应为 "init"（mock-orchestrator 应已推进），实际: ' + res.json.phase
    );
  });
});
