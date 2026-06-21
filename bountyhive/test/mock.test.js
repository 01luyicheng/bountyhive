// test/mock-test.js
// Mock 模式测试 - 验证 mock 数据生成器 + mock-orchestrator 的正确性
//
// 使用 Node.js 内置 node:test 框架，不引入新依赖
// 测试策略:
//   - 验证 mock 数据结构与字段（asset_id 格式、溯源关系、outcome 过滤等）
//   - 验证 mock-orchestrator 能完整跑完所有阶段
//   - 不启动 server，直接调用模块函数
//
// 运行: node --test test/mock-test.js

import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  mockAgents,
  mockBounties,
  mockCapsules,
  mockChain,
  mockEarnings,
  getMockAgents,
  getMockBounties,
  getMockCapsules,
  getMockChain,
  getMockEarnings,
  MOCK_NODE_IDS,
  MOCK_TASK_ID,
  MOCK_SUBMISSION_ID,
  MOCK_ASSETS,
} from '../src/lib/mock-data.js';
import { runMockOrchestrator } from '../src/demo/mock-orchestrator.js';
import { CHAIN_ID } from '../src/demo/agent-templates.js';

// asset_id 格式正则：sha256:<64 hex>
const ASSET_ID_RE = /^sha256:[0-9a-f]{64}$/;

describe('Mock 数据 - 基础结构', () => {
  test('mockAgents 长度为 3，包含 A/B/C', () => {
    assert.strictEqual(mockAgents.length, 3, 'mockAgents 应有 3 个节点');
    const labels = mockAgents.map((a) => a.label).sort();
    assert.deepStrictEqual(labels, ['A', 'B', 'C'], '应包含 A/B/C 三个标签');
  });

  test('mockAgents 字段完整（node_id, online, reputation, model）', () => {
    for (const a of mockAgents) {
      assert.ok(a.label, 'label 应存在');
      assert.ok(a.node_id, 'node_id 应存在');
      assert.strictEqual(typeof a.online, 'boolean', 'online 应为 boolean');
      assert.strictEqual(typeof a.reputation, 'number', 'reputation 应为 number');
      assert.ok(a.model, 'model 应存在');
    }
  });

  test('mockBounties 包含 A 发起的悬赏', () => {
    assert.ok(mockBounties.length >= 1, '应至少有 1 条悬赏');
    const b = mockBounties[0];
    assert.strictEqual(b.task_id, MOCK_TASK_ID, `task_id 应为 ${MOCK_TASK_ID}`);
    assert.ok(b.title, 'title 应存在');
    assert.ok(Array.isArray(b.signals), 'signals 应为数组');
    assert.strictEqual(typeof b.bounty, 'number', 'bounty 应为 number');
    assert.ok(b.status, 'status 应存在');
  });
});

describe('Mock 数据 - Capsule 溯源关系', () => {
  test('mockCapsules 包含 1 个 failed + 2 个 success', () => {
    assert.strictEqual(mockCapsules.length, 3, '应有 3 个 Capsule');
    const failed = mockCapsules.filter((c) => c.outcome?.status === 'failed');
    const success = mockCapsules.filter((c) => c.outcome?.status === 'success');
    assert.strictEqual(failed.length, 1, '应有 1 个 failed Capsule');
    assert.strictEqual(success.length, 2, '应有 2 个 success Capsule');
  });

  test("getMockCapsules('failed') 只返回 failed Capsule", () => {
    const items = getMockCapsules('failed');
    assert.strictEqual(items.length, 1, 'failed 过滤应返回 1 条');
    assert.strictEqual(items[0].outcome.status, 'failed', '应为 failed 状态');
  });

  test("getMockCapsules('success') 只返回 success Capsule", () => {
    const items = getMockCapsules('success');
    assert.strictEqual(items.length, 2, 'success 过滤应返回 2 条');
    for (const c of items) {
      assert.strictEqual(c.outcome.status, 'success', '应为 success 状态');
    }
  });

  test('mockCapsules 字段完整（outcome, confidence, source_type 等）', () => {
    for (const c of mockCapsules) {
      assert.ok(c.asset_id, 'asset_id 应存在');
      assert.ok(c.outcome, 'outcome 应存在');
      assert.ok('confidence' in c, 'confidence 应存在');
      assert.ok('source_type' in c, 'source_type 应存在');
    }
  });

  test("B 的 Capsule reused_asset_id 指向 A 的 capsule_id", () => {
    const capsuleA = mockCapsules.find((c) => c.outcome.status === 'failed');
    const capsuleB = mockCapsules.find(
      (c) =>
        c.outcome.status === 'success' &&
        c.reused_asset_id &&
        c.reused_asset_id === capsuleA?.asset_id
    );
    assert.ok(capsuleA, '应找到 A 的 failed Capsule');
    assert.ok(capsuleB, '应找到 B 的 success Capsule');
    assert.strictEqual(
      capsuleB.reused_asset_id,
      capsuleA.asset_id,
      'B 的 reused_asset_id 应指向 A 的 asset_id'
    );
    assert.strictEqual(
      capsuleB.parent,
      capsuleA.asset_id,
      'B 的 parent 应指向 A 的 asset_id'
    );
  });

  test("C 的 Capsule reused_asset_id 指向 B 的 capsule_id", () => {
    const capsuleB = mockCapsules.find(
      (c) =>
        c.outcome.status === 'success' &&
        c.parent &&
        mockCapsules.find((a) => a.outcome.status === 'failed')?.asset_id === c.parent
    );
    const capsuleC = mockCapsules.find(
      (c) =>
        c.outcome.status === 'success' &&
        c.reused_asset_id &&
        c.reused_asset_id === capsuleB?.asset_id
    );
    assert.ok(capsuleB, '应找到 B 的 success Capsule');
    assert.ok(capsuleC, '应找到 C 的 success Capsule');
    assert.strictEqual(
      capsuleC.reused_asset_id,
      capsuleB.asset_id,
      'C 的 reused_asset_id 应指向 B 的 asset_id'
    );
    assert.strictEqual(
      capsuleC.parent,
      capsuleB.asset_id,
      'C 的 parent 应指向 B 的 asset_id'
    );
  });
});

describe('Mock 数据 - 能力链', () => {
  test('mockChain 顶层 chain_id 正确，单个资产不含 chain_id', () => {
    assert.strictEqual(mockChain.chain_id, CHAIN_ID, `chain_id 应为 ${CHAIN_ID}`);
    assert.strictEqual(mockChain.assets.length, 3, '应有 3 个资产');
    for (const a of mockChain.assets) {
      assert.strictEqual(
        'chain_id' in a,
        false,
        'chain_id 为 payload 级字段，不应出现在单个资产中'
      );
    }
  });

  test('mockChain 资产顺序为 A→B→C', () => {
    const agents = mockChain.assets.map((a) => a.agent);
    assert.deepStrictEqual(agents, ['A', 'B', 'C'], '资产顺序应为 A→B→C');
  });

  test('mockChain 中 B 溯源 A，C 溯源 B', () => {
    const [a, b, c] = mockChain.assets;
    assert.strictEqual(b.reused_asset_id, a.asset_id, 'B 应溯源 A');
    assert.strictEqual(c.reused_asset_id, b.asset_id, 'C 应溯源 B');
  });
});

describe('Mock 数据 - asset_id 格式', () => {
  test('所有 Capsule asset_id 格式为 sha256:<64 hex>', () => {
    for (const c of mockCapsules) {
      assert.match(
        c.asset_id,
        ASSET_ID_RE,
        `asset_id ${c.asset_id} 应匹配 sha256:<64 hex>`
      );
    }
  });

  test('所有 Gene asset_id 格式为 sha256:<64 hex>', () => {
    const genes = [MOCK_ASSETS.genes.a, MOCK_ASSETS.genes.b, MOCK_ASSETS.genes.c];
    for (const g of genes) {
      assert.match(
        g.asset_id,
        ASSET_ID_RE,
        `asset_id ${g.asset_id} 应匹配 sha256:<64 hex>`
      );
    }
  });

  test('mockChain 中所有 asset_id 格式正确', () => {
    for (const a of mockChain.assets) {
      assert.match(
        a.asset_id,
        ASSET_ID_RE,
        `asset_id ${a.asset_id} 应匹配 sha256:<64 hex>`
      );
    }
  });
});

describe('Mock 数据 - 深拷贝隔离', () => {
  test('getMockAgents 返回深拷贝，修改不影响内部数据', () => {
    const a1 = getMockAgents();
    a1[0].reputation = 999;
    a1[0].label = 'X';
    const a2 = getMockAgents();
    assert.notStrictEqual(a2[0].reputation, 999, '修改不应影响内部数据');
    assert.notStrictEqual(a2[0].label, 'X', '修改不应影响内部数据');
  });

  test('getMockCapsules 返回深拷贝，修改不影响内部数据', () => {
    const c1 = getMockCapsules();
    c1[0].confidence = 0.001;
    const c2 = getMockCapsules();
    assert.notStrictEqual(c2[0].confidence, 0.001, '修改不应影响内部数据');
  });

  test('getMockChain 返回深拷贝，修改不影响内部数据', () => {
    const ch1 = getMockChain();
    ch1.assets[0].agent = 'Z';
    ch1.chain_id = 'fake_chain';
    const ch2 = getMockChain();
    assert.notStrictEqual(ch2.assets[0].agent, 'Z', '修改不应影响内部数据');
    assert.notStrictEqual(ch2.chain_id, 'fake_chain', '修改不应影响内部数据');
  });
});

describe('Mock 数据 - 积分流水', () => {
  test('getMockEarnings：A/B 返回非空数组，C 返回空数组', () => {
    for (const k of ['a', 'b']) {
      const list = getMockEarnings(MOCK_NODE_IDS[k]);
      assert.ok(Array.isArray(list), `${k} 的流水应为数组`);
      assert.ok(list.length >= 1, `${k} 的流水应至少有 1 条`);
    }
    const cList = getMockEarnings(MOCK_NODE_IDS.c);
    assert.deepStrictEqual(cList, [], 'C 在本次 Demo 中未产生收益');
  });

  test('A 的积分流水包含 B fetch A 的 5 积分', () => {
    const list = getMockEarnings(MOCK_NODE_IDS.a);
    const fetchFromB = list.find(
      (e) => e.from_node === MOCK_NODE_IDS.b && e.reason.includes('fetch reward')
    );
    assert.ok(fetchFromB, 'A 应有来自 B 的 fetch 奖励');
    assert.strictEqual(fetchFromB.amount, 5, 'B fetch A 时 A 应获 5 积分');
  });

  test('B 的积分流水包含 C fetch B 的 5 积分', () => {
    const list = getMockEarnings(MOCK_NODE_IDS.b);
    const fetchFromC = list.find(
      (e) => e.from_node === MOCK_NODE_IDS.c && e.reason.includes('fetch reward')
    );
    assert.ok(fetchFromC, 'B 应有来自 C 的 fetch 奖励');
    assert.strictEqual(fetchFromC.amount, 5, 'C fetch B 时 B 应获 5 积分');
  });

  test('B 的积分流水包含完成 A 悬赏的 50 积分 bounty 奖励', () => {
    const list = getMockEarnings(MOCK_NODE_IDS.b);
    const bountyReward = list.find(
      (e) => e.from_node === MOCK_NODE_IDS.a && e.reason.includes('bounty completion')
    );
    assert.ok(bountyReward, 'B 应有完成 bounty 的奖励');
    assert.strictEqual(bountyReward.amount, 50, 'B 完成 A 的悬赏应获 50 积分');
  });

  test('未知 agentId 返回空数组', () => {
    const list = getMockEarnings('node_unknown_xxx');
    assert.deepStrictEqual(list, [], '未知 agent 应返回空数组');
  });
});

describe('Mock Orchestrator - 阶段推进', () => {
  test('runMockOrchestrator 能完整跑完所有阶段', async () => {
    const phases = [];
    const logSink = [];
    const result = await runMockOrchestrator({
      logSink,
      onPhase: (p) => phases.push(p),
    });

    // 验证返回结果结构
    assert.ok(result.started_at, '应有 started_at');
    assert.ok(result.completed_at, '应有 completed_at');
    assert.strictEqual(result.phase, 'done', '最终阶段应为 done');
    assert.strictEqual(result.mock_mode, true, 'mock_mode 应为 true');
    assert.ok(result.a, '应有 a 结果');
    assert.ok(result.b, '应有 b 结果');
    assert.ok(result.c, '应有 c 结果');
    assert.ok(result.accept, '应有 accept 结果');
    assert.ok(result.chain, '应有 chain 结果');
    assert.ok(result.earnings, '应有 earnings 结果');

    // 验证阶段序列（9 个阶段）
    const expectedPhases = [
      'agent-a-hello',
      'agent-a-ask-publish',
      'agent-b-hello',
      'agent-b-claim-solve',
      'agent-a-accept',
      'agent-c-hello',
      'agent-c-reuse',
      'chain-earnings',
      'done',
    ];
    assert.deepStrictEqual(
      phases,
      expectedPhases,
      '阶段序列应与预期一致'
    );

    // 验证 completed_steps
    assert.ok(
      result.completed_steps.includes('agent-a'),
      '应完成 agent-a'
    );
    assert.ok(
      result.completed_steps.includes('agent-b'),
      '应完成 agent-b'
    );
    assert.ok(
      result.completed_steps.includes('agent-c'),
      '应完成 agent-c'
    );
    assert.ok(
      result.completed_steps.includes('accept-submission'),
      '应完成 accept-submission'
    );
  });

  test('runMockOrchestrator 的 logSink 收集到至少 9 条日志', async () => {
    const logSink = [];
    await runMockOrchestrator({ logSink, onPhase: () => {} });

    assert.ok(
      logSink.length >= 9,
      `应至少收集 9 条日志，实际 ${logSink.length} 条`
    );

    // 每条日志应有 ts, level, msg 字段
    for (const log of logSink) {
      assert.ok(log.ts, '日志应有 ts');
      assert.ok(log.level, '日志应有 level');
      assert.ok(log.msg, '日志应有 msg');
    }

    // 应包含失败独白相关日志
    const hasMonologue = logSink.some((l) => l.msg.includes('失败独白'));
    assert.ok(hasMonologue, '应包含失败独白日志');

    // 应包含点题句相关日志
    const hasTagline = logSink.some((l) => l.msg.includes('点题'));
    assert.ok(hasTagline, '应包含点题日志');

    // 应包含 submission_id 日志
    const hasSubmission = logSink.some(
      (l) => l.msg.includes(MOCK_SUBMISSION_ID)
    );
    assert.ok(hasSubmission, '应包含 submission_id 日志');
  });

  test('runMockOrchestrator 结果中 a/b/c/chain/earnings 用 mock 数据填充', async () => {
    const result = await runMockOrchestrator({ logSink: [], onPhase: () => {} });

    // a 的 capsule_id 应与 MOCK_ASSETS 一致
    assert.strictEqual(
      result.a.capsule_id,
      MOCK_ASSETS.capsules.a.asset_id,
      'a.capsule_id 应与 mock 数据一致'
    );
    assert.strictEqual(result.a.task_id, MOCK_TASK_ID, 'a.task_id 应为 mock task_id');

    // b 的 capsule_id 应与 MOCK_ASSETS 一致
    assert.strictEqual(
      result.b.capsule_id,
      MOCK_ASSETS.capsules.b.asset_id,
      'b.capsule_id 应与 mock 数据一致'
    );
    assert.strictEqual(result.b.submission_id, MOCK_SUBMISSION_ID, 'b.submission_id 应为 mock submission_id');

    // c 的 capsule_id 应与 MOCK_ASSETS 一致
    assert.strictEqual(
      result.c.capsule_id,
      MOCK_ASSETS.capsules.c.asset_id,
      'c.capsule_id 应与 mock 数据一致'
    );

    // chain 应有 3 个资产
    assert.strictEqual(result.chain.assets.length, 3, 'chain 应有 3 个资产');

    // earnings 应有 A 的流水
    assert.ok(Array.isArray(result.earnings.entries), 'earnings.entries 应为数组');
    assert.ok(result.earnings.entries.length >= 1, 'A 应至少有 1 条流水');
  });
});
