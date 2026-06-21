const STORY_MODE = process.env.STORY_MODE === '1';
const SKIP_SEARCH = process.env.SKIP_SEARCH === '1';

function storyAct1() {}
function storyAct2() {}
function storyAct3() {}
function storyAct4() {}
function storyAct5() {}
function storyFinale() {}
function makeStoryLogger(logSink, onLog) {
  return (msg, level = 'info') => {
    const ts = new Date().toISOString();
    const log = { ts, level, msg };
    if (logSink) logSink.push(log);
    if (onLog) onLog(log);
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
