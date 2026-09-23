"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Note, folderOf, titleOf } from "@/lib/vault";
import { useVault, vault } from "@/lib/store";
import { rank } from "@/lib/fuzzy";
import { setUI, useUI } from "@/lib/ui";
import { caretPosition, indent, insert, wrap } from "@/lib/textarea";

interface Suggest {
  query: string;
  start: number;
  top: number;
  left: number;
  active: number;
}

const LIST_RE = /^(\s*)(?:([-*+]) \[[ xX]\] |([-*+]) |(\d+)([.)]) |> )/;

export default function Editor({ note, autoFocus = false }: { note: Note; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { notes } = useVault();
  const [suggest, setSuggest] = useState<Suggest | null>(null);

  const options = useMemo(() => {
    if (!suggest) return [];
    const all = Object.values(notes).filter((n) => n.id !== note.id);
    return rank(all, suggest.query, (n) => n.path, 8).map((r) => r.item);
  }, [suggest, notes, note.id]);

  // Grow with content so the whole pane scrolls like a document.
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [note.content]);

  useLayoutEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus, note.id]);

  // Jump to a specific line (used by "open source note" from a flashcard).
  const { pendingLine } = useUI();
  useLayoutEffect(() => {
    const ta = ref.current;
    if (pendingLine === null || !ta) return;
    setUI({ pendingLine: null });
    const lines = ta.value.split("\n");
    const start = lines.slice(0, pendingLine).reduce((sum, l) => sum + l.length + 1, 0);
    const end = start + (lines[pendingLine]?.length ?? 0);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, end);
    const scroller = ta.closest(".note-scroll");
    if (scroller) {
      const y = ta.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      scroller.scrollTo({ top: y + caretPosition(ta, start).top - scroller.clientHeight / 3, behavior: "smooth" });
    }
  }, [pendingLine]);

  const updateSuggest = (ta: HTMLTextAreaElement) => {
    const caret = ta.selectionStart;
    const m = /\[\[([^\[\]\n|#]*)$/.exec(ta.value.slice(0, caret));
    if (!m || ta.selectionEnd !== caret) return setSuggest(null);
    const pos = caretPosition(ta, caret);
    setSuggest((s) => ({ query: m[1], start: caret - m[1].length, ...pos, active: s?.query === m[1] ? s.active : 0 }));
  };

  const choose = (title: string) => {
    const ta = ref.current;
    if (!ta || !suggest) return;
    const caret = ta.selectionStart;
    const closing = ta.value.slice(caret, caret + 2) === "]]" ? "" : "]]";
    insert(ta, suggest.start, caret, title + closing);
    if (!closing) {
      const after = suggest.start + title.length + 2;
      ta.setSelectionRange(after, after);
    }
    setSuggest(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (suggest) {
      const count = options.length + (suggest.query.trim() ? 1 : 0);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setSuggest({ ...suggest, active: (suggest.active + delta + count) % Math.max(count, 1) });
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && count) {
        e.preventDefault();
        const pick = options[suggest.active];
        choose(pick ? titleOf(pick.path) : suggest.query.trim());
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggest(null);
        return;
      }
    }

    const { selectionStart: start, selectionEnd: end, value } = ta;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const line = value.slice(lineStart, start);

    if (e.key === "Tab") {
      e.preventDefault();
      indent(ta, e.shiftKey);
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && (e.key === "b" || e.key === "i")) {
      e.preventDefault();
      wrap(ta, e.key === "b" ? "**" : "*");
      return;
    }

    if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey && start === end) {
      const m = LIST_RE.exec(line);
      if (!m) return;
      e.preventDefault();
      if (line.trim() === m[0].trim()) {
        insert(ta, lineStart, start, ""); // empty item ends the list
        return;
      }
      const [, lead, taskBullet, bullet, num, delim] = m;
      const next = taskBullet
        ? `${taskBullet} [ ] `
        : bullet
          ? `${bullet} `
          : num
            ? `${Number(num) + 1}${delim} `
            : "> ";
      insert(ta, start, end, `\n${lead}${next}`);
    }

    if (e.key === "[" && start !== end) {
      // Wrap the selection in a wikilink.
      e.preventDefault();
      insert(ta, start, end, `[[${value.slice(start, end)}]]`);
    }
  };

  return (
    <div className="editor">
      <textarea
        ref={ref}
        className="editor-input"
        value={note.content}
        spellCheck
        placeholder={"Start writing…\n\nLink notes with [[double brackets]], and write flashcards like  Hallo :: Hello"}
        onChange={(e) => {
          vault.updateNote(note.id, e.target.value);
          updateSuggest(e.target);
        }}
        onKeyDown={onKeyDown}
        onSelect={(e) => updateSuggest(e.currentTarget)}
        onFocus={() => setUI({ editorFocused: true })}
        onBlur={() => {
          setUI({ editorFocused: false });
          setTimeout(() => setSuggest(null), 120);
        }}
      />
      {suggest && (
        <ul className="suggest" style={{ top: suggest.top + 6, left: Math.max(0, suggest.left - 12) }} role="listbox">
          {options.map((n, i) => (
            <li
              key={n.id}
              role="option"
              aria-selected={i === suggest.active}
              className={i === suggest.active ? "is-active" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(titleOf(n.path));
              }}
            >
              <span className="suggest-title">{titleOf(n.path)}</span>
              {folderOf(n.path) && <span className="suggest-path">{folderOf(n.path)}</span>}
            </li>
          ))}
          {suggest.query.trim() && (
            <li
              role="option"
              aria-selected={suggest.active === options.length}
              className={`suggest-create${suggest.active === options.length ? " is-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(suggest.query.trim());
              }}
            >
              <FilePlus2 size={14} /> Link to new note “{suggest.query.trim()}”
            </li>
          )}
          {!options.length && !suggest.query.trim() && <li className="suggest-empty">Type to search notes</li>}
        </ul>
      )}
    </div>
  );
}
