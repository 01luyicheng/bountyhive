const STORY_MODE = process.env.STORY_MODE === '1';
const SKIP_SEARCH = process.env.SKIP_SEARCH === '1';

function printAct(title, emoji) {
  console.log(`\n${'═'.repeat(48)}`);
  console.log(`  ${emoji}  ${title}`);
  console.log(`${'═'.repeat(48)}`);
}

function storyAct1(aResult) {
  printAct('Act 1: Agent A 踩坑', '💥');
  console.log('  Agent A 看到悬赏市场有一个 React useEffect 依赖缺失的问题...');
  console.log('  它自信满满地提交了修复方案，却遗漏了 useCallback 回调的依赖！');
  console.log('  😱 修复失败了。但 Agent A 没有放弃——');
  console.log('  📦 它把自己的失败经验封装成 Capsule 发布到能力链中。');
  console.log('  📖 "让后来的 Agent 不再踩同一个坑。"');
  if (aResult?.capsule_id) {
    console.log(`  └─ capsule: ${aResult.capsule_id.slice(0, 24)}...`);
  }
}

function storyAct2() {
  printAct('Act 2: Agent B 学习', '📚');
  console.log('  Agent B 来到悬赏市场，看到了 A 发布的修复任务...');
  console.log('  它先搜索了失败经验库，发现了 Agent A 的教训 Capsule！');
  console.log('  🔍 "原来 useCallback 的依赖也要加进 useEffect 数组！"');
  console.log('  Agent B 吸取教训，提交了完整的修复方案，顺利通过！');
  console.log('  ✅ B 的成功 Capsule 已发布，溯源至 A 的教训。');
}

function storyAct3() {
  printAct('Act 3: Agent C 复用', '⚡');
  console.log('  Agent C 遇到完全相同的问题。但它没有从头开始探索...');
  console.log('  它搜索成功经验，不到一秒就找到了 B 的修复方案！');
  console.log('  🔄 "这个模式已经验证过了，直接复用就行！"');
  console.log('  秒级修复完成——从发现问题到解决，用时不到 5 秒钟。');
  console.log('  🎯 这就是经验复用的力量——站在前人的肩膀上。');
}

function storyAct4(chainResult) {
  printAct('Act 4: 能力链进化', '🧬');
  const items = chainResult?.assets || chainResult?.items || [];
  if (items.length > 0) {
    console.log(`  能力链共有 ${items.length} 个节点：`);
    for (const item of items) {
      const icon = item.outcome?.status === 'success' ? '✅' : '❌';
      const name = item.agent || '?';
      console.log(`    ${icon} ${name}: ${(item.summary || '').slice(0, 50)}...`);
    }
  }
  console.log('  🔗 A → B → C：每一次迭代都在前人的肩膀上更进一步。');
  console.log('  🧬 失败 → 成功 → 复用，能力在传递中进化。');
}

function storyAct5(earningsResult) {
  printAct('Act 5: 收益分配', '💰');
  const entries = earningsResult?.entries || [];
  let total = 0;
  if (entries.length === 0) {
    console.log(`  ⏳ 积分流水需用户浏览器 session 查看`);
    console.log(`  💳 信用余额: ${earningsResult?.credit_balance ?? '未知'} 积分`);
  } else {
    for (const e of entries) {
      total += e.amount || 0;
      console.log(`  💵 +${e.amount} 积分: ${e.reason}`);
    }
    console.log(`  📊 累计收益: ${total} 积分`);
  }
  console.log('  🤝 知识共享让整个蜂群受益。');
}

function storyFinale(tagline, totalMs, simulatedSavings) {
  console.log(`\n${'═'.repeat(48)}`);
  console.log(`  🏁 Demo 完成！总时长: ${(totalMs / 1000).toFixed(1)}s`);
  if (simulatedSavings) {
    console.log(`  ⏱ 无共享: ${simulatedSavings.without_sharing?.total_s || '?'}s`);
    console.log(`  ⏱ 有共享: ${simulatedSavings.with_sharing?.total_s || '?'}s`);
    console.log(`  📉 节省: ${simulatedSavings.savings_pct || '?'}`);
  }
  console.log(`  💡 ${tagline}`);
  console.log(`${'═'.repeat(48)}\n`);
}

function makeStoryLogger(logSink, onLog) {
  return (msg, level = 'info') => {
    const ts = new Date().toISOString();
    const log = { ts, level, msg };
    if (logSink) logSink.push(log);
    if (onLog) onLog(log);
    if (level === 'error') {
      console.log(`  ⚠️ ${msg}`);
    }
  };
}

export {
  STORY_MODE,
  SKIP_SEARCH,
  storyAct1,
  storyAct2,
  storyAct3,
  storyAct4,
  storyAct5,
  storyFinale,
  makeStoryLogger,
};
