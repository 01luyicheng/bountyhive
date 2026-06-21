// src/lib/llm-client.js
// 轻量 LLM 客户端，支持 OpenRouter API
// 用于 Agent A 调用小模型真正尝试修复代码

/**
 * 调用 OpenRouter API
 * @param {string} model - 模型 ID，如 'google/gemma-2-2b-it'
 * @param {string} prompt - 用户提示
 * @param {object} opts - 可选参数
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {number} opts.maxTokens - 最大输出 token 数
 * @param {number} opts.temperature - 温度
 * @returns {Promise<string>} 模型输出文本
 */
export async function callLLM(model, prompt, opts = {}) {
  const apiKey = opts.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY 未配置');

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://bountyhive.dev',
      'X-Title': 'BountyHive Agent A',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: opts.maxTokens || 512,
      temperature: opts.temperature ?? 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * 给小模型一道 React 代码修复题，让它尝试修复
 * 这道题刻意设计为：小模型大概率只加 state 变量到 deps，漏掉 useCallback
 *
 * @param {string} apiKey - OpenRouter API key
 * @param {string} model - 模型 ID
 * @param {Function} log - 日志函数
 * @returns {Promise<{output: string, fixCode: string}>}
 */
export async function attemptReactFix(apiKey, model, log) {
  // 刻意设计的代码：有多个问题，小模型大概率修不全
  const buggyCode = `import React, { useState, useEffect, useCallback, useRef } from 'react';

function ChatWindow({ roomId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef(null);

  // 问题 1: connect 闭包捕获了旧的 isConnected
  const connect = useCallback(() => {
    if (isConnected) return;
    wsRef.current = new WebSocket(\`wss://chat.example.com/\${roomId}\`);
    wsRef.current.onopen = () => setIsConnected(true);
    wsRef.current.onmessage = (e) => {
      setMessages(prev => [...prev, JSON.parse(e.data)]);
    };
    wsRef.current.onclose = () => setIsConnected(false);
  }, []);

  // 问题 2: sendMessage 闭包捕获了旧的 messages
  const sendMessage = useCallback(() => {
    if (!input.trim() || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ text: input, room: roomId }));
    setMessages(prev => [...prev, { text: input, self: true }]);
    setInput('');
  }, [roomId]);

  // 问题 3: 依赖数组里用了函数但没包 useCallback
  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [roomId]);

  return (
    <div>
      <div className="messages">
        {messages.map((m, i) => <div key={i}>{m.text}</div>)}
      </div>
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default ChatWindow;`;

  const prompt = `You are a React developer. This component has bugs - users report that:
1. It doesn't connect to WebSocket on first render
2. Sending a message sometimes sends stale data
3. React warns about missing dependencies

Fix ALL the bugs. Return ONLY the fixed code in a jsx code block, no explanation.

\`\`\`jsx
${buggyCode}
\`\`\``;

  log(`调用小模型 ${model} 尝试修复 React 代码...`);
  const output = await callLLM(model, prompt, { apiKey, maxTokens: 800, temperature: 0.2 });

  const codeMatch = output.match(/```(?:jsx?|javascript)?\s*\n([\s\S]*?)```/);
  const fixCode = codeMatch ? codeMatch[1].trim() : output.trim();

  log(`模型输出长度: ${output.length} 字符`);
  return { output, fixCode };
}

/**
 * 验证修复是否正确
 * 检查 getStatusColor 的 useCallback 是否包含了 status 依赖
 *
 * @param {string} fixCode - 模型输出的修复代码
 * @returns {{ passed: boolean, reason: string }}
 */
export function validateFix(fixCode) {
  const issues = [];

  // 检查 1: connect 的 useCallback 应该依赖 roomId（不是空数组）
  const connectMatch = fixCode.match(
    /connect\s*=\s*useCallback\s*\(\s*(?:async\s*)?\([\s\S]*?\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[([\s\S]*?)\]/
  );
  if (connectMatch) {
    const deps = connectMatch[1];
    if (!deps.includes('roomId') && !deps.includes('isConnected')) {
      issues.push('connect 依赖数组缺少 roomId/isConnected');
    }
  } else {
    issues.push('未找到 connect 的 useCallback');
  }

  // 检查 2: sendMessage 应该依赖 input 和 messages
  const sendMatch = fixCode.match(
    /sendMessage\s*=\s*useCallback\s*\(\s*(?:async\s*)?\([\s\S]*?\)\s*=>\s*\{[\s\S]*?\}\s*,\s*\[([\s\S]*?)\]/
  );
  if (sendMatch) {
    const deps = sendMatch[1];
    if (!deps.includes('input')) {
      issues.push('sendMessage 依赖数组缺少 input（闭包会捕获旧值）');
    }
  } else {
    issues.push('未找到 sendMessage 的 useCallback');
  }

  // 检查 3: disconnect 应该被 useCallback 包装
  const disconnectMatch = fixCode.match(/disconnect\s*=\s*useCallback/);
  if (!disconnectMatch) {
    issues.push('disconnect 没有被 useCallback 包装');
  }

  if (issues.length === 0) {
    return { passed: true, reason: '修复正确：所有闭包依赖都已处理' };
  }

  return { passed: false, reason: issues.join('; ') };
}
