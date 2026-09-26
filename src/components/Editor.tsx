"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { FilePlus2 } from "lucide-react";
import { EditorSelection, EditorState, Prec, Transaction } from "@codemirror/state";
import { EditorView, keymap, placeholder } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { indentUnit } from "@codemirror/language";
import { Note, folderOf, titleOf } from "@/lib/vault";
import { indexOf, toast, useVault, validateTitle, vault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";
import { continueList, diff, indent, linkSelection, pairBrackets, setActiveEditor, activeEditor, wrap } from "@/lib/cm";
import { livePreview, refreshPreview } from "@/lib/live-preview";

interface Suggest {
  query: string;
  start: number;
  top: number;
  left: number;
  active: number;
}

const PLACEHOLDER = "Start writing…\n\nLink notes with [[double brackets]], and write flashcards like  Hallo :: Hello";

export default function Editor({ note, autoFocus = false }: { note: Note; autoFocus?: boolean }) {
  const wrapper = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const { notes } = useVault();
  const [suggest, setSuggest] = useState<Suggest | null>(null);
  const index = indexOf(notes);

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

  const canCreate = !!suggest && !!suggest.query.trim() && !index.resolve(suggest.query.trim());
  const count = options.length + (canCreate ? 1 : 0);

  /** Put the picked title between the brackets and close them. */
  const choose = (title: string, create = false) => {
    const v = view.current;
    if (!v || !suggest) return;
    const caret = v.state.selection.main.head;
    const closed = v.state.sliceDoc(caret, caret + 2) === "]]";
    const after = suggest.start + title.length + 2;
    v.dispatch({
      changes: { from: suggest.start, to: caret, insert: closed ? title : `${title}]]` },
      selection: { anchor: after },
      userEvent: "input.complete",
    });
    v.focus();
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

  // CodeMirror's handlers are created once per note; they read the latest values through this ref.
  const live = useRef({ suggest, count, options, index, content: note.content, autoFocus, choose, openLink });
  useLayoutEffect(() => {
    live.current = { suggest, count, options, index, content: note.content, autoFocus, choose, openLink };
  });

  useLayoutEffect(() => {
    const parent = host.current;
    const frame = wrapper.current;
    if (!parent || !frame) return;
    const noteId = note.id;

    const updateSuggest = (v: EditorView) => {
      const sel = v.state.selection.main;
      const line = v.state.doc.lineAt(sel.head);
      const m = v.hasFocus && sel.empty ? /\[\[([^[\]\n|#]*)$/.exec(v.state.sliceDoc(line.from, sel.head)) : null;
      if (!m) return setSuggest(null);
      const query = m[1];
      v.requestMeasure({
        read: () => ({ caret: v.coordsAtPos(sel.head), box: frame.getBoundingClientRect() }),
        write: ({ caret, box }) => {
          if (!caret) return;
          setSuggest((s) => ({
            query,
            start: sel.head - query.length,
            top: caret.bottom - box.top,
            left: caret.left - box.left,
            active: s?.query === query ? s.active : 0,
          }));
        },
      });
    };

    const suggestKeys = Prec.highest(
      keymap.of([
        ...(["ArrowDown", "ArrowUp"] as const).map((key) => ({
          key,
          run: () => {
            const { suggest: s, count: n } = live.current;
            if (!s) return false;
            const delta = key === "ArrowDown" ? 1 : -1;
            setSuggest({ ...s, active: (s.active + delta + n) % Math.max(n, 1) });
            return true;
          },
        })),
        ...["Enter", "Tab"].map((key) => ({
          key,
          run: () => {
            const { suggest: s, count: n, options: opts, choose: pick } = live.current;
            if (!s || !n) return false;
            const hit = opts[s.active];
            pick(hit ? titleOf(hit.path) : s.query.trim(), !hit);
            return true;
          },
        })),
        {
          key: "Escape",
          run: () => {
            if (!live.current.suggest) return false;
            setSuggest(null);
            return true;
          },
        },
      ]),
    );

    const v = new EditorView({
      parent,
      state: EditorState.create({
        doc: live.current.content,
        extensions: [
          suggestKeys,
          keymap.of([
            { key: "Enter", run: continueList },
            { key: "Tab", run: (ed) => indent(ed, false), shift: (ed) => indent(ed, true) },
            { key: "Mod-b", run: (ed) => wrap(ed, "**") },
            { key: "Mod-i", run: (ed) => wrap(ed, "*") },
            { key: "[", run: linkSelection },
            ...historyKeymap,
            ...defaultKeymap,
          ]),
          history(),
          pairBrackets,
          indentUnit.of("\t"),
          EditorView.lineWrapping,
          EditorView.contentAttributes.of({
            spellcheck: "true",
            autocorrect: "on",
            autocapitalize: "sentences",
            "aria-label": "Note text",
          }),
          placeholder(PLACEHOLDER),
          livePreview((target) => !!live.current.index.resolve(target)),
          EditorView.domEventHandlers({
            mousedown: (e) => {
              if (e.button !== 0 || e.shiftKey || e.altKey) return false;
              const el = (e.target as HTMLElement).closest?.<HTMLElement>(".ed-link, .ed-ext");
              if (!el) return false;
              e.preventDefault();
              if (el.dataset.href) window.open(el.dataset.href, "_blank", "noopener,noreferrer");
              else live.current.openLink(el.dataset.target ?? "", e.metaKey || e.ctrlKey);
              return true;
            },
          }),
          EditorView.updateListener.of((u) => {
            const external = u.transactions.some((tr) => tr.annotation(Transaction.remote));
            if (u.docChanged && !external) vault.updateNote(noteId, u.state.doc.toString());
            if (u.focusChanged) {
              if (u.view.hasFocus) setActiveEditor(u.view);
              setUI({ editorFocused: u.view.hasFocus });
              if (!u.view.hasFocus) setTimeout(() => setSuggest(null), 120);
            }
            if (u.docChanged || u.selectionSet || u.focusChanged) updateSuggest(u.view);
          }),
        ],
      }),
    });
    view.current = v;
    setActiveEditor(v);
    // On touch screens, focusing without a tap hides the bottom bar but opens no keyboard, so skip it.
    if (live.current.autoFocus && !matchMedia("(pointer: coarse)").matches) v.focus();

    return () => {
      if (v.hasFocus) setUI({ editorFocused: false });
      if (activeEditor() === v) setActiveEditor(null);
      v.destroy();
      view.current = null;
    };
  }, [note.id]);

  // Outside changes (a rename rewriting links, a task ticked in reading view, another tab):
  // apply only the part that changed so the caret stays put.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current === note.content) return;
    v.dispatch({ changes: diff(current, note.content), annotations: [Transaction.remote.of(true), Transaction.addToHistory.of(false)] });
  }, [note.content]);

  // Links turn from "new" to existing (and back) as notes come and go.
  useEffect(() => {
    view.current?.dispatch({ effects: refreshPreview.of(null) });
  }, [index]);

  // Jump to a specific line (used by "open source note" from a flashcard).
  const { pendingLine } = useUI();
  useLayoutEffect(() => {
    const v = view.current;
    if (pendingLine === null || !v) return;
    setUI({ pendingLine: null });
    const line = v.state.doc.line(Math.min(pendingLine + 1, v.state.doc.lines));
    v.focus();
    v.dispatch({
      selection: EditorSelection.range(line.from, line.to),
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
  }, [pendingLine]);

  return (
    <div className="editor" ref={wrapper}>
      <div ref={host} />
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
          {canCreate && (
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
