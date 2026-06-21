#!/usr/bin/env node
// scripts/expo-launch.js
// 一键启动 Hackathon Expo Demo
//
// 用法:
//   node scripts/expo-launch.js                # 自动检测模式（有凭证→real，无→mock）
//   node scripts/expo-launch.js --mock         # 强制 Mock 模式
//   node scripts/expo-launch.js --real         # 强制 Real 模式（缺凭证则报错）
//   node scripts/expo-launch.js --no-frontend  # 只启动后端 + heartbeat
//
// 信号处理: 监听 SIGINT/SIGTERM，优雅关闭所有子进程

import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { load as dotenvLoad } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const FRONTEND_ROOT = path.join(ROOT, 'frontend');

// ANSI 颜色
const C = {
  server:   '\x1b[32m',  // green
  frontend: '\x1b[36m',  // cyan
  heartbeat:'\x1b[35m',  // magenta
  system:   '\x1b[33m',  // yellow
  error:    '\x1b[31m',  // red
  bold:     '\x1b[1m',
  dim:      '\x1b[2m',
  reset:    '\x1b[0m',
};

// ── CLI Flags ──
const args = process.argv.slice(2);
const forceMock  = args.includes('--mock');
const forceReal  = args.includes('--real');
const noFrontend = args.includes('--no-frontend');

if (forceMock && forceReal) {
  console.error(C.error + 'Cannot use --mock and --real together.' + C.reset);
  process.exit(1);
}

const BACKEND_PORT  = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

// ── Logging ──
function log(label, msg, color) {
  const c = color || C.system;
  const lines = String(msg).split('\n');
  for (const line of lines) {
    if (line.length === 0) continue;
    process.stdout.write(c + '[' + label + ']' + C.reset + ' ' + line + '\n');
  }
}

// ── Port check ──
function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(true));
    tester.once('listening', () => { tester.close(() => resolve(false)); });
    tester.listen(port);
  });
}

// ── Process management (same patterns as start-all.js) ──
/** @type {Array<{name: string, child: import('child_process').ChildProcess}>} */
const children = [];
let shuttingDown = false;

function spawnProc(name, command, cmdArgs, options) {
  const opts = options || {};
  const color = C[name] || C.system;
  const stderrBuffer = [];
  const child = spawn(command, cmdArgs, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    ...opts,
  });

  child.stdout?.on('data', (data) => log(name, data.toString(), color));
  child.stderr?.on('data', (data) => {
    const text = data.toString();
    log(name, text, C.error);
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.length === 0) continue;
      stderrBuffer.push(line);
      if (stderrBuffer.length > 10) stderrBuffer.shift();
    }
  });

  child.on('error', (err) => log(name, 'process failed: ' + err.message, C.error));

  child.on('exit', (code, signal) => {
    log(name, 'process exited (code=' + code + ', signal=' + (signal || 'null') + ')', color);
    if (!shuttingDown && code !== 0 && code !== null) {
      log('system', name + ' crashed (exit code ' + code + ')', C.error);
      if (stderrBuffer.length > 0) {
        log('system', '── ' + name + ' last ' + stderrBuffer.length + ' stderr lines ──', C.error);
        for (const line of stderrBuffer) {
          process.stderr.write(C.error + '  ' + line + C.reset + '\n');
        }
      }
      log('system', 'Shutting down all services...', C.error);
      killAll();
    }
  });

  children.push({ name, child });
  return child;
}

function killPidTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /pid ' + pid + ' /T /F', { stdio: 'ignore' });
    } else {
      try { process.kill(pid, 'SIGTERM'); } catch (e) { /* ignore */ }
      setTimeout(() => {
        try { process.kill(pid, 'SIGKILL'); } catch (e) { /* already dead */ }
      }, 1500);
    }
  } catch (e) { /* ignore */ }
}

function killAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('system', 'Stopping all child processes...', C.system);
  for (const { name, child } of children) {
    if (child.pid && !child.killed) {
      log(name, 'Killing process (pid=' + child.pid + ')', C.system);
      killPidTree(child.pid);
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
process.on('SIGHUP', killAll);

// ── HTTP fetch helper ──
function httpGet(url, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Prerequisite checks ──

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    return { exists: false, env: {} };
  }
  const result = dotenvLoad({ path: envPath });
  return { exists: true, env: result.parsed || {} };
}

function detectMode(env) {
  if (forceMock) return 'mock';
  if (forceReal) return 'real';
  // Auto-detect: if MOCK_MODE is set, respect it
  const mockEnv = (env.MOCK_MODE || '').toLowerCase().trim();
  if (mockEnv === 'true') return 'mock';
  if (mockEnv === 'false') return 'real';
  // Auto-detect: check for agent credentials
  if (env.A_NODE_ID && env.A_NODE_SECRET) return 'real';
  return 'mock';
}

function detectLLM(env) {
  return !!(env.OPENROUTER_API_KEY && env.OPENROUTER_API_KEY.trim().length > 0);
}

async function checkConnectivity(url) {
  try {
    const res = await httpGet(url, 5000);
    return res.status >= 200 && res.status < 400;
  } catch {
    return false;
  }
}

async function checkOpenRouterKey(apiKey) {
  try {
    const res = await httpGet('https://openrouter.ai/api/v1/models', 5000);
    return res.status === 200;
  } catch {
    return false;
  }
}

// ── Wait for backend health ──
async function waitForHealth(port, maxAttempts = 30, intervalMs = 1000) {
  const url = 'http://localhost:' + port + '/api/health';
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await httpGet(url, 2000);
      if (res.status >= 200 && res.status < 400) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// ── Main ──
async function main() {
  console.log('');
  console.log(C.bold + C.system + '  ╔══════════════════════════════════════════╗' + C.reset);
  console.log(C.bold + C.system + '  ║       BountyHive Expo Demo Launcher     ║' + C.reset);
  console.log(C.bold + C.system + '  ╚══════════════════════════════════════════╝' + C.reset);
  console.log('');

  // ── 1. Prerequisites ──
  log('check', 'Checking prerequisites...', C.system);

  // .env check
  const { exists: envExists, env } = loadEnv();
  if (!envExists) {
    log('check', '.env file not found', C.error);
    log('check', 'Run: cp .env.example .env  then edit with your credentials', C.system);
    process.exit(1);
  }
  log('check', '.env found', C.server);

  // Determine mode
  const mode = detectMode(env);
  const hasLLM = detectLLM(env);

  // --real flag requires credentials
  if (forceReal && mode !== 'real') {
    log('check', '--real mode requested but no agent credentials found in .env', C.error);
    log('check', 'Set A_NODE_ID and A_NODE_SECRET in .env', C.system);
    process.exit(1);
  }

  // node_modules check
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    log('check', 'Backend node_modules not found', C.error);
    log('check', 'Run: npm run setup', C.system);
    process.exit(1);
  }
  log('check', 'Backend dependencies OK', C.server);

  if (!noFrontend) {
    if (!fs.existsSync(path.join(FRONTEND_ROOT, 'node_modules'))) {
      log('check', 'Frontend node_modules not found', C.error);
      log('check', 'Run: npm run setup', C.system);
      process.exit(1);
    }
    log('check', 'Frontend dependencies OK', C.server);
  }

  // Port availability
  const portsToCheck = [BACKEND_PORT];
  if (!noFrontend) portsToCheck.push(FRONTEND_PORT);
  for (const port of portsToCheck) {
    if (await isPortInUse(port)) {
      log('check', 'Port ' + port + ' already in use — free it or set PORT / FRONTEND_PORT', C.error);
      process.exit(1);
    }
  }
  log('check', 'Ports ' + portsToCheck.join(', ') + ' available', C.server);

  // Connectivity to evomap.ai
  log('check', 'Testing connectivity to evomap.ai...', C.system);
  const evomapOk = await checkConnectivity('https://evomap.ai');
  if (evomapOk) {
    log('check', 'evomap.ai reachable', C.server);
  } else {
    log('check', 'evomap.ai unreachable — running in degraded mode', C.system);
  }

  // OpenRouter API key
  if (hasLLM) {
    log('check', 'OpenRouter API key present', C.server);
  } else {
    log('check', 'No OPENROUTER_API_KEY — LLM features unavailable', C.system);
  }

  console.log('');

  // ── 2. Start backend ──
  const serverEnv = { ...process.env, PORT: String(BACKEND_PORT) };
  if (mode === 'mock') {
    serverEnv.MOCK_MODE = 'true';
  }
  log('server', 'Starting backend (port ' + BACKEND_PORT + ')...', C.server);
  spawnProc('server', 'npm', ['run', 'server'], {
    cwd: ROOT,
    env: serverEnv,
  });

  // Wait for backend to be ready
  log('server', 'Waiting for backend health check...', C.server);
  const healthy = await waitForHealth(BACKEND_PORT);
  if (!healthy) {
    log('server', 'Backend failed to start within timeout', C.error);
    killAll();
    process.exit(1);
  }
  log('server', 'Backend is healthy!', C.server);

  // ── 3. Start frontend ──
  if (!noFrontend) {
    const frontendEnv = { ...process.env, FRONTEND_PORT: String(FRONTEND_PORT) };
    log('frontend', 'Starting frontend dev server (port ' + FRONTEND_PORT + ')...', C.frontend);
    spawnProc('frontend', 'npm', ['run', 'dev', '--', '--port', String(FRONTEND_PORT)], {
      cwd: FRONTEND_ROOT,
      env: frontendEnv,
    });
  }

  // ── 4. Start heartbeat daemon ──
  log('heartbeat', 'Starting heartbeat daemon...', C.heartbeat);
  spawnProc('heartbeat', 'npm', ['run', 'heartbeat'], {
    cwd: ROOT,
    env: serverEnv,
  });

  // ── 5. Status dashboard ──
  console.log('');
  console.log(C.bold + '  ╔══════════════════════════════════════════╗' + C.reset);
  console.log(C.bold + '  ║           BountyHive Status              ║' + C.reset);
  console.log(C.bold + '  ╚══════════════════════════════════════════╝' + C.reset);
  console.log('');
  console.log('  ' + C.bold + 'Services:' + C.reset);
  console.log('    Backend:   ' + C.server + 'http://localhost:' + BACKEND_PORT + C.reset);
  if (!noFrontend) {
    console.log('    Frontend:  ' + C.frontend + 'http://localhost:' + FRONTEND_PORT + C.reset);
  }
  console.log('    Health:    ' + C.dim + 'http://localhost:' + BACKEND_PORT + '/api/health' + C.reset);
  console.log('');
  console.log('  ' + C.bold + 'Config:' + C.reset);
  console.log('    Mode:      ' + (mode === 'real' ? C.server + 'real' : C.system + 'mock') + C.reset);
  console.log('    LLM:       ' + (hasLLM ? C.server + 'available' : C.system + 'unavailable') + C.reset);
  console.log('    evomap.ai: ' + (evomapOk ? C.server + 'reachable' : C.system + 'degraded') + C.reset);
  console.log('');

  // ── 6. Expo instructions ──
  console.log(C.bold + '  ╔══════════════════════════════════════════╗' + C.reset);
  console.log(C.bold + '  ║          Expo Demo Instructions          ║' + C.reset);
  console.log(C.bold + '  ╚══════════════════════════════════════════╝' + C.reset);
  console.log('');
  if (!noFrontend) {
    console.log('  1. Open ' + C.bold + 'http://localhost:' + FRONTEND_PORT + C.reset + ' on the projector');
  } else {
    console.log('  1. Backend-only mode — no frontend started');
  }
  console.log('  2. Click "' + C.bold + '启动 Demo' + C.reset + '" button to start the live demo');
  console.log('  3. Press ' + C.bold + 'Ctrl+C' + C.reset + ' to stop all services');
  console.log('');
  if (mode === 'mock') {
    console.log('  ' + C.system + '  (Mock mode — using local mock data, no real EvoMap calls)' + C.reset);
  }
  if (!hasLLM) {
    console.log('  ' + C.system + '  (LLM unavailable — agent responses use mock templates)' + C.reset);
  }
  console.log('');
}

main().catch((err) => {
  log('system', 'Launch failed: ' + err.message, C.error);
  process.exit(1);
});
