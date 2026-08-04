/**
 * Parses 1-based row targets for batch grid operations.
 * Examples: "3", "2,5,8", "10-15", "2, 10-12"
 * Empty spec returns all row indices except `excludeIndex` when provided.
 */
export function parseBatchRowTargets(
  spec: string,
  rowCount: number,
  options?: { excludeIndex?: number }
): { indices: number[] } | { error: 'invalid' } {
  const trimmed = spec.trim();
  if (!trimmed) {
    const indices: number[] = [];
    for (let i = 0; i < rowCount; i++) {
      if (options?.excludeIndex !== i) {
        indices.push(i);
      }
    }
    return { indices };
  }

  const seen = new Set<number>();
  const tokens = trimmed.split(/[,;]+/);
  for (const token of tokens) {
    const part = token.trim();
    if (!part) {
      continue;
    }
    const parsed = parseToken(part, rowCount);
    if (!parsed) {
      return { error: 'invalid' };
    }
    for (const idx of parsed) {
      if (options?.excludeIndex === idx) {
        continue;
      }
      seen.add(idx);
    }
  }

  if (seen.size === 0) {
    return { error: 'invalid' };
  }

  return { indices: [...seen].sort((a, b) => a - b) };
}

function parseToken(token: string, rowCount: number): number[] | null {
  const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(token);
  if (rangeMatch) {
    const start = Number.parseInt(rangeMatch[1], 10);
    const end = Number.parseInt(rangeMatch[2], 10);
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start < 1 || end > rowCount) {
      return null;
    }
    const out: number[] = [];
    for (let n = start; n <= end; n++) {
      out.push(n - 1);
    }
    return out;
  }

  const single = Number.parseInt(token, 10);
  if (Number.isNaN(single) || single < 1 || single > rowCount) {
    return null;
  }
  return [single - 1];
}
