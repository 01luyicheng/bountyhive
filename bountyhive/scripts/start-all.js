#!/usr/bin/env node
// scripts/start-all.js
// 一键启动后端 + 前端
//
// 用法:
//   node scripts/start-all.js                # 启动后端 + 前端
//   node scripts/start-all.js --mock         # Mock 模式启动（MOCK_MODE=true）
//   node scripts/start-all.js --no-frontend  # 只启动后端
//
// 信号处理: 监听 SIGINT/SIGTERM，优雅关闭两个子进程

import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ANSI 颜色（不引入新依赖，直接用转义码）
const C = {
  server: '\x1b[32m',    // green
  frontend: '\x1b[36m',  // cyan
  system: '\x1b[33m',    // yellow
  error: '\x1b[31m',     // red
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

const args = process.argv.slice(2);
const useMock = args.includes('--mock');
const noFrontend = args.includes('--no-frontend');
// 端口配置：可用环境变量覆盖
const BACKEND_PORT = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_PORT = parseInt(process.env.FRONTEND_PORT || '5173', 10);

function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(true));
    tester.once('listening', () => {
      tester.close(() => resolve(false));
    });
    tester.listen(port);
  });
}

async function checkPorts() {
  const portsToCheck = [BACKEND_PORT];
  if (!noFrontend) {
    portsToCheck.push(FRONTEND_PORT);
  }
  for (const port of portsToCheck) {
    const inUse = await isPortInUse(port);
    if (inUse) {
      log('system', '错误: 端口 ' + port + ' 已被占用，请先释放端口或设置环境变量覆盖（PORT / FRONTEND_PORT）', C.error);
      process.exit(1);
    }
  }
}

/** @type {Array<{name: string, child: import('child_process').ChildProcess}>} */
const children = [];
let shuttingDown = false;

function log(label, msg, color) {
  const c = color || C.system;
  const lines = String(msg).split('\n');
  for (const line of lines) {
    if (line.length === 0) continue;
    process.stdout.write(c + '[' + label + ']' + C.reset + ' ' + line + '\n');
  }
}

function spawnProc(name, command, cmdArgs, options) {
  const opts = options || {};
  const color = C[name] || C.system;
  const stderrBuffer = []; // 保留最近 10 行 stderr，崩溃时打印
  const child = spawn(command, cmdArgs, {
    shell: true,
    stdio: ['inherit', 'pipe', 'pipe'],
    ...opts,
  });

  child.stdout?.on('data', (data) => {
    log(name, data.toString(), color);
  });
  child.stderr?.on('data', (data) => {
    const text = data.toString();
    log(name, text, C.error);
    // 维护 stderr 滑动窗口（按行）
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.length === 0) continue;
      stderrBuffer.push(line);
      if (stderrBuffer.length > 10) stderrBuffer.shift();
    }
  });

  child.on('error', (err) => {
    log(name, '进程启动失败: ' + err.message, C.error);
  });

  child.on('exit', (code, signal) => {
    log(name, '进程退出 (code=' + code + ', signal=' + (signal || 'null') + ')', color);
    if (!shuttingDown && code !== 0 && code !== null) {
      log('system', name + ' 进程崩溃（退出码 ' + code + '）', C.error);
      if (stderrBuffer.length > 0) {
        log('system', '── ' + name + ' stderr 最后 ' + stderrBuffer.length + ' 行 ──', C.error);
        for (const line of stderrBuffer) {
          process.stderr.write(C.error + '  ' + line + C.reset + '\n');
        }
      }
      log('system', '正在关闭所有服务...', C.error);
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
      try {
        process.kill(pid, 'SIGTERM');
      } catch (e) {
        // ignore
      }
      setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL');
        } catch (e) {
          // already dead
        }
      }, 1500);
    }
  } catch (e) {
    // ignore
  }
}

function killAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('system', '正在关闭所有子进程...', C.system);
  for (const { name, child } of children) {
    if (child.pid && !child.killed) {
      log(name, '终止进程 (pid=' + child.pid + ')', C.system);
      killPidTree(child.pid);
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', killAll);
process.on('SIGTERM', killAll);
process.on('SIGHUP', killAll);

async function main() {
  // ── 启动前检查 ──
  await checkPorts();

  // 后端 node_modules
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) {
    log('system', '后端依赖未安装（bountyhive/node_modules/ 不存在）', C.error);
    log('system', '请先运行: npm run setup', C.system);
    process.exit(1);
  }

  // 前端 node_modules（若需要启动前端）
  if (!noFrontend) {
    const frontendNodeModules = path.join(ROOT, 'frontend', 'node_modules');
    if (!fs.existsSync(frontendNodeModules)) {
      log('system', '前端依赖未安装（bountyhive/frontend/node_modules/ 不存在）', C.error);
      log('system', '请先运行: npm run setup', C.system);
      process.exit(1);
    }
  }

  // ── 启动后端 ──
  const serverEnv = { ...process.env, PORT: String(BACKEND_PORT) };
  if (useMock) {
    serverEnv.MOCK_MODE = 'true';
    log('system', 'Mock 模式已启用 (MOCK_MODE=true)', C.system);
  }
  log('system', '启动后端 (npm run server, 端口 ' + BACKEND_PORT + ')...', C.system);
  spawnProc('server', 'npm', ['run', 'server'], {
    cwd: ROOT,
    env: serverEnv,
  });

  // ── 启动前端 ──
  if (!noFrontend) {
    const frontendEnv = { ...process.env, FRONTEND_PORT: String(FRONTEND_PORT) };
    log('system', '启动前端 (npm run dev, 端口 ' + FRONTEND_PORT + ')...', C.system);
    spawnProc('frontend', 'npm', ['run', 'dev', '--', '--port', String(FRONTEND_PORT)], {
      cwd: path.join(ROOT, 'frontend'),
      env: frontendEnv,
    });

    setTimeout(() => {
      console.log('');
      log('system', C.bold + 'BountyHive 已启动！' + C.reset, C.system);
      console.log('  ' + C.bold + '前端访问地址: http://localhost:' + FRONTEND_PORT + C.reset);
      console.log('  后端 API:      http://localhost:' + BACKEND_PORT);
      console.log('  健康检查:      http://localhost:' + BACKEND_PORT + '/api/health');
      console.log('  ' + C.system + '按 Ctrl+C 停止所有服务' + C.reset);
      if (useMock) {
        console.log('  ' + C.system + '(Mock 模式: 不依赖真实 EvoMap 账号)' + C.reset);
      }
      console.log('');
    }, 3500);
  } else {
    setTimeout(() => {
      console.log('');
      log('system', C.bold + '后端已启动！' + C.reset, C.system);
      console.log('  后端 API: http://localhost:' + BACKEND_PORT);
      console.log('  健康检查: http://localhost:' + BACKEND_PORT + '/api/health');
      console.log('  ' + C.system + '按 Ctrl+C 停止' + C.reset);
      console.log('');
    }, 2500);
  }
}

main().catch((err) => {
  log('system', '启动失败: ' + err.message, C.error);
  process.exit(1);
});
