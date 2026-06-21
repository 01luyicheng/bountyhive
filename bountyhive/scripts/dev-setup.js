#!/usr/bin/env node
// scripts/dev-setup.js
// 一键安装配置
//
// 执行步骤:
//   1. 检查 Node.js 版本 >= 18
//   2. npm install（后端依赖，已安装则跳过）
//   3. cd frontend && npm install（前端依赖，已安装则跳过）
//   4. 如果 .env 不存在，从 .env.example 复制
//   5. 如果 frontend/.env 不存在，创建（VITE_API_BASE=http://localhost:3001）
//   6. 运行 npm run self-test 验证 asset_id 计算
//   7. 打印下一步提示

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function step(msg) {
  console.log('\n' + C.bold + C.cyan + '━━━ ' + msg + ' ━━━' + C.reset);
}

function fmtDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(0);
  return m + 'm' + rest + 's';
}

function run(cmd, opts) {
  const o = opts || {};
  console.log(C.yellow + '> ' + cmd + C.reset);
  execSync(cmd, { stdio: 'inherit', cwd: ROOT, ...o });
}

const totalStart = Date.now();

// ── 1. 检查 Node.js 版本 ──
step('检查 Node.js 版本');
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor < 18) {
  console.error(C.red + '❌ Node.js 版本过低: ' + process.versions.node + '，需要 >= 18' + C.reset);
  console.error('   请升级 Node.js: https://nodejs.org/');
  process.exit(1);
}
console.log(C.green + '✅ Node.js ' + process.versions.node + C.reset);

// ── 2. 安装后端依赖 ──
step('安装后端依赖');
const backendStart = Date.now();
if (fs.existsSync(path.join(ROOT, 'node_modules'))) {
  console.log(C.yellow + 'node_modules 已存在，跳过 npm install' + C.reset);
} else {
  run('npm install');
  console.log(C.green + '✅ 后端依赖安装完成 (' + C.cyan + fmtDuration(Date.now() - backendStart) + C.green + ')' + C.reset);
}

// ── 3. 安装前端依赖 ──
step('安装前端依赖');
const frontendDir = path.join(ROOT, 'frontend');
if (!fs.existsSync(frontendDir)) {
  console.error(C.red + '❌ frontend/ 目录不存在' + C.reset);
  process.exit(1);
}
const frontendStart = Date.now();
if (fs.existsSync(path.join(frontendDir, 'node_modules'))) {
  console.log(C.yellow + 'frontend/node_modules 已存在，跳过 npm install' + C.reset);
} else {
  run('npm install', { cwd: frontendDir });
  console.log(C.green + '✅ 前端依赖安装完成 (' + C.cyan + fmtDuration(Date.now() - frontendStart) + C.green + ')' + C.reset);
}

// ── 4. 配置 .env ──
step('配置 .env');
const envPath = path.join(ROOT, '.env');
const envExamplePath = path.join(ROOT, '.env.example');
if (fs.existsSync(envPath)) {
  console.log(C.yellow + '.env 已存在，跳过' + C.reset);
} else if (fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log(C.green + '✅ 已从 .env.example 复制到 .env' + C.reset);
} else {
  console.log(C.red + '⚠️ .env.example 不存在，请手动创建 .env' + C.reset);
}

// ── 5. 配置 frontend/.env ──
step('配置 frontend/.env');
const frontendEnvPath = path.join(frontendDir, '.env');
if (fs.existsSync(frontendEnvPath)) {
  console.log(C.yellow + 'frontend/.env 已存在，跳过' + C.reset);
} else {
  fs.writeFileSync(
    frontendEnvPath,
    '# 前端 API 基址（Vite 通过 vite.config.js 中的 proxy 代理 /api 到此地址）\nVITE_API_BASE=http://localhost:3001\n',
    'utf8'
  );
  console.log(C.green + '✅ 已创建 frontend/.env (VITE_API_BASE=http://localhost:3001)' + C.reset);
}

// ── 6. 运行 self-test ──
step('运行 asset_id 自测');
const selfTestStart = Date.now();
try {
  run('npm run self-test');
  console.log(C.green + '✅ self-test 通过 (' + C.cyan + fmtDuration(Date.now() - selfTestStart) + C.green + ')' + C.reset);
} catch (e) {
  console.error(C.red + '❌ self-test 失败，请检查 src/lib/asset-id.js' + C.reset);
  process.exit(1);
}

// ── 6.5 测试 EvoMap Hub 连接 ──
step('测试 EvoMap Hub 连接');
const hubUrl = process.env.A2A_HUB_URL || 'https://evomap.ai';
try {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const resp = await fetch(hubUrl + '/api/health', { signal: controller.signal });
  clearTimeout(timeout);
  if (resp.ok) {
    console.log(C.green + '✅ Hub 可达: ' + hubUrl + C.reset);
  } else {
    console.log(C.yellow + '⚠️  Hub 返回 ' + resp.status + '，真实模式可能受限' + C.reset);
    console.log(C.yellow + '   提示: 启动时会自动切换到 mock 模式' + C.reset);
  }
} catch (e) {
  console.log(C.yellow + '⚠️  Hub 不可达 (' + hubUrl + '): ' + e.message + C.reset);
  console.log(C.yellow + '   真实模式需要网络连接，mock 模式无需网络' + C.reset);
  console.log(C.yellow + '   提示: 启动时会自动切换到 mock 模式' + C.reset);
}

// ── 7. 下一步提示 ──
step('配置完成');
const totalDur = Date.now() - totalStart;

// Check if credentials exist
const hasCreds = process.env.A_NODE_ID || process.env.B_NODE_ID || process.env.C_NODE_ID;
const modeHint = hasCreds
  ? C.green + '已检测到凭证，可使用真实模式' + C.reset
  : C.yellow + '未检测到凭证，将自动使用 mock 模式' + C.reset;

console.log(
  '\n' + C.bold + C.green + '  BountyHive 开发环境已就绪！' + C.reset +
  C.cyan + ' (总耗时 ' + fmtDuration(totalDur) + ')' + C.reset + '\n' +
  '\n' + C.bold + '当前状态: ' + C.reset + modeHint + '\n' +
  '\n' + C.bold + '下一步：node scripts/start-all.js --mock' + C.reset +
  '\n' +
  '\n' + C.bold + '其他命令:' + C.reset +
  '\n  ' + C.cyan + 'npm run dev' + C.reset + '          # 自动检测模式启动（有凭证→真实，无→mock）' +
  '\n  ' + C.cyan + 'npm run dev:mock' + C.reset + '     # 强制 Mock 模式启动（不依赖真实账号）' +
  '\n  ' + C.cyan + 'npm run stop' + C.reset + '         # 停止所有服务' +
  '\n  ' + C.cyan + 'npm test' + C.reset + '             # 运行集成测试' +
  '\n' +
  '\n' + C.bold + '获取真实模式凭证:' + C.reset +
  '\n  1. 运行 demo 一次: node scripts/start-all.js --mock' +
  '\n  2. Demo 运行时会自动注册节点，控制台会打印 claim_url' +
  '\n  3. 打开 claim_url 认领节点，获取 node_id 和 node_secret' +
  '\n  4. 将凭证填入 .env 文件（一个账号可以创建多个节点）' +
  '\n  5. 再次运行 demo 即可使用真实模式' +
  '\n' +
  '\n' + C.bold + '访问地址:' + C.reset +
  '\n  前端:      http://localhost:5173' +
  '\n  后端 API:  http://localhost:3001' +
  '\n  健康检查:  http://localhost:3001/api/health\n'
);
