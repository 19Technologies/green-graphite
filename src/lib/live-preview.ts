// Obsidian-style Live Preview for the editor: markdown syntax (the [[ ]] around links, ** around
// bold, # before headings…) is hidden until the cursor touches it, so notes read cleanly while
// still being plain text underneath.

import { StateEffect, type Extension, type Range } from "@codemirror/state";
import { Decoration, ViewPlugin, WidgetType, type DecorationSet, type EditorView, type ViewUpdate } from "@codemirror/view";
import {
  HighlightStyle,
  Language,
  LanguageSupport,
  defineLanguageFacet,
  languageDataProp,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { GFM, parser } from "@lezer/markdown";
import { TAG_RE, WIKI_RE, parseWikiInner, tintFor } from "./links";

// Markdown + GitHub extras (tables, task lists, strikethrough), without the HTML/JS/CSS parsers
// that @codemirror/lang-markdown would pull in.
const data = defineLanguageFacet();
const markdown = new LanguageSupport(
  new Language(data, parser.configure([GFM, { props: [languageDataProp.add({ Document: data })] }]), [], "markdown"),
);

const highlight = HighlightStyle.define([
  { tag: t.strong, class: "cm-strong" },
  { tag: t.emphasis, class: "cm-em" },
  { tag: t.strikethrough, class: "cm-strike" },
  { tag: t.monospace, class: "cm-mono" },
  { tag: t.url, class: "cm-url" },
  { tag: t.processingInstruction, class: "cm-formatting" },
  { tag: t.contentSeparator, class: "cm-hr" },
]);

/** Dispatch this when link targets may have changed (a note was created, renamed or deleted). */
export const refreshPreview = StateEffect.define<null>();

const HIDE = Decoration.replace({});
const BRACKET = Decoration.mark({ class: "cm-formatting" });
const HL = Decoration.mark({ class: "cm-highlight" });
const CARD_SEP = Decoration.mark({ class: "cm-card-sep" });
const QUOTE_LINE = Decoration.line({ class: "cm-quote-line" });
const CODE_LINE = Decoration.line({ class: "cm-code-line" });
const HEADING_LINE = [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-heading cm-heading-${n}` }));
const INLINE_MARKS = new Set(["EmphasisMark", "StrikethroughMark", "CodeMark"]);

/** "- [ ]" drawn as a checkbox; clicking it ticks the task in the text. */
class TaskWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  eq(other: TaskWidget) {
    return other.checked === this.checked;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("span");
    box.className = `cm-task${this.checked ? " is-checked" : ""}`;
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", String(this.checked));
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const line = view.state.doc.lineAt(view.posAtDOM(box));
      const m = /^\s*[-*+] \[([ xX])\]/.exec(line.text);
      if (!m) return;
      const at = line.from + m[0].length - 2;
      view.dispatch({ changes: { from: at, to: at + 1, insert: m[1] === " " ? "x" : " " }, userEvent: "input" });
    });
    return box;
  }
}
const TASK_OPEN = Decoration.replace({ widget: new TaskWidget(false) });
const TASK_DONE = Decoration.replace({ widget: new TaskWidget(true) });
const TASK_DONE_LINE = Decoration.line({ class: "cm-task-done" });

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const dot = document.createElement("span");
    dot.className = "cm-bullet";
    dot.textContent = "•";
    return dot;
  }
}
const BULLET = Decoration.replace({ widget: new BulletWidget() });

function build(view: EditorView, exists: (target: string) => boolean): DecorationSet {
  const { state } = view;
  const { doc } = state;
  const ranges = view.hasFocus ? state.selection.ranges : [];
  // Syntax shows while the cursor (or selection) touches the element, like Obsidian.
  const touches = (from: number, to: number) => ranges.some((r) => r.from <= to && r.to >= from);
  const onLine = (pos: number) => {
    const line = doc.lineAt(pos);
    return touches(line.from, line.to);
  };

  const out: Range<Decoration>[] = [];
  const hide = (from: number, to: number) => {
    if (to > from) out.push(HIDE.range(from, to));
  };
  const code: Array<[number, number]> = [];
  const inCode = (pos: number) => code.some(([a, b]) => pos >= a && pos < b);

  const vis = view.visibleRanges;
  if (!vis.length) return Decoration.none;
  const from = doc.lineAt(vis[0].from).from;
  const to = doc.lineAt(vis[vis.length - 1].to).to;

  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      const { name } = node;
      if (name === "FencedCode" || name === "CodeBlock") {
        code.push([node.from, node.to]);
        for (let pos = node.from; pos <= node.to; ) {
          const line = doc.lineAt(pos);
          out.push(CODE_LINE.range(line.from));
          pos = line.to + 1;
        }
        return false;
      }
      if (name === "InlineCode") code.push([node.from, node.to]);

      const heading = /^(ATX|Setext)Heading(\d)$/.exec(name);
      if (heading) {
        out.push(HEADING_LINE[Number(heading[2]) - 1].range(doc.lineAt(node.from).from));
        const mark = node.node.firstChild;
        if (heading[1] === "ATX" && mark?.name === "HeaderMark" && !onLine(node.from)) {
          hide(mark.from, Math.min(mark.to + 1, node.to));
        }
        return;
      }
      if (name === "Blockquote") {
        for (let pos = node.from; pos <= node.to; ) {
          const line = doc.lineAt(pos);
          out.push(QUOTE_LINE.range(line.from));
          pos = line.to + 1;
        }
        return;
      }
      if (name === "QuoteMark" && !onLine(node.from)) {
        hide(node.from, node.to + (doc.sliceString(node.to, node.to + 1) === " " ? 1 : 0));
        return;
      }
      if (name === "ListMark") {
        const item = node.node.parent;
        const task = item?.getChild("Task")?.getChild("TaskMarker");
        if (task) {
          if (!touches(node.from, task.to)) {
            const done = /x/i.test(doc.sliceString(task.from, task.to));
            out.push((done ? TASK_DONE : TASK_OPEN).range(node.from, task.to));
          }
          if (/x/i.test(doc.sliceString(task.from, task.to))) out.push(TASK_DONE_LINE.range(doc.lineAt(node.from).from));
        } else if (item?.parent?.name === "BulletList" && !touches(node.from, node.to)) {
          out.push(BULLET.range(node.from, node.to));
        }
        return;
      }
      if (name === "Emphasis" || name === "StrongEmphasis" || name === "Strikethrough" || name === "InlineCode") {
        if (touches(node.from, node.to)) return;
        for (let c = node.node.firstChild; c; c = c.nextSibling) if (INLINE_MARKS.has(c.name)) hide(c.from, c.to);
        return;
      }
      if (name === "Link") {
        // [text](url): show just the text, as a link.
        const marks: Array<{ from: number; to: number }> = [];
        let url: string | null = null;
        for (let c = node.node.firstChild; c; c = c.nextSibling) {
          if (c.name === "LinkMark") marks.push({ from: c.from, to: c.to });
          if (c.name === "URL") url = doc.sliceString(c.from, c.to);
        }
        if (!url || marks.length < 3 || /^\[\[/.test(doc.sliceString(node.from, node.from + 2))) return;
        out.push(
          Decoration.mark({ class: "ed-ext", attributes: { "data-href": url } }).range(marks[0].to, marks[1].from),
        );
        if (!touches(node.from, node.to)) {
          hide(marks[0].from, marks[0].to);
          hide(marks[1].from, node.to);
        }
        return false;
      }
    },
  });

  for (let pos = from; pos <= to; ) {
    const line = doc.lineAt(pos);
    const text = line.text;
    pos = line.to + 1;
    if (!text) continue;

    for (const m of text.matchAll(WIKI_RE)) {
      const s = line.from + m.index!;
      const e = s + m[0].length;
      if (inCode(s)) continue;
      const inner = m[1];
      const { target, heading, alias } = parseWikiInner(inner);
      if (!target) continue;
      const link = Decoration.mark({
        class: exists(target) ? "ed-link" : "ed-link is-unresolved",
        attributes: { "data-target": heading ? `${target}#${heading}` : target },
      });
      if (touches(s, e)) {
        out.push(BRACKET.range(s, s + 2), link.range(s + 2, e - 2), BRACKET.range(e - 2, e));
        continue;
      }
      const pipe = inner.indexOf("|");
      const textFrom = alias ? s + 2 + pipe + 1 : s + 2;
      hide(s, textFrom);
      out.push(link.range(textFrom, e - 2));
      hide(e - 2, e);
    }

    for (const m of text.matchAll(/==([^=\n]+)==/g)) {
      const s = line.from + m.index!;
      const e = s + m[0].length;
      if (inCode(s)) continue;
      if (touches(s, e)) out.push(BRACKET.range(s, s + 2), HL.range(s + 2, e - 2), BRACKET.range(e - 2, e));
      else {
        hide(s, s + 2);
        out.push(HL.range(s + 2, e - 2));
        hide(e - 2, e);
      }
    }

    for (const m of text.matchAll(TAG_RE)) {
      if (/^\d+$/.test(m[2])) continue;
      const s = line.from + m.index! + m[1].length;
      if (inCode(s)) continue;
      const tag = m[2].replace(/\/+$/, "");
      out.push(
        Decoration.mark({ class: "cm-tag", attributes: { "data-tint": tintFor(tag) } }).range(s, s + 1 + tag.length),
      );
    }

    // Flashcard separators: "front :: back", "front ::: back", and the "?" / "??" lines.
    for (const m of text.matchAll(/(?<=\s):{2,3}(?=\s|$)/g)) {
      const s = line.from + m.index!;
      if (!inCode(s)) out.push(CARD_SEP.range(s, s + m[0].length));
    }
    if (/^\?{1,2}$/.test(text.trim()) && !inCode(line.from)) {
      const s = line.from + text.indexOf("?");
      out.push(CARD_SEP.range(s, s + text.trim().length));
    }
  }

  return Decoration.set(out, true);
}

/** Markdown highlighting plus the hide-syntax-until-touched decorations. */
export function livePreview(exists: (target: string) => boolean): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, exists);
      }
      update(u: ViewUpdate) {
        if (
          u.docChanged ||
          u.selectionSet ||
          u.viewportChanged ||
          u.focusChanged ||
          syntaxTree(u.startState) !== syntaxTree(u.state) ||
          u.transactions.some((tr) => tr.effects.some((e) => e.is(refreshPreview)))
        )
          this.decorations = build(u.view, exists);
      }
    },
    { decorations: (v) => v.decorations },
  );
  return [markdown, syntaxHighlighting(highlight), plugin];
}
