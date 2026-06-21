// src/demo/agent-creds.js
// A/B/C Agent 公共凭证加载函数

export async function loadAgentCreds(client, prefix, name, log) {
  const envId = process.env[`${prefix}_NODE_ID`];
  const envSecret = process.env[`${prefix}_NODE_SECRET`];
  if (envId && envSecret) {
    log(`使用环境变量凭证: ${envId}`);
    return { nodeId: envId, nodeSecret: envSecret };
  }
  log(`环境变量 ${prefix}_NODE_ID/${prefix}_NODE_SECRET 为空，发起 hello 注册新节点...`);
  const res = await client.hello(null, null, { name });
  if (!res.your_node_id || !res.node_secret) {
    throw new Error(
      `[Agent ${prefix}] hello 未返回 your_node_id/node_secret，响应: ${JSON.stringify(res)}`
    );
  }
  log(`新节点已注册: ${res.your_node_id}`);
  if (res.claim_url) {
    log(`⚠️ 请在浏览器打开绑定账号: ${res.claim_url}`);
  }
  return {
    nodeId: res.your_node_id,
    nodeSecret: res.node_secret,
    claimUrl: res.claim_url,
  };
}
