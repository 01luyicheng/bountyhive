// src/demo/stability-test.js
// 稳定性测试：多次运行 demo 编排，验证可靠性

import { runMockOrchestrator } from './mock-orchestrator.js';
import { runOrchestrator } from './orchestrator.js';
import 'dotenv/config';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function hasCredentials() {
  return !!(
    (process.env.A_NODE_ID && process.env.A_NODE_SECRET) ||
    (process.env.B_NODE_ID && process.env.B_NODE_SECRET) ||
    (process.env.C_NODE_ID && process.env.C_NODE_SECRET)
  );
}

async function runWithTracking(label, runner, runCount) {
  const results = [];
  for (let i = 1; i <= runCount; i++) {
    const start = Date.now();
    let pass = false;
    let failedPhase = null;
    let duration = 0;
    try {
      const result = await runner();
      duration = Date.now() - start;
      if (result.error) {
        failedPhase = result.error.phase || result.phase;
        console.log(`  ${RED}✗${RESET} ${label} #${i} — 阶段 [${failedPhase}] 失败: ${result.error.message}`);
      } else {
        pass = true;
        console.log(`  ${GREEN}✓${RESET} ${label} #${i} ${DIM}(${(duration / 1000).toFixed(1)}s)${RESET}`);
      }
    } catch (err) {
      duration = Date.now() - start;
      failedPhase = 'crash';
      console.log(`  ${RED}✗${RESET} ${label} #${i} — 崩溃: ${err.message}`);
    }
    results.push({ pass, duration, failedPhase, label, index: i });
    if (i < runCount) {
      console.log(`    ${DIM}等待 2s 冷却...${RESET}`);
      await sleep(2000);
    }
  }
  return results;
}

function printSummary(allResults) {
  const total = allResults.length;
  const passed = allResults.filter((r) => r.pass).length;
  const failed = allResults.filter((r) => !r.pass).length;
  const avgDuration = allResults.reduce((s, r) => s + r.duration, 0) / total;

  console.log('');
  console.log(`${CYAN}══════════════════════════════════════════${RESET}`);
  console.log(`${CYAN}  稳定性测试报告${RESET}`);
  console.log(`${CYAN}══════════════════════════════════════════${RESET}`);

  for (const r of allResults) {
    const icon = r.pass ? `${GREEN}✓${RESET}` : `${RED}✗${RESET}`;
    const phaseInfo = r.pass ? '' : ` 阶段 [${r.failedPhase}]`;
    console.log(`  ${icon} ${r.label} #${r.index}${phaseInfo} ${DIM}(${(r.duration / 1000).toFixed(1)}s)${RESET}`);
  }

  console.log('');
  const status = failed === 0 ? `${GREEN}全部通过${RESET}` : `${RED}${failed} 次失败${RESET}`;
  console.log(`  ${passed}/${total} passed, avg duration: ${(avgDuration / 1000).toFixed(1)}s (${status})`);
  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  const useMock = args.includes('--mock');

  const mockN = parseInt(process.env.STABILITY_N, 10) || 5;
  const realN = 3;

  const credsAvailable = hasCredentials();
  const allResults = [];

  console.log(`${CYAN}┌────────────────────────────────────────────┐${RESET}`);
  console.log(`${CYAN}│  BountyHive 稳定性测试                      │${RESET}`);
  console.log(`${CYAN}└────────────────────────────────────────────┘${RESET}`);
  console.log('');

  if (useMock) {
    console.log(`${YELLOW}Mock 模式: ${mockN} 次迭代${RESET}`);
    const mockResults = await runWithTracking('Mock', () => runMockOrchestrator({ storyMode: false, skipSearch: true }), mockN);
    allResults.push(...mockResults);
  } else {
    if (credsAvailable) {
      console.log(`${YELLOW}真实模式: ${realN} 次迭代${RESET}`);
      const realResults = await runWithTracking('Real', () => runOrchestrator({ storyMode: false, skipSearch: true }), realN);
      allResults.push(...realResults);
    } else {
      console.log(`${YELLOW}未检测到凭证，跳过真实模式${RESET}`);
    }

    console.log('');
    console.log(`${YELLOW}Mock 模式: ${mockN} 次迭代${RESET}`);
    const mockResults = await runWithTracking('Mock', () => runMockOrchestrator({ storyMode: false, skipSearch: true }), mockN);
    allResults.push(...mockResults);
  }

  printSummary(allResults);

  const failed = allResults.filter((r) => !r.pass).length;
  if (failed > 0) {
    process.exit(1);
  }
}

main();
