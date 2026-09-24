// Textarea editing helpers shared by the editor and the mobile toolbar.
// Edits go through execCommand("insertText") so the browser's undo stack keeps working.

const MIRRORED = [
  "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "tabSize",
  "textIndent", "wordSpacing",
] as const;

/** Pixel position just below the caret, relative to the textarea (mirror-div technique). */
export function caretPosition(ta: HTMLTextAreaElement, pos: number) {
  const div = document.createElement("div");
  const style = getComputedStyle(ta);
  for (const p of MIRRORED) div.style[p] = style[p];
  Object.assign(div.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    top: "0",
    left: "-9999px",
  });
  div.textContent = ta.value.slice(0, pos);
  const marker = document.createElement("span");
  marker.textContent = "​";
  div.appendChild(marker);
  document.body.appendChild(div);
  const lineHeight = parseFloat(style.lineHeight) || 24;
  const result = { top: marker.offsetTop + lineHeight, left: marker.offsetLeft };
  div.remove();
  return result;
}

/** Replace [from, to) with text, keeping native undo. React sees it as a normal input event. */
export function insert(ta: HTMLTextAreaElement, from: number, to: number, text: string) {
  ta.focus({ preventScroll: true });
  ta.setSelectionRange(from, to);
  const ok = text ? document.execCommand("insertText", false, text) : from === to || document.execCommand("delete");
  if (!ok) {
    ta.setRangeText(text, from, to, "end");
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }
  // Chrome can leave the caret on the wrong side of a trailing newline after a delete; pin it.
  ta.setSelectionRange(from + text.length, from + text.length);
}

/** Wrap the selection (or the word at the caret) in before/after, toggling it off if already wrapped. */
export function wrap(ta: HTMLTextAreaElement, before: string, after = before) {
  const { value } = ta;
  let { selectionStart: start, selectionEnd: end } = ta;
  if (start === end) {
    const left = /[\p{L}\p{N}_-]*$/u.exec(value.slice(0, start))![0].length;
    const right = /^[\p{L}\p{N}_-]*/u.exec(value.slice(end))![0].length;
    start -= left;
    end += right;
  }
  const selected = value.slice(start, end);
  const wrapped = value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after;
  if (wrapped) {
    insert(ta, start - before.length, end + after.length, selected);
    ta.setSelectionRange(start - before.length, end - before.length);
  } else {
    insert(ta, start, end, before + selected + after);
    const caret = start + before.length;
    ta.setSelectionRange(caret, caret + selected.length);
  }
}

/** Add or remove a prefix (like "- [ ] ") at the start of the caret's line. */
export function toggleLinePrefix(ta: HTMLTextAreaElement, prefix: string, match: RegExp) {
  const { selectionStart: start, value } = ta;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const line = value.slice(lineStart, value.indexOf("\n", lineStart) === -1 ? undefined : value.indexOf("\n", lineStart));
  const m = match.exec(line);
  if (m) {
    insert(ta, lineStart, lineStart + m[0].length, "");
    const caret = Math.max(lineStart, start - m[0].length);
    ta.setSelectionRange(caret, caret);
  } else {
    insert(ta, lineStart, lineStart, prefix);
    ta.setSelectionRange(start + prefix.length, start + prefix.length);
  }
}

export function indent(ta: HTMLTextAreaElement, outdent: boolean) {
  const { selectionStart: start, selectionEnd: end, value } = ta;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  if (outdent) {
    const m = /^(\t| {1,4})/.exec(value.slice(lineStart));
    if (m) insert(ta, lineStart, lineStart + m[0].length, "");
  } else if (start === end && /^\s*([-*+]|\d+[.)])\s/.test(value.slice(lineStart))) {
    insert(ta, lineStart, lineStart, "\t"); // indent the whole list item
    ta.setSelectionRange(start + 1, start + 1);
  } else insert(ta, start, end, "\t");
}
