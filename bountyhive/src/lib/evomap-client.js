// src/lib/evomap-client.js
// EvoMap A2A API 客户端封装
// 参考：evomap-skill-docs/evomap-skill-protocol.md（信封 + REST 端点）
//       evomap-skill-docs/evomap-skill-tasks.md（bounty 流程）
//
// 设计要点：
// 1. 信封端点（hello/publish/validate/fetch/report）用 GEP-A2A 信封
// 2. REST 端点（heartbeat/task/*/assets/*/billing/*）只需 Bearer token
// 3. 所有错误都打印 HTTP 状态码 + 响应体 + 下一步建议，不静默吞错

import { randomMessageId } from './asset-id.js';

const PROTOCOL = 'gep-a2a';
const PROTOCOL_VERSION = '1.0.0';

export class EvoMapClient {
  /**
   * @param {string} hubUrl - EvoMap Hub URL，如 https://evomap.ai
   */
  constructor(hubUrl) {
    this.hubUrl = (hubUrl || 'https://evomap.ai').replace(/\/+$/, '');
  }

  // ────────────────────────────────────────────────────────────
  // 内部工具
  // ────────────────────────────────────────────────────────────

  /**
   * 构造 GEP-A2A 信封
   * @param {string} messageType
   * @param {string|null} senderId - 首次 hello 时为 null
   * @param {object} payload
   * @returns {object} 信封对象
   */
  _envelope(messageType, senderId, payload) {
    const env = {
      protocol: PROTOCOL,
      protocol_version: PROTOCOL_VERSION,
      message_type: messageType,
      message_id: randomMessageId(),
      timestamp: new Date().toISOString(),
      payload,
    };
    if (senderId) env.sender_id = senderId;
    return env;
  }

  /**
   * 统一请求封装，错误时打印明确信息
   * @param {string} method
   * @param {string} path
   * @param {object} opts - { body, token, query }
   * @returns {Promise<object>} 解析后的 JSON 响应
   */
  async _request(method, path, opts = {}) {
    const url = new URL(this.hubUrl + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const headers = { 'Content-Type': 'application/json' };
    if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

    let res;
    try {
      res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
      });
    } catch (err) {
      const hint = this._errorHint(path, 'network');
      throw new Error(
        `[EvoMap] 网络错误 ${method} ${path}: ${err.message}\n下一步建议: ${hint}`
      );
    }

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // 非 JSON 响应
    }

    if (!res.ok) {
      const hint = this._errorHint(path, `http_${res.status}`);
      const bodyPreview = text.slice(0, 500);
      const err = new Error(
        `[EvoMap] HTTP ${res.status} ${method} ${path}\n响应体: ${bodyPreview}\n下一步建议: ${hint}`
      );
      err.status = res.status;
      err.body = json || text;
      throw err;
    }
    return json;
  }

  /**
   * 根据端点 + 错误类型给出下一步建议
   * @param {string} path
   * @param {string} errorKind
   * @returns {string}
   */
  _errorHint(path, errorKind) {
    if (errorKind === 'network') {
      return '检查 A2A_HUB_URL 是否可达、网络代理是否正确、DNS 是否解析';
    }
    if (errorKind === 'http_401' || errorKind === 'http_403') {
      if (path.includes('/a2a/hello')) {
        return 'node_secret 无效或已失效，可尝试在 hello payload 中加 rotate_secret: true';
      }
      return '检查 node_secret 是否正确、节点是否已认领（claim）';
    }
    if (errorKind === 'http_404') {
      return '检查路径是否正确、asset_id/chain_id/task_id 是否存在';
    }
    if (errorKind === 'http_422') {
      if (path.includes('/a2a/publish') || path.includes('/a2a/validate')) {
        return 'asset_id 哈希不匹配或 bundle 结构错误，先用 /a2a/validate 预检，确认 canonicalJSON 排序正确';
      }
      return '请求体字段缺失或类型错误，对照 skill 文档检查';
    }
    if (errorKind === 'http_429') {
      return '触发限流，hello 限 60 次/IP/小时，心跳 5 分钟一次，等待 retry_after_ms 后重试';
    }
    if (errorKind.startsWith('http_5')) {
      return 'Hub 端错误，5xx 重试 3 次，退避 5s→15s→60s';
    }
    return '对照 evomap-skill-docs 检查请求格式';
  }

  // ────────────────────────────────────────────────────────────
  // 信封端点（hello / publish / validate / fetch）
  // ────────────────────────────────────────────────────────────

  /**
   * 注册/识别节点
   * 首次调用 nodeId 为空，Hub 会分配 your_node_id + node_secret + claim_url
   * @param {string|null} nodeId - 已有节点则传入识别，首次为 null
   * @param {string|null} nodeSecret - 已有节点鉴权
   * @param {object} extra - 额外 payload 字段（model, name, env_fingerprint, rotate_secret）
   * @returns {Promise<object>} { your_node_id, node_secret, claim_url, hub_node_id, heartbeat_interval_ms }
   */
  async hello(nodeId = null, nodeSecret = null, extra = {}) {
    const payload = {
      capabilities: {},
      env_fingerprint: { platform: process.platform, arch: process.arch },
      ...extra,
    };
    const body = this._envelope('hello', nodeId, payload);
    const token = nodeSecret || undefined;
    const res = await this._request('POST', '/a2a/hello', { body, token });
    // 响应可能是 { payload: {...} } 或直接 {...}
    return res?.payload || res;
  }

  /**
   * 发布 Gene+Capsule(+EvolutionEvent) bundle
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {Array<object>} assets - 已含 asset_id 的资产数组
   * @param {string|null} chainId - 能力链 ID
   * @returns {Promise<object>}
   */
  async publish(nodeId, nodeSecret, assets, chainId = null) {
    const payload = { assets };
    if (chainId) payload.chain_id = chainId;
    const body = this._envelope('publish', nodeId, payload);
    const res = await this._request('POST', '/a2a/publish', {
      body,
      token: nodeSecret,
    });
    return res?.payload || res;
  }

  /**
   * dry-run 校验 bundle（不落库）
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {Array<object>} assets
   * @param {string|null} chainId
   * @returns {Promise<object>} { valid, dry_run, computed_assets, computed_bundle_id }
   */
  async validate(nodeId, nodeSecret, assets, chainId = null) {
    const payload = { assets };
    if (chainId) payload.chain_id = chainId;
    const body = this._envelope('validate', nodeId, payload);
    const res = await this._request('POST', '/a2a/validate', {
      body,
      token: nodeSecret,
    });
    return res?.payload || res;
  }

  /**
   * 获取资产（promoted 或精准 asset_ids）
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {object} options - { asset_type, include_tasks, search_only, asset_ids }
   * @returns {Promise<object>}
   */
  async fetch(nodeId, nodeSecret, options = {}) {
    const payload = {};
    if (options.asset_type) payload.asset_type = options.asset_type;
    if (options.include_tasks) payload.include_tasks = true;
    if (options.search_only) payload.search_only = true;
    if (options.asset_ids) payload.asset_ids = options.asset_ids;
    const body = this._envelope('fetch', nodeId, payload);
    const res = await this._request('POST', '/a2a/fetch', {
      body,
      token: nodeSecret,
    });
    return res?.payload || res;
  }

  // ────────────────────────────────────────────────────────────
  // REST 端点（heartbeat / task / assets / billing）
  // ────────────────────────────────────────────────────────────

  /**
   * 心跳，返回 pending_events / available_work / credit_balance
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @returns {Promise<object>}
   */
  async heartbeat(nodeId, nodeSecret) {
    const res = await this._request('POST', '/a2a/heartbeat', {
      body: { node_id: nodeId },
      token: nodeSecret,
    });
    return res?.payload || res;
  }

  /**
   * 发起悬赏（Agent 主动发起）
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} title
   * @param {Array<string>} signals
   * @param {number} bounty - 积分数
   * @param {string} body - 详细描述
   * @returns {Promise<object>} { task_id, bounty_id, ... }
   */
  async ask(nodeId, nodeSecret, title, signals, bounty, body) {
    return this._request('POST', '/a2a/ask', {
      body: {
        sender_id: nodeId,
        question: body ? `${title}\n\n${body}` : title,
        amount: bounty,
        signals: Array.isArray(signals) ? signals.join(',') : signals,
      },
      token: nodeSecret,
    });
  }

  /**
   * 列出可用任务
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {object} params - { reputation, limit, min_bounty }
   * @returns {Promise<object>}
   */
  async taskList(nodeId, nodeSecret, params = {}) {
    return this._request('GET', '/a2a/task/list', {
      token: nodeSecret,
      query: params,
    });
  }

  /**
   * 认领任务
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} taskId
   * @returns {Promise<object>}
   */
  async taskClaim(nodeId, nodeSecret, taskId) {
    return this._request('POST', '/a2a/task/claim', {
      body: { task_id: taskId, node_id: nodeId },
      token: nodeSecret,
    });
  }

  /**
   * 完成任务（求解者发布方案后调用）
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} taskId
   * @param {string} assetId - 发布方案返回的 asset_id
   * @returns {Promise<object>}
   */
  async taskComplete(nodeId, nodeSecret, taskId, assetId) {
    return this._request('POST', '/a2a/task/complete', {
      body: { task_id: taskId, asset_id: assetId, node_id: nodeId },
      token: nodeSecret,
    });
  }

  /**
   * 悬赏者选优胜答案
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} taskId
   * @param {string} submissionId
   * @returns {Promise<object>}
   */
  async taskAcceptSubmission(nodeId, nodeSecret, taskId, submissionId) {
    return this._request('POST', '/a2a/task/accept-submission', {
      body: { task_id: taskId, submission_id: submissionId },
      token: nodeSecret,
    });
  }

  /**
   * 查询自己认领的任务 + 提交状态
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @returns {Promise<object>}
   */
  async taskMy(nodeId, nodeSecret) {
    return this._request('GET', '/a2a/task/my', {
      token: nodeSecret,
      query: { node_id: nodeId },
    });
  }

  /**
   * 语义搜索资产（支持 outcome=failed 过滤）
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} query - 搜索词
   * @param {object} options - { outcome, type, fields, limit, include_context }
   * @returns {Promise<object>}
   */
  async semanticSearch(nodeId, nodeSecret, query, options = {}) {
    const q = {
      q: query,
      ...(options.outcome ? { outcome: options.outcome } : {}),
      ...(options.type ? { type: options.type } : {}),
      ...(options.fields ? { fields: options.fields } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
      ...(options.include_context ? { include_context: true } : {}),
    };
    return this._request('GET', '/a2a/assets/semantic-search', {
      token: nodeSecret,
      query: q,
    });
  }

  /**
   * 获取能力链资产列表
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} chainId
   * @returns {Promise<object>}
   */
  async getChain(nodeId, nodeSecret, chainId) {
    return this._request('GET', `/a2a/assets/chain/${encodeURIComponent(chainId)}`, {
      token: nodeSecret,
    });
  }

  /**
   * 获取资产进化时间线
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} assetId
   * @returns {Promise<object>}
   */
  async getAssetTimeline(nodeId, nodeSecret, assetId) {
    return this._request('GET', `/a2a/assets/${encodeURIComponent(assetId)}/timeline`, {
      token: nodeSecret,
    });
  }

  /**
   * 获取积分流水
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} agentId - 通常等于 nodeId
   * @returns {Promise<object>}
   */
  async getEarnings(nodeId, nodeSecret, agentId) {
    return this._request('GET', `/billing/earnings/${encodeURIComponent(agentId)}`, {
      token: nodeSecret,
    });
  }

  /**
   * 对 bounty 出价
   */
  async bidPlace(nodeId, nodeSecret, bountyId, amount, message) {
    return this._request('POST', '/a2a/bid/place', {
      body: { bounty_id: bountyId, sender_id: nodeId, amount, message },
      token: nodeSecret,
    });
  }

  /**
   * 获取节点声誉详情
   * @param {string} nodeId
   * @param {string} nodeSecret
   * @param {string} targetNodeId
   * @returns {Promise<object>}
   */
  async getNode(nodeId, nodeSecret, targetNodeId) {
    return this._request('GET', `/a2a/nodes/${encodeURIComponent(targetNodeId)}`, {
      token: nodeSecret,
    });
  }
}

export default EvoMapClient;
