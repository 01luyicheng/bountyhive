// src/demo/heartbeat.js
// 心跳保活：并行启动 A/B/C 三个心跳循环
// 参考：evomap-skill-docs/evomap-skill.md Layer 2b
//
// 设计：
//   - 间隔 5 分钟（HEARTBEAT_INTERVAL_MS 可配置，默认 300000）
//   - 每次心跳打印 pending_events
//   - 4xx 不重试，5xx/网络错误重试 3 次（5s→15s→60s）
//   - SIGINT/SIGTERM 优雅退出

import 'dotenv/config';
import EvoMapClient from '../lib/evomap-client.js';

const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '300000', 10);
const RETRY_BACKOFFS = [5000, 15000, 60000]; // 5xx/网络错误重试退避

function ts() {
  return new Date().toISOString();
}

/**
 * 单个 Agent 的心跳循环
 * @param {string} label - A / B / C
 * @param {EvoMapClient} client
 * @param {string} nodeId
 * @param {string} nodeSecret
 * @param {number} intervalMs
 * @param {object} ctrl - { running: boolean } 控制对象
 */
async function heartbeatLoop(label, client, nodeId, nodeSecret, intervalMs, ctrl) {
  const log = (msg) => console.log(`[${ts()}] [heartbeat ${label}] ${msg}`);

  log(`启动心跳循环，间隔 ${intervalMs}ms（节点 ${nodeId}）`);

  while (ctrl.running) {
    // 一次心跳 + 重试
    let success = false;
    for (let attempt = 0; attempt <= RETRY_BACKOFFS.length; attempt++) {
      if (!ctrl.running) break;
      try {
        const res = await client.heartbeat(nodeId, nodeSecret);
        const pending = res?.pending_events || [];
        const availableWork = res?.available_work || [];
        const credit = res?.credit_balance;
        log(
          `心跳成功 | pending_events=${pending.length} available_work=${availableWork.length} credit=${credit ?? 'N/A'}`
        );
        if (pending.length > 0) {
          for (const ev of pending) {
            log(`  event: ${ev.event_type || ev.type} ${JSON.stringify(ev.payload || {}).slice(0, 120)}`);
          }
        }
        success = true;
        break;
      } catch (err) {
        const is4xx = err.status && err.status >= 400 && err.status < 500;
        if (is4xx) {
          log(`❌ 心跳失败 (4xx，不重试): ${err.message}`);
          break;
        }
        if (attempt < RETRY_BACKOFFS.length) {
          const wait = RETRY_BACKOFFS[attempt];
          log(`⚠️ 心跳失败 (attempt ${attempt + 1})，${wait}ms 后重试: ${err.message}`);
          await sleep(wait);
        } else {
          log(`❌ 心跳 3 次重试均失败: ${err.message}`);
        }
      }
    }

    if (!ctrl.running) break;

    // 等待下一个间隔（可被打断）
    const slice = 1000;
    let waited = 0;
    while (ctrl.running && waited < intervalMs) {
      await sleep(slice);
      waited += slice;
    }
  }

  log(`心跳循环已停止`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * 启动 3 个 Agent 的心跳
 */
export async function startHeartbeats(intervalMs = HEARTBEAT_INTERVAL_MS) {
  const hubUrl = process.env.A2A_HUB_URL || 'https://evomap.ai';
  const client = new EvoMapClient(hubUrl);

  console.log(`[${ts()}] [heartbeat] 加载 A/B/C 凭证...`);

  // 心跳脚本直接读取环境变量，凭证为空时直接报错退出，不走 hello 注册路径
  const creds = {
    a: { nodeId: process.env.A_NODE_ID, nodeSecret: process.env.A_NODE_SECRET },
    b: { nodeId: process.env.B_NODE_ID, nodeSecret: process.env.B_NODE_SECRET },
    c: { nodeId: process.env.C_NODE_ID, nodeSecret: process.env.C_NODE_SECRET },
  };
  for (const label of ['a', 'b', 'c']) {
    const c = creds[label];
    if (!c.nodeId || !c.nodeSecret) {
      console.error('[heartbeat] 环境变量 A_NODE_ID/A_NODE_SECRET 等未配置，无法启动心跳');
      process.exit(1);
    }
    console.log(`[${ts()}] [heartbeat ${label.toUpperCase()}] 使用环境变量凭证: ${c.nodeId}`);
  }

  const ctrl = { running: true };
  const loops = [
    heartbeatLoop('A', client, creds.a.nodeId, creds.a.nodeSecret, intervalMs, ctrl),
    heartbeatLoop('B', client, creds.b.nodeId, creds.b.nodeSecret, intervalMs, ctrl),
    heartbeatLoop('C', client, creds.c.nodeId, creds.c.nodeSecret, intervalMs, ctrl),
  ];

  // 优雅退出
  const shutdown = (sig) => {
    console.log(`\n[${ts()}] [heartbeat] 收到 ${sig}，停止心跳循环...`);
    ctrl.running = false;
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // 等待所有循环退出
  await Promise.all(loops);
  console.log(`[${ts()}] [heartbeat] 全部心跳循环已停止，进程退出`);
}

// ── 独立运行入口 ──
const isMain = process.argv[1] && process.argv[1].endsWith('heartbeat.js');
if (isMain) {
  startHeartbeats().catch((err) => {
    console.error(`[${ts()}] [heartbeat] 致命错误:`, err.message);
    process.exit(1);
  });
}
