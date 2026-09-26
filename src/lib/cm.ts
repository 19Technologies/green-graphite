// Editing commands shared by the editor, its keymap and the mobile formatting toolbar.
// Every edit is a single CodeMirror transaction, so undo/redo steps match what the user did.

import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { indentLess, indentMore } from "@codemirror/commands";

let active: EditorView | null = null;

/** The editor the toolbar should act on (the last one focused that's still on screen). */
export function activeEditor() {
  return active && active.dom.isConnected ? active : null;
}
export function setActiveEditor(view: EditorView | null) {
  active = view;
}
export function focusEditor() {
  activeEditor()?.focus();
}

/** Replace the selection with text and put the caret after it. */
export function insertText(view: EditorView, text: string) {
  view.dispatch(view.state.replaceSelection(text), { scrollIntoView: true, userEvent: "input" });
  view.focus();
}

/** Wrap the selection (or the word at the caret) in before/after, toggling it off if already wrapped. */
export function wrap(view: EditorView, before: string, after = before) {
  const { state } = view;
  let { from, to } = state.selection.main;
  if (from === to) {
    const line = state.doc.lineAt(from);
    from -= /[\p{L}\p{N}_-]*$/u.exec(state.sliceDoc(line.from, from))![0].length;
    to += /^[\p{L}\p{N}_-]*/u.exec(state.sliceDoc(to, line.to))![0].length;
  }
  const selected = state.sliceDoc(from, to);
  const wrapped =
    state.sliceDoc(from - before.length, from) === before && state.sliceDoc(to, to + after.length) === after;
  if (wrapped) {
    view.dispatch({
      changes: { from: from - before.length, to: to + after.length, insert: selected },
      selection: EditorSelection.range(from - before.length, to - before.length),
      userEvent: "input",
    });
  } else {
    view.dispatch({
      changes: { from, to, insert: before + selected + after },
      selection: EditorSelection.range(from + before.length, to + before.length),
      userEvent: "input",
    });
  }
  view.focus();
  return true;
}

/** Add or remove a prefix (like "- [ ] ") at the start of the caret's line. */
export function toggleLinePrefix(view: EditorView, prefix: string, match: RegExp) {
  const { state } = view;
  const head = state.selection.main.head;
  const line = state.doc.lineAt(head);
  const m = match.exec(line.text);
  if (m) {
    view.dispatch({
      changes: { from: line.from, to: line.from + m[0].length },
      selection: { anchor: Math.max(line.from, head - m[0].length) },
      userEvent: "delete",
    });
  } else {
    view.dispatch({
      changes: { from: line.from, insert: prefix },
      selection: { anchor: head + prefix.length },
      userEvent: "input",
    });
  }
  view.focus();
}

const LIST_ITEM = /^\s*([-*+]|\d+[.)])\s/;

/** Tab / Shift-Tab: indent list items and multi-line selections, otherwise insert a tab. */
export function indent(view: EditorView, outdent: boolean) {
  const { state } = view;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.from);
  const multiLine = state.doc.lineAt(sel.to).number !== line.number;
  if (outdent || multiLine || (sel.empty && LIST_ITEM.test(line.text))) {
    if (outdent) indentLess(view);
    else indentMore(view);
  } else {
    view.dispatch(state.replaceSelection("\t"), { scrollIntoView: true, userEvent: "input" });
  }
  view.focus();
  return true;
}

const LIST_RE = /^(\s*)(?:([-*+]) \[[ xX]\] |([-*+]) |(\d+)([.)]) |> )/;

/** Enter inside a list, checklist or quote continues it; Enter on an empty item ends it. */
export function continueList(view: EditorView) {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  const line = state.doc.lineAt(sel.head);
  const before = state.sliceDoc(line.from, sel.head);
  const m = LIST_RE.exec(before);
  if (!m) return false;
  if (before.trim() === m[0].trim()) {
    view.dispatch({ changes: { from: line.from, to: sel.head }, selection: { anchor: line.from }, userEvent: "delete" });
    return true;
  }
  const [, lead, taskBullet, bullet, num, delim] = m;
  const next = taskBullet ? `${taskBullet} [ ] ` : bullet ? `${bullet} ` : num ? `${Number(num) + 1}${delim} ` : "> ";
  view.dispatch(state.replaceSelection(`\n${lead}${next}`), { scrollIntoView: true, userEvent: "input" });
  return true;
}

/** Typing "[" with text selected turns the selection into a [[link]]. */
export function linkSelection(view: EditorView) {
  const sel = view.state.selection.main;
  if (sel.empty) return false;
  return wrap(view, "[[", "]]");
}

/** Obsidian-style bracket pairing: "[[" becomes "[[]]" with the caret inside; "]" steps over a closing bracket. */
export const pairBrackets = EditorView.inputHandler.of((view, from, to, text) => {
  if (from !== to) return false;
  const { state } = view;
  if (text === "[" && state.sliceDoc(from - 1, from) === "[" && state.sliceDoc(from, from + 2) !== "]]") {
    view.dispatch({ changes: { from, insert: "[]]" }, selection: { anchor: from + 1 }, userEvent: "input.type" });
    return true;
  }
  if (text === "]" && state.sliceDoc(from, from + 1) === "]") {
    const lineStart = state.doc.lineAt(from).from;
    if (/\[\[[^[\]\n]*\]?$/.test(state.sliceDoc(lineStart, from))) {
      view.dispatch({ selection: { anchor: from + 1 } });
      return true;
    }
  }
  return false;
});

/** Smallest single change that turns `from` into `to`, so outside edits don't reset the caret. */
export function diff(from: string, to: string) {
  let start = 0;
  const max = Math.min(from.length, to.length);
  while (start < max && from.charCodeAt(start) === to.charCodeAt(start)) start++;
  let end = 0;
  while (
    end < max - start &&
    from.charCodeAt(from.length - 1 - end) === to.charCodeAt(to.length - 1 - end)
  )
    end++;
  return { from: start, to: from.length - end, insert: to.slice(start, to.length - end) };
}
