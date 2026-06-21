#!/usr/bin/env node
// scripts/stop-all.js
// 停止所有 BountyHive 服务（默认占用 3001 和 5173 端口的进程）
// 可用 PORT / FRONTEND_PORT 环境变量覆盖
//
// 跨平台实现:
//   - 用 net 模块检测端口是否被占用
//   - 用 OS 命令查找占用端口的 PID（Windows: netstat, Unix: lsof）
//   - 用 process.kill / taskkill 终止进程

import { execSync } from 'node:child_process';
import net from 'node:net';

const PORTS = [
  parseInt(process.env.PORT || '3001', 10),
  parseInt(process.env.FRONTEND_PORT || '5173', 10),
];

const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m',
};

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

function findPidsOnPort(port) {
  try {
    if (process.platform === 'win32') {
      // Windows: netstat -ano | findstr :PORT
      const output = execSync('netstat -ano -p tcp | findstr :' + port + ' ', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const pids = new Set();
      for (const line of output.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;
        const localAddr = parts[1];
        const state = parts[3];
        const pid = parts[4];
        // 匹配 LISTENING 状态的端口
        if (localAddr && localAddr.endsWith(':' + port) && state === 'LISTENING') {
          pids.add(pid);
        }
      }
      return [...pids];
    } else {
      // Unix: lsof -ti:PORT (返回 PID 列表)
      const output = execSync('lsof -ti:' + port, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      return output
        .trim()
        .split('\n')
        .filter(Boolean);
    }
  } catch (e) {
    return [];
  }
}

function sleepSync(ms) {
  try {
    // 跨平台同步等待，避免引入额外依赖
    if (process.platform === 'win32') {
      execSync('powershell -Command Start-Sleep -Milliseconds ' + ms, { stdio: 'ignore' });
    } else {
      execSync('sleep ' + (ms / 1000), { stdio: 'ignore' });
    }
  } catch (e) {
    // ignore
  }
}

function killPid(pid) {
  try {
    if (process.platform === 'win32') {
      // Windows：先尝试优雅关闭（taskkill /T 不带 /F，发送 WM_CLOSE）
      try {
        execSync('taskkill /pid ' + pid + ' /T', { stdio: 'ignore', timeout: 3000 });
      } catch (e) {
        // 进程可能已退出或不支持优雅关闭，继续强制结束
      }
      sleepSync(1500);
      // 强制结束残留进程
      try {
        execSync('taskkill /pid ' + pid + ' /T /F', { stdio: 'ignore' });
      } catch (e) {
        // ignore
      }
      return true;
    }
    // Unix：先 SIGTERM，等待后 SIGKILL
    const numericPid = parseInt(pid, 10);
    process.kill(numericPid, 'SIGTERM');
    sleepSync(1500);
    try {
      process.kill(numericPid, 'SIGKILL');
    } catch (e) {
      // 进程已退出
    }
    return true;
  } catch (e) {
    return false;
  }
}

async function main() {
  console.log(C.yellow + 'BountyHive 停止服务...' + C.reset + '\n');
  let stopped = 0;
  let notRunning = 0;
  const killedList = [];

  for (const port of PORTS) {
    const inUse = await isPortInUse(port);
    if (!inUse) {
      console.log('  ' + C.yellow + '端口 ' + port + C.reset + ': 未被占用');
      notRunning++;
      continue;
    }
    const pids = findPidsOnPort(port);
    if (pids.length === 0) {
      console.log('  ' + C.yellow + '端口 ' + port + C.reset + ': 被占用但未找到 PID（可能权限不足）');
      continue;
    }
    for (const pid of pids) {
      const ok = killPid(pid);
      const tag = ok ? C.green + '已终止' + C.reset : C.red + '终止失败' + C.reset;
      console.log('  ' + C.yellow + '端口 ' + port + C.reset + ' PID ' + pid + ': ' + tag);
      if (ok) {
        stopped++;
        killedList.push({ port, pid });
      }
    }
  }

  if (stopped === 0 && notRunning === PORTS.length) {
    console.log('\n' + C.green + '无运行中的 BountyHive 进程' + C.reset);
  } else {
    console.log('\n' + C.green + '完成' + C.reset + ': 终止 ' + stopped + ' 个进程, ' + notRunning + ' 个端口未运行。');
    if (killedList.length > 0) {
      console.log(C.green + '已终止进程列表:' + C.reset);
      for (const k of killedList) {
        console.log('  - PID ' + k.pid + ' (端口 ' + k.port + ')');
      }
    }
  }
}

main();
