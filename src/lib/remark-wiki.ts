// remark plugin: [[wikilinks]], ==highlights==, #tags, > [!callouts] and flashcard lines.
import { parseWikiInner } from "./links";

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

const SKIP = new Set(["code", "inlineCode", "link", "linkReference", "html", "definition", "image"]);
const INLINE_RE = /\[\[([^\[\]\n]+?)\]\]|==([^=\n]+)==|(^|[\s(])#([\p{L}_][\p{L}\p{N}_/-]*)/gu;
const SEPARATOR = /\s(:{2,3})\s/;

const text = (value: string): MdNode => ({ type: "text", value });
const span = (className: string, children: MdNode[], extra: Record<string, unknown> = {}): MdNode => ({
  type: "kbSpan",
  data: { hName: "span", hProperties: { className: [className], ...extra } },
  children,
});

function splitInline(value: string): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  for (const m of value.matchAll(INLINE_RE)) {
    let start = m.index!;
    if (m[4] !== undefined) {
      if (/^\d+$/.test(m[4])) continue;
      start += m[3].length; // keep the whitespace before a tag
    }
    if (start > last) out.push(text(value.slice(last, start)));
    if (m[1] !== undefined) {
      const { target, heading, alias } = parseWikiInner(m[1]);
      const label = alias ?? (heading ? `${target} › ${heading}` : target);
      out.push({
        type: "link",
        url: `#wiki/${encodeURIComponent(heading ? `${target}#${heading}` : target)}`,
        children: [text(label)],
      });
    } else if (m[2] !== undefined) {
      out.push({ type: "kbMark", data: { hName: "mark" }, children: [text(m[2])] });
    } else {
      out.push({
        type: "link",
        url: `#tag/${encodeURIComponent(m[4])}`,
        children: [text(`#${m[4]}`)],
        data: { hProperties: { className: ["tag"] } },
      });
    }
    last = m.index! + m[0].length;
  }
  if (!out.length) return [text(value)];
  if (last < value.length) out.push(text(value.slice(last)));
  return out;
}

function walkInline(node: MdNode) {
  if (!node.children || SKIP.has(node.type)) return;
  node.children = node.children.flatMap((child) => {
    if (child.type === "text" && child.value) return splitInline(child.value);
    walkInline(child);
    return [child];
  });
}

/** Split a paragraph's inline children into visual lines at "\n". */
function toLines(children: MdNode[]): MdNode[][] {
  const lines: MdNode[][] = [[]];
  for (const c of children) {
    if (c.type === "text" && c.value?.includes("\n")) {
      c.value.split("\n").forEach((part, i) => {
        if (i > 0) lines.push([]);
        if (part) lines[lines.length - 1].push(text(part));
      });
    } else lines[lines.length - 1].push(c);
  }
  return lines;
}

const plain = (nodes: MdNode[]) => nodes.map((n) => (n.type === "text" ? n.value : "\u0000")).join("");

function joinLines(lines: MdNode[][]): MdNode[] {
  return lines.flatMap((l, i) => (i ? [text("\n"), ...l] : l));
}

function cardLine(line: MdNode[]): MdNode | null {
  const idx = line.findIndex((n) => n.type === "text" && SEPARATOR.test(n.value!));
  if (idx === -1) return null;
  const node = line[idx];
  const m = SEPARATOR.exec(node.value!)!;
  const before = [...line.slice(0, idx), text(node.value!.slice(0, m.index))];
  const after = [text(node.value!.slice(m.index + m[0].length)), ...line.slice(idx + 1)];
  const two = m[1] === ":::";
  return span("card-line", [
    span("card-front", before),
    span("card-sep", [text(two ? "⇄" : "→")], { title: two ? "Two-way card" : "Card" }),
    span("card-back", after, { tabIndex: 0 }),
  ]);
}

function markCards(node: MdNode) {
  if (!node.children || SKIP.has(node.type)) return;
  if (node.type !== "paragraph") return node.children.forEach(markCards);
  const lines = toLines(node.children);
  const q = lines.findIndex((l) => /^\s*\?{1,2}\s*$/.test(plain(l)));
  if (q > 0 && q < lines.length - 1) {
    node.children = [
      span("card-multi", [
        span("card-front", joinLines(lines.slice(0, q))),
        span("card-sep", [text(plain(lines[q]).trim() === "??" ? "⇅" : "?")]),
        span("card-back", joinLines(lines.slice(q + 1)), { tabIndex: 0 }),
      ]),
    ];
    return;
  }
  let changed = false;
  const out = lines.map((l) => {
    const card = cardLine(l);
    if (card) changed = true;
    return card ? [card] : l;
  });
  if (changed) node.children = joinLines(out);
}

function markCallouts(node: MdNode) {
  if (!node.children || SKIP.has(node.type)) return;
  node.children.forEach(markCallouts);
  if (node.type !== "blockquote") return;
  const para = node.children[0];
  const first = para?.type === "paragraph" ? para.children?.[0] : undefined;
  const m = first?.type === "text" ? /^\[!([\w-]+)\][+-]?[ \t]*([^\n]*)\n?/.exec(first.value!) : null;
  if (!para || !first || !m) return;
  const kind = m[1].toLowerCase();
  first.value = first.value!.slice(m[0].length);
  if (!first.value) para.children!.shift();
  const title = m[2] || kind.charAt(0).toUpperCase() + kind.slice(1);
  node.data = { hProperties: { className: ["callout"], "data-callout": kind } };
  node.children.unshift({
    type: "kbCalloutTitle",
    data: { hName: "div", hProperties: { className: ["callout-title"] } },
    children: [text(title)],
  });
  if (!para.children!.length) node.children.splice(1, 1);
}

export function remarkWiki(options: { cards?: boolean } = {}) {
  return (tree: MdNode) => {
    markCallouts(tree);
    if (options.cards) markCards(tree);
    walkInline(tree);
  };
}
