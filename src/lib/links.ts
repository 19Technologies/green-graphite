// Wikilinks, tags, headings and the vault-wide link index.
import { Note, titleOf } from "./vault";

export interface WikiRef {
  target: string;
  heading?: string;
  alias?: string;
  line: number;
}

export interface Heading {
  level: number;
  text: string;
  slug: string;
  line: number;
}

export const WIKI_RE = /\[\[([^\[\]\n]+?)\]\]/g;
export const TAG_RE = /(^|[\s(])#([\p{L}_][\p{L}\p{N}_/-]*)/gu;

export function parseWikiInner(inner: string) {
  const pipe = inner.indexOf("|");
  const left = pipe === -1 ? inner : inner.slice(0, pipe);
  const alias = pipe === -1 ? undefined : inner.slice(pipe + 1).trim() || undefined;
  const hash = left.indexOf("#");
  const target = (hash === -1 ? left : left.slice(0, hash)).trim();
  const heading = hash === -1 ? undefined : left.slice(hash + 1).trim() || undefined;
  return { target, heading, alias };
}

/** Blank out fenced code and inline code while keeping line numbers intact. */
export function stripCode(content: string) {
  const lines = content.split("\n");
  let inFence = false;
  return lines
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return "";
      }
      if (inFence) return "";
      return line.replace(/`[^`\n]*`/g, (m) => " ".repeat(m.length));
    })
    .join("\n");
}

export function extractLinks(content: string): WikiRef[] {
  const refs: WikiRef[] = [];
  stripCode(content)
    .split("\n")
    .forEach((line, i) => {
      for (const m of line.matchAll(WIKI_RE)) {
        const parsed = parseWikiInner(m[1]);
        if (parsed.target) refs.push({ ...parsed, line: i });
      }
    });
  return refs;
}

export function extractTags(content: string): string[] {
  const tags = new Set<string>();
  const text = stripCode(content).replace(WIKI_RE, " ");
  for (const m of text.matchAll(TAG_RE)) {
    // Skip markdown headings ("# Title") and pure numbers ("#1")
    if (/^\d+$/.test(m[2])) continue;
    tags.add(m[2].replace(/\/+$/, ""));
  }
  return [...tags];
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

export function extractHeadings(content: string): Heading[] {
  const out: Heading[] = [];
  stripCode(content)
    .split("\n")
    .forEach((line, i) => {
      const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
      if (m) out.push({ level: m[1].length, text: m[2], slug: slugify(m[2]), line: i });
    });
  return out;
}

export interface Backlink {
  from: Note;
  snippet: string;
}

export interface VaultIndex {
  resolve: (target: string) => Note | undefined;
  outgoing: Map<string, Array<WikiRef & { note?: Note }>>;
  backlinks: Map<string, Backlink[]>;
  noteTags: Map<string, string[]>;
  tags: Map<string, string[]>;
  unresolved: Map<string, { target: string; from: string[] }>;
}

export function buildIndex(notes: Record<string, Note>): VaultIndex {
  const list = Object.values(notes).sort((a, b) => a.path.length - b.path.length);
  const byPath = new Map<string, Note>();
  const byTitle = new Map<string, Note>();
  for (const n of list) {
    byPath.set(n.path.toLowerCase(), n);
    const t = titleOf(n.path).toLowerCase();
    if (!byTitle.has(t)) byTitle.set(t, n); // shortest path wins, like Obsidian
  }
  const resolve = (target: string) => {
    const key = target.trim().replace(/\.md$/i, "").toLowerCase();
    return byPath.get(key) ?? byTitle.get(key);
  };

  const outgoing: VaultIndex["outgoing"] = new Map();
  const backlinks: VaultIndex["backlinks"] = new Map();
  const noteTags: VaultIndex["noteTags"] = new Map();
  const tags: VaultIndex["tags"] = new Map();
  const unresolved: VaultIndex["unresolved"] = new Map();

  for (const n of list) {
    const lines = n.content.split("\n");
    const refs = extractLinks(n.content).map((r) => ({ ...r, note: resolve(r.target) }));
    outgoing.set(n.id, refs);
    const seen = new Set<string>();
    for (const r of refs) {
      if (r.note) {
        if (r.note.id === n.id || seen.has(r.note.id)) continue;
        seen.add(r.note.id);
        const arr = backlinks.get(r.note.id) ?? [];
        arr.push({ from: n, snippet: lines[r.line]?.trim() ?? "" });
        backlinks.set(r.note.id, arr);
      } else {
        const key = r.target.toLowerCase();
        const u = unresolved.get(key) ?? { target: r.target, from: [] };
        if (!u.from.includes(n.id)) u.from.push(n.id);
        unresolved.set(key, u);
      }
    }
    const t = extractTags(n.content);
    noteTags.set(n.id, t);
    for (const tag of t) tags.set(tag, [...(tags.get(tag) ?? []), n.id]);
  }

  return { resolve, outgoing, backlinks, noteTags, tags, unresolved };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Point every [[link]] at `oldPath` (by title or full path) to `newTitle`. */
export function rewriteLinks(content: string, oldPath: string, newPath: string) {
  const targets = [oldPath, titleOf(oldPath)].map(escapeRe).join("|");
  const re = new RegExp(`\\[\\[(${targets})(?=[\\]|#])`, "gi");
  return content.replace(re, (_m, hit: string) => "[[" + (hit.includes("/") ? newPath : titleOf(newPath)));
}

/** Drop list markers and inline formatting, keeping [[links]] as they are. */
export function stripInline(line: string) {
  return line
    .replace(/^\s*(?:>\s*)*(?:[-*+]\s+|\d+[.)]\s+)?(?:\[[ xX]\]\s+)?/, "")
    .replace(/(\*\*|__|==|~~|`)(.+?)\1/g, "$2")
    .replace(/(^|\W)[*_](\S.*?)[*_](?=\W|$)/g, "$1$2");
}

/** A markdown line as readable plain text, for snippets. */
export function plainLine(line: string) {
  return stripInline(line)
    .replace(/\[\[([^\]|]+?)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g, (_m, t: string, a?: string) => a ?? t)
    .trim();
}
