/**
 * SHARED UTILITY: Word-level diff computation using LCS approach.
 */

export type DiffOp = 'equal' | 'insert' | 'delete';
export type DiffEntry = [DiffOp, string];

export function computeWordDiff(oldText: string, newText: string): DiffEntry[] {
  const oldWords = tokenize(oldText);
  const newWords = tokenize(newText);

  const m = oldWords.length;
  const n = newWords.length;

  if (m * n > 500000) {
    return simpleDiff(oldWords, newWords);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffEntry[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift(['equal', oldWords[i - 1]]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift(['insert', newWords[j - 1]]);
      j--;
    } else {
      result.unshift(['delete', oldWords[i - 1]]);
      i--;
    }
  }

  return mergeOps(result);
}

function tokenize(text: string): string[] {
  return text.match(/\S+\s*/g) || [];
}

function mergeOps(ops: DiffEntry[]): DiffEntry[] {
  if (ops.length === 0) return ops;
  const merged: DiffEntry[] = [ops[0]];
  for (let i = 1; i < ops.length; i++) {
    const last = merged[merged.length - 1];
    if (last[0] === ops[i][0]) {
      merged[merged.length - 1] = [last[0], last[1] + ops[i][1]];
    } else {
      merged.push(ops[i]);
    }
  }
  return merged;
}

function simpleDiff(oldWords: string[], newWords: string[]): DiffEntry[] {
  const oldText = oldWords.join('');
  const newText = newWords.join('');
  if (oldText === newText) return [['equal', oldText]];
  let prefix = 0;
  while (prefix < oldText.length && prefix < newText.length && oldText[prefix] === newText[prefix]) prefix++;
  let oldSuffix = oldText.length;
  let newSuffix = newText.length;
  while (oldSuffix > prefix && newSuffix > prefix && oldText[oldSuffix - 1] === newText[newSuffix - 1]) {
    oldSuffix--;
    newSuffix--;
  }
  const result: DiffEntry[] = [];
  if (prefix > 0) result.push(['equal', oldText.slice(0, prefix)]);
  if (oldSuffix > prefix) result.push(['delete', oldText.slice(prefix, oldSuffix)]);
  if (newSuffix > prefix) result.push(['insert', newText.slice(prefix, newSuffix)]);
  if (oldSuffix < oldText.length) result.push(['equal', oldText.slice(oldSuffix)]);
  return result;
}
