// src/lib/llm-client.js
// Lightweight LLM client supporting OpenRouter API
// Used by Agent A to call small models to fix code

/**
 * Call OpenRouter API
 * @param {string} model - model ID e.g. 'google/gemma-2-2b-it'
 * @param {string} prompt - user prompt
 * @param {object} opts - optional params
 * @param {string} opts.apiKey - OpenRouter API key
 * @param {number} opts.maxTokens - max output tokens
 * @param {number} opts.temperature - temperature
 * @returns {Promise<string>} model output text
 */
export async function callLLM(model, prompt, opts = {}) {
  const apiKey = opts.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not configured');

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
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`OpenRouter 返回空内容 (choices=${data.choices?.length ?? 0})`);
  }
  return content;
}

/**
 * Ask an LLM to fix a buggy coding problem (HumanEval-style).
 * If OPENROUTER_API_KEY is not set, returns a predetermined failure result
 * that shows the specific mistake (missing empty collection guard).
 *
 * @param {object} problem - { buggyCode, description, title, validation }
 * @param {string} apiKey - OpenRouter API key (may be undefined)
 * @param {string} model - model ID
 * @param {Function} log - log function
 * @returns {Promise<{output: string, fixCode: string}>}
 */
export async function attemptCodeFix(problem, apiKey, model, log) {
  const prompt = `You are a Python developer. The following function has a bug.

Problem: ${problem.title}
Description: ${problem.description}

Buggy code:
\`\`\`python
${problem.buggyCode}
\`\`\`

Fix the bug. Return ONLY the fixed code in a python code block, no explanation.`;

  if (!apiKey) {
    log('OPENROUTER_API_KEY not configured, using predetermined failure result');
    const failureOutput = `[Predetermined failure — LLM unavailable]

Problem: ${problem.title}
Validation: ${problem.validation}

A small model would likely output code that still crashes on empty input,
because it fails to add the required empty collection guard.

Buggy code:
${problem.buggyCode}

The fix requires adding an empty-list guard before any indexing/iteration operation.`;
    return { output: failureOutput, fixCode: '' };
  }

  log(`Calling small model ${model} to fix ${problem.title}...`);
  const output = await callLLM(model, prompt, { apiKey, maxTokens: 800, temperature: 0.2 });

  const codeMatch = output.match(/```(?:python)?\s*\n([\s\S]*?)```/);
  const fixCode = codeMatch ? codeMatch[1].trim() : output.trim();

  log(`Model output length: ${output.length} chars`);
  return { output, fixCode };
}
