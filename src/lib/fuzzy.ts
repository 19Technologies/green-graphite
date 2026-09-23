// Subsequence fuzzy matching with bonuses for word starts and consecutive runs.

export interface FuzzyHit {
  score: number;
  indices: number[];
}

export function fuzzy(query: string, text: string): FuzzyHit | null {
  const q = query.toLowerCase().replace(/\s+/g, "");
  if (!q) return { score: 0, indices: [] };
  const t = text.toLowerCase();
  const indices: number[] = [];
  let score = 0;
  let ti = 0;
  let prev = -2;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    const boundary = found === 0 || /[\s/\-_(.]/.test(t[found - 1]);
    score += 1 + (found === prev + 1 ? 4 : 0) + (boundary ? 3 : 0) - Math.min(3, (found - ti) * 0.1);
    indices.push(found);
    prev = found;
    ti = found + 1;
  }
  if (t.startsWith(q)) score += 6;
  score -= t.length * 0.02;
  return { score, indices };
}

export function rank<T>(items: T[], query: string, key: (item: T) => string, limit = 50) {
  return items
    .map((item) => ({ item, hit: fuzzy(query, key(item)) }))
    .filter((r): r is { item: T; hit: FuzzyHit } => r.hit !== null)
    .sort((a, b) => b.hit.score - a.hit.score)
    .slice(0, limit);
}
