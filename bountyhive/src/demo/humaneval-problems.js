// src/demo/humaneval-problems.js
// HumanEval-style coding problems for the BountyHive demo chain
// Source: OpenAI HumanEval (2021) — adapted as buggy versions
//
// Chain pattern: empty collection edge case handling (most common LLM failure)
//
// Use these problems instead of the deprecated agent-templates.js data.

export const PROBLEM_A = {
  id: 'humaneval-5-intersperse',
  title: 'intersperse (HumanEval/5)',
  description:
    'Insert a delimiter between every two consecutive elements of a list.',
  buggyCode: `def intersperse(numbers: List[int], delimiter: int) -> List[int]:
    result = []
    for n in numbers[:-1]:
        result.append(n)
        result.append(delimiter)
    result.append(numbers[-1])    # IndexError: list index out of range
    return result`,
  fixedCode: `def intersperse(numbers: List[int], delimiter: int) -> List[int]:
    if not numbers:
        return []
    result = []
    for n in numbers[:-1]:
        result.append(n)
        result.append(delimiter)
    result.append(numbers[-1])
    return result`,
  validation: 'numbers[-1] crashes on empty list because numbers[:-1] silently returns [] on empty lists',
  guardCheck: (fixCode) => fixCode.includes('if not numbers') && !fixCode.includes('numbers[-1]'),
  signals: ['empty-collection-guard', 'index-error', 'python-list-slice', 'intersperse'],
  category: 'edge-case',
  difficulty: 'easy',
};

export const PROBLEM_B = {
  id: 'humaneval-9-rolling-max',
  title: 'rolling_max (HumanEval/9)',
  description:
    'Generate a list of the rolling maximum element found until each point in the sequence.',
  buggyCode: `def rolling_max(numbers: List[int]) -> List[int]:
    running_max = numbers[0]    # IndexError: list index out of range
    result = []
    for n in numbers:
        running_max = max(running_max, n)
        result.append(running_max)
    return result`,
  fixedCode: `def rolling_max(numbers: List[int]) -> List[int]:
    if not numbers:
        return []
    running_max = numbers[0]
    result = []
    for n in numbers:
        running_max = max(running_max, n)
        result.append(running_max)
    return result`,
  validation: 'numbers[0] crashes on empty list — missing empty collection guard',
  guardCheck: (fixCode) => fixCode.includes('if not numbers'),
  signals: ['empty-collection-guard', 'index-error', 'python-max', 'rolling-max'],
  category: 'edge-case',
  difficulty: 'easy',
};

export const PROBLEM_C = {
  id: 'humaneval-12-longest',
  title: 'longest (HumanEval/12)',
  description:
    'Out of list of strings, return the longest one. Return None in case the input list is empty.',
  buggyCode: `def longest(strings: List[str]) -> Optional[str]:
    maxlen = max(len(x) for x in strings)    # ValueError: max() arg is empty sequence
    for s in strings:
        if len(s) == maxlen:
            return s`,
  fixedCode: `def longest(strings: List[str]) -> Optional[str]:
    if not strings:
        return None
    maxlen = max(len(x) for x in strings)
    for s in strings:
        if len(s) == maxlen:
            return s`,
  validation: 'max() on empty iterator raises ValueError — missing empty collection guard',
  guardCheck: (fixCode) => fixCode.includes('if not strings'),
  signals: ['empty-collection-guard', 'value-error', 'python-max', 'longest'],
  category: 'edge-case',
  difficulty: 'easy',
};
