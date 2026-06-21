// src/demo/coding-problems.js
// 5 original coding benchmark problems (not from copyrighted datasets)
// Each problem represents a common bug pattern with intentional bugs

export const CODING_PROBLEMS = [
  {
    id: 'python-binary-search-off-by-one',
    title: 'Python Binary Search Off-by-One Error',
    description:
      'A binary search implementation has an off-by-one error that causes it to miss the target element when it appears at the boundary of the search range. The bug occurs in the loop termination condition and index update logic.',
    buggyCode: `def binary_search(arr, target):
    low = 0
    high = len(arr) - 1
    while low < high:
        mid = (low + high) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            low = mid  # BUG: should be mid + 1
        else:
            high = mid  # BUG: should be mid - 1
    return -1`,
    signals: ['python-off-by-one', 'binary-search', 'loop-boundary'],
    validationCriteria: [
      'Loop uses low <= high instead of low < high',
      'low is updated to mid + 1 (not mid)',
      'high is updated to mid - 1 (not mid)',
      'Function correctly returns index of target or -1',
    ],
    category: 'algorithm',
    difficulty: 'easy',
  },
  {
    id: 'js-async-error-handling',
    title: 'JavaScript Async/Await Missing Error Handling',
    description:
      'A function that fetches user data and their posts has unhandled promise rejections. If the user fetch succeeds but the posts fetch fails, the error is silently swallowed. If the user fetch itself fails, the error propagates as an unhandled rejection.',
    buggyCode: `async function loadUserDashboard(userId) {
  const userRes = await fetch(\`/api/users/\${userId}\`);
  const user = await userRes.json();

  const postsRes = await fetch(\`/api/users/\${userId}/posts\`);
  const posts = await postsRes.json();

  return { user, posts };
}

async function renderDashboard(userId) {
  const data = await loadUserDashboard(userId);
  document.getElementById('name').textContent = data.user.name;
  document.getElementById('posts').innerHTML = data.posts.map(p => p.title).join(', ');
}`,
    signals: ['javascript-async', 'error-handling', 'promise-rejection'],
    validationCriteria: [
      'Both fetch calls have try/catch or proper error handling',
      'HTTP response status is checked (res.ok) before parsing JSON',
      'Partial failures (user OK, posts failed) are handled gracefully',
      'renderDashboard handles errors from loadUserDashboard',
    ],
    category: 'web',
    difficulty: 'medium',
  },
  {
    id: 'rust-borrow-checker',
    title: 'Rust Borrow Checker Violation',
    description:
      'A Rust program tries to modify a vector while iterating over it and also holding a reference to one of its elements. This violates Rust\'s borrowing rules: you cannot have a mutable borrow while an immutable borrow is still in scope.',
    buggyCode: `fn remove_negatives_and_return_first(vec: &mut Vec<i32>) -> Option<&i32> {
    let first = &vec[0];

    vec.retain(|&x| x >= 0);

    Some(first)
}

fn main() {
    let mut numbers = vec![3, -1, 5, -2, 7];
    match remove_negatives_and_return_first(&mut numbers) {
        Some(val) => println!("First positive: {}", val),
        None => println!("No positives"),
    }
}`,
    signals: ['rust-borrow-checker', 'mutable-borrow', 'lifetime'],
    validationCriteria: [
      'Code compiles without borrow checker errors',
      'No use of first after vec is mutably borrowed',
      'Solution properly handles the lifetime/borrow conflict',
      'Function returns a meaningful result (index, copied value, or new Vec)',
    ],
    category: 'systems',
    difficulty: 'hard',
  },
  {
    id: 'sql-injection-vulnerability',
    title: 'SQL Injection Vulnerability',
    description:
      'A user lookup function constructs a SQL query by directly interpolating user input into the query string. This allows an attacker to inject arbitrary SQL commands, potentially reading or modifying the entire database.',
    buggyCode: `const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function findUser(username) {
  const query = \`SELECT * FROM users WHERE username = '\${username}' LIMIT 1\`;
  const result = await pool.query(query);
  return result.rows[0] || null;
}

async function deleteUser(username) {
  const query = \`DELETE FROM users WHERE username = '\${username}'\`;
  await pool.query(query);
}`,
    signals: ['sql-injection', 'security-vulnerability', 'input-sanitization'],
    validationCriteria: [
      'Uses parameterized queries ($1, $2) instead of string interpolation',
      'User input is never directly concatenated into SQL strings',
      'findUser and deleteUser both use safe query construction',
      'No eval() or dynamic SQL construction from user input',
    ],
    category: 'security',
    difficulty: 'medium',
  },
  {
    id: 'react-stale-closure',
    title: 'React Stale Closure in useEffect',
    description:
      'A React component has a stale closure bug: a useEffect callback references a state variable through a useCallback that has an empty dependency array. The callback captures the initial value of the state and never sees updates.',
    buggyCode: `import React, { useState, useEffect, useCallback } from 'react';

function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  const checkNotifications = useCallback(() => {
    console.log(\`You have \${unreadCount} unread notifications\`);
    if (unreadCount > 0) {
      document.title = \`(\${unreadCount}) New Notifications\`;
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(checkNotifications, 5000);
    return () => clearInterval(interval);
  }, [checkNotifications]);

  return (
    <div>
      <span>Unread: {unreadCount}</span>
      <button onClick={() => setUnreadCount(prev => prev + 1)}>
        Mark new
      </button>
    </div>
  );
}`,
    signals: ['react-stale-closure', 'useeffect-deps', 'usecallback-missing'],
    validationCriteria: [
      'useCallback dependency array includes unreadCount',
      'useEffect does not produce infinite re-renders',
      'checkNotifications always sees the latest unreadCount value',
      'Document title updates correctly when unreadCount changes',
    ],
    category: 'web',
    difficulty: 'medium',
  },
];

/**
 * Select a coding problem deterministically based on a seed string (e.g. RUN_ID).
 * Uses a simple hash to pick one of the 5 problems.
 * @param {string} seed - a deterministic seed like RUN_ID
 * @returns {object} one of the CODING_PROBLEMS
 */
export function selectProblem(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % CODING_PROBLEMS.length;
  return CODING_PROBLEMS[index];
}
