"use client";

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { Note, folderOf, titleOf } from "@/lib/vault";
import { indexOf, toast, useVault, validateTitle, vault } from "@/lib/store";
import { WIKI_RE, parseWikiInner } from "@/lib/links";
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

/** The [[link]] (if any) drawn under the pointer, from the highlight layer behind the textarea. */
function linkAtPoint(x: number, y: number) {
  const el = document.elementsFromPoint(x, y).find((e) => e.classList.contains("ed-link"));
  return el ? (el as HTMLElement).dataset.target ?? null : null;
}

export default function Editor({ note, autoFocus = false }: { note: Note; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const { notes } = useVault();
  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const index = indexOf(notes);

  // Live preview for links: the same text drawn behind a transparent textarea, with [[links]] in green.
  const highlighted = useMemo(() => {
    const out: React.ReactNode[] = [];
    let last = 0;
    for (const m of note.content.matchAll(WIKI_RE)) {
      const start = m.index!;
      if (start > last) out.push(note.content.slice(last, start));
      const { target, heading } = parseWikiInner(m[1]);
      const exists = !!index.resolve(target);
      out.push(
        <Fragment key={start}>
          <span className="ed-bracket">[[</span>
          <span
            className={`ed-link${exists ? "" : " is-unresolved"}`}
            data-target={heading ? `${target}#${heading}` : target}
          >
            {m[1]}
          </span>
          <span className="ed-bracket">]]</span>
        </Fragment>,
      );
      last = start + m[0].length;
    }
    out.push(note.content.slice(last));
    return out;
  }, [note.content, index]);

  // Link suggestions match the typed name directly (loose fuzzy matching linked the wrong notes).
  const options = useMemo(() => {
    if (!suggest) return [];
    const all = Object.values(notes).filter((n) => n.id !== note.id);
    const q = suggest.query.trim().toLowerCase();
    if (!q) return [...all].sort((a, b) => b.updated - a.updated).slice(0, 8);
    return all
      .filter((n) => n.path.toLowerCase().includes(q))
      .sort((a, b) => {
        const ta = titleOf(a.path).toLowerCase();
        const tb = titleOf(b.path).toLowerCase();
        return Number(!ta.startsWith(q)) - Number(!tb.startsWith(q)) || ta.length - tb.length;
      })
      .slice(0, 8);
  }, [suggest, notes, note.id]);

  // Grow with content so the whole pane scrolls like a document.
  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [note.content]);

  useLayoutEffect(() => {
    // On touch screens, focusing without a tap hides the bottom bar but opens no keyboard, so skip it.
    if (autoFocus && !matchMedia("(pointer: coarse)").matches) ref.current?.focus();
  }, [autoFocus, note.id]);

  // Obsidian-style bracket pairing: "[[" becomes "[[]]" with the caret inside, and typing "]"
  // over a closing bracket steps over it. Uses beforeinput so it's instant and works on phones.
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType !== "insertText" || !e.data) return;
      const { selectionStart: start, selectionEnd: end, value } = ta;
      if (start !== end) return;
      if (e.data === "[" && value[start - 1] === "[" && value.slice(start, start + 2) !== "]]") {
        e.preventDefault();
        insert(ta, start, end, "[]]");
        ta.setSelectionRange(start + 1, start + 1);
      } else if (e.data === "]" && value[start] === "]" && /\[\[[^\[\]\n]*\]?$/.test(value.slice(0, start))) {
        e.preventDefault();
        ta.setSelectionRange(start + 1, start + 1);
      }
    };
    ta.addEventListener("beforeinput", onBeforeInput);
    return () => ta.removeEventListener("beforeinput", onBeforeInput);
  }, [note.id]);

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

  const choose = (title: string, create = false) => {
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
    // "Create note" really creates it, in the same folder, without leaving this note.
    if (create && !index.resolve(title) && !validateTitle(title)) {
      vault.createNote({ folder: folderOf(note.path), title, open: false });
      toast(`Created “${title}”`);
    }
  };

  /** Click or tap a green link in the editor to open it (or create it if it doesn't exist yet). */
  const openLink = (target: string, newTab: boolean) => {
    const hash = target.indexOf("#");
    const name = hash === -1 ? target : target.slice(0, hash);
    const existing = index.resolve(name);
    if (existing) vault.openNote(existing.id, { newTab });
    else {
      vault.createFromLink(name, note.id);
      toast(`Created “${name}”`);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (suggest) {
      const count = options.length + (suggest.query.trim() && !index.resolve(suggest.query.trim()) ? 1 : 0);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setSuggest({ ...suggest, active: (suggest.active + delta + count) % Math.max(count, 1) });
        return;
      }
      if ((e.key === "Enter" || e.key === "Tab") && count) {
        e.preventDefault();
        const pick = options[suggest.active];
        choose(pick ? titleOf(pick.path) : suggest.query.trim(), !pick);
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
      <div className="editor-backdrop" aria-hidden>
        {highlighted}
        {"\n"}
      </div>
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
        onClick={(e) => {
          const ta = e.currentTarget;
          if (ta.selectionStart !== ta.selectionEnd) return;
          const target = linkAtPoint(e.clientX, e.clientY);
          if (target) openLink(target, e.metaKey || e.ctrlKey);
        }}
        onMouseMove={(e) => {
          const over = !!linkAtPoint(e.clientX, e.clientY);
          e.currentTarget.style.cursor = over ? "pointer" : "";
          e.currentTarget.parentElement?.classList.toggle("is-over-link", over);
        }}
        onMouseLeave={(e) => e.currentTarget.parentElement?.classList.remove("is-over-link")}
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
          {suggest.query.trim() && !index.resolve(suggest.query.trim()) && (
            <li
              role="option"
              aria-selected={suggest.active === options.length}
              className={`suggest-create${suggest.active === options.length ? " is-active" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(suggest.query.trim(), true);
              }}
            >
              <FilePlus2 size={14} /> Create note “{suggest.query.trim()}”
            </li>
          )}
          {!options.length && !suggest.query.trim() && <li className="suggest-empty">Type to search notes</li>}
        </ul>
      )}
    </div>
  );
}
