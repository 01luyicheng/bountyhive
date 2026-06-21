# EvoMap/BountyHive Hackathon Demo: AI Skill Chain Problems

## Source: HumanEval (OpenAI, 2021) — 164 Python function-completion problems

## Chain Pattern: **Empty Collection Edge Case Handling**

All three problems share the same bug pattern: **assuming input is non-empty** and crashing on empty collections. This is one of the most common LLM code generation failures.

---

### Problem 1: `intersperse` (HumanEval/5) — *The Trap*

**Problem Description:**
Insert a delimiter between every two consecutive elements of a list.

```python
def intersperse(numbers: List[int], delimiter: int) -> List[int]:
    """ Insert a number 'delimeter' between every two consecutive elements of input list `numbers'
    >>> intersperse([], 4)
    []
    >>> intersperse([1, 2, 3], 4)
    [1, 4, 2, 4, 3]
    """
```

**Buggy Code (Agent A — FAILS):**
```python
def intersperse(numbers: List[int], delimiter: int) -> List[int]:
    result = []
    for n in numbers[:-1]:
        result.append(n)
        result.append(delimiter)
    result.append(numbers[-1])    # IndexError: list index out of range
    return result
```

**Fixed Code:**
```python
def intersperse(numbers: List[int], delimiter: int) -> List[int]:
    if not numbers:
        return []
    result = []
    for n in numbers[:-1]:
        result.append(n)
        result.append(delimiter)
    result.append(numbers[-1])
    return result
```

**Bug Pattern:** Off-by-one / missing empty guard. `numbers[-1]` crashes on `[]` because `numbers[:-1]` silently returns `[]` on empty lists (Python doesn't error on slice).

**Lesson Published by Agent A:**
> "When slicing `list[:-1]` and then accessing `list[-1]`, you MUST guard against empty lists first. Python's slice handles empty gracefully, but the index access does not. Always add `if not list: return default` at the start."

---

### Problem 2: `rolling_max` (HumanEval/9) — *The Transfer*

**Problem Description:**
Generate a list of the rolling maximum element found until each point in the sequence.

```python
def rolling_max(numbers: List[int]) -> List[int]:
    """ From a given list of integers, generate a list of rolling maximum element found until given moment
    in the sequence.
    >>> rolling_max([])
    []
    >>> rolling_max([1, 2, 3, 2, 3, 4, 2])
    [1, 2, 3, 3, 3, 4, 4]
    """
```

**Buggy Code (Agent B without lesson — would fail):**
```python
def rolling_max(numbers: List[int]) -> List[int]:
    running_max = numbers[0]    # IndexError: list index out of range
    result = []
    for n in numbers:
        running_max = max(running_max, n)
        result.append(running_max)
    return result
```

**Fixed Code (Agent B — learns from A's lesson):**
```python
def rolling_max(numbers: List[int]) -> List[int]:
    if not numbers:
        return []
    running_max = numbers[0]
    result = []
    for n in numbers:
        running_max = max(running_max, n)
        result.append(running_max)
    return result
```

**Bug Pattern:** Identical root cause — assuming `numbers[0]` is safe. Agent B read A's lesson about guarding empty collections and applies the same `if not numbers: return []` pattern.

**Lesson Absorbed from Agent A:**
> "Never index `collection[0]` without checking emptiness first. Use `if not collection: return default` as a universal guard."

---

### Problem 3: `longest` (HumanEval/12) — *The Reuse*

**Problem Description:**
Return the longest string from a list. Return None for empty list.

```python
def longest(strings: List[str]) -> Optional[str]:
    """ Out of list of strings, return the longest one. Return the first one in case of multiple
    strings of the same length. Return None in case the input list is empty.
    >>> longest([])
    >>> longest(['a', 'b', 'c'])
    'a'
    >>> longest(['a', 'bb', 'ccc'])
    'ccc'
    """
```

**Buggy Code (would fail without lesson):**
```python
def longest(strings: List[str]) -> Optional[str]:
    maxlen = max(len(x) for x in strings)    # ValueError: max() arg is empty sequence
    for s in strings:
        if len(s) == maxlen:
            return s
```

**Fixed Code (Agent C — trivially reuses B's pattern):**
```python
def longest(strings: List[str]) -> Optional[str]:
    if not strings:
        return None
    maxlen = max(len(x) for x in strings)
    for s in strings:
        if len(s) == maxlen:
            return s
```

**Bug Pattern:** Same empty-collection guard missing. `max()` on empty iterator raises `ValueError`. Agent C sees B's `if not numbers: return []` pattern and trivially adapts to `if not strings: return None`.

---

## Demo Flow Summary

| Step | Agent | Problem | Outcome | Why |
|------|-------|---------|---------|-----|
| 1 | A | `intersperse` | FAILS (IndexError) | `numbers[-1]` on empty list |
| 2 | A publishes lesson | — | "Guard empty lists before indexing" | — |
| 3 | B searches, finds lesson | `rolling_max` | SUCCEEDS | Applies `if not numbers: return []` |
| 4 | C searches, finds B's code | `longest` | SUCCEEDS instantly | Reuses `if not strings: return None` pattern |

---

## Alternative Chain: Off-by-One in Range/Sliding Window

For another demo angle, here's an alternative chain:

### Problem A: `how_many_times` (HumanEval/18)
```python
# BUG: misses last possible position
def how_many_times(string: str, substring: str) -> int:
    times = 0
    for i in range(len(string) - len(substring)):  # BUG: off by one
        if string[i:i+len(substring)] == substring:
            times += 1
    return times

# FIXED:
def how_many_times(string: str, substring: str) -> int:
    times = 0
    for i in range(len(string) - len(substring) + 1):  # +1 is critical
        if string[i:i+len(substring)] == substring:
            times += 1
    return times
```

### Problem B: `string_sequence` (HumanEval/15)
```python
# BUG: range(n) generates 0..n-1, missing n
def string_sequence(n: int) -> str:
    return ' '.join([str(x) for x in range(n)])  # BUG: should be range(n+1)

# FIXED (learned from A's "+1" lesson):
def string_sequence(n: int) -> str:
    return ' '.join([str(x) for x in range(n + 1)])
```

### Problem C: `all_prefixes` (HumanEval/14)
```python
# BUG: slicing off by one
def all_prefixes(string: str) -> List[str]:
    result = []
    for i in range(len(string)):
        result.append(string[:i])  # BUG: gives ['', 'a', 'ab'] instead of ['a', 'ab', 'abc']
    return result

# FIXED (reuses B's range pattern):
def all_prefixes(string: str) -> List[str]:
    result = []
    for i in range(len(string)):
        result.append(string[:i+1])
    return result
```
