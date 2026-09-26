"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BookOpen, ClipboardCopy, Columns2, Command, GitFork, Layers, Link2, MoreHorizontal, MoreVertical,
  PanelLeft, PenLine, TextCursorInput, Trash2,
} from "lucide-react";
import { Note, ViewMode, folderOf, titleOf } from "@/lib/vault";
import { cardsOf, toast, useVault, vault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";
import { focusEditor } from "@/lib/cm";
import MarkdownView from "./MarkdownView";
import Sheet, { type Anchor } from "./Sheet";
import Editor from "./Editor";

function InlineTitle({ note }: { note: Note }) {
  const { pendingRename } = useUI();
  const ref = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingRename !== note.id) return;
    setUI({ pendingRename: null });
    ref.current?.focus();
    ref.current?.select();
  }, [pendingRename, note.id]);

  const commit = () => {
    if (draft === null) return true;
    const err = vault.renameNote(note.id, draft);
    if (err) {
      setError(err);
      toast(err);
      ref.current?.focus();
      return false;
    }
    setDraft(null);
    setError(null);
    return true;
  };

  return (
    <input
      ref={ref}
      className={`inline-title${error ? " has-error" : ""}`}
      value={draft ?? titleOf(note.path)}
      aria-label="Note title"
      spellCheck={false}
      onChange={(e) => {
        setDraft(e.target.value);
        setError(null);
      }}
      onBlur={() => {
        if (error) {
          setDraft(null);
          setError(null);
        } else commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (commit()) focusEditor();
        }
        if (e.key === "Escape") {
          setDraft(null);
          setError(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function NoteView({ note, mode }: { note: Note; mode: ViewMode }) {
  const { notes, settings } = useVault();
  const { pendingHeading } = useUI();
  const scroller = useRef<HTMLDivElement>(null);
  const pullStart = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const PULL = 80;
  const cardCount = cardsOf(notes).filter((c) => c.noteId === note.id).length;
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [note.id]);

  useEffect(() => {
    if (!pendingHeading) return;
    const el = document.getElementById(pendingHeading);
    setUI({ pendingHeading: null });
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1400);
    }
  }, [pendingHeading, note.id, mode]);

  const toggleTask = useCallback(
    (line: number) => {
      const lines = note.content.split("\n");
      const l = lines[line];
      if (l === undefined) return;
      lines[line] = l.replace(/\[( |x|X)\]/, (_m, c: string) => (c === " " ? "[x]" : "[ ]"));
      vault.updateNote(note.id, lines.join("\n"));
    },
    [note.id, note.content],
  );

  const preview = (
    <MarkdownView
      content={note.content}
      sourceId={note.id}
      cards
      blurAnswers={settings.blurAnswersInNotes}
      onToggleTask={toggleTask}
    />
  );

  return (
    <div
      ref={scroller}
      className={`note-scroll mode-${mode}`}
      data-mode={mode}
      onTouchStart={(e) => {
        pullStart.current = scroller.current?.scrollTop === 0 && !(e.target as Element).closest(".cm-editor") ? e.touches[0].clientY : null;
      }}
      onTouchMove={(e) => {
        if (pullStart.current === null) return;
        const d = e.touches[0].clientY - pullStart.current;
        if (d < 0 || (scroller.current?.scrollTop ?? 0) > 0) return setPull(0);
        setPull(Math.min(d * 0.5, PULL * 1.3));
      }}
      onTouchEnd={() => {
        if (pull >= PULL) {
          setUI({ palette: "commands" });
          navigator.vibrate?.(10);
        }
        pullStart.current = null;
        setPull(0);
      }}
    >
      <div className={`pull-hint${pull >= PULL ? " is-ready" : ""}`} style={{ height: pull, opacity: Math.min(1, pull / PULL) }} aria-hidden>
        <Command size={15} /> {pull >= PULL ? "Release for commands" : "Pull for commands"}
      </div>
      <article className="note">
        <header className="note-header">
          <InlineTitle note={note} />
          {cardCount > 0 && (
            <div className="note-meta">
              <Link href={`/flashcards/study?note=${note.id}`} className="note-cards-chip">
                <Layers size={13} /> {cardCount} {cardCount === 1 ? "flashcard" : "flashcards"}
                <span>Study</span>
              </Link>
            </div>
          )}
        </header>
        {mode === "read" && preview}
        {mode === "edit" && <Editor note={note} autoFocus={!note.content} />}
        {mode === "split" && (
          <div className="split">
            <Editor note={note} />
            <div className="split-preview">{preview}</div>
          </div>
        )}
        {mode === "read" && !note.content.trim() && (
          <button className="empty-note" onClick={() => vault.setMode("edit")}>
            This note is empty. <b>Start writing</b>
          </button>
        )}
      </article>
    </div>
  );
}

function NoteMenu({ note, onClose }: { note: Note; onClose: () => void }) {
  const router = useRouter();
  const { workspace, notes } = useVault();
  const [confirm, setConfirm] = useState(false);
  const cards = cardsOf(notes).filter((c) => c.noteId === note.id).length;
  const mode = workspace.mode;
  const item = (icon: React.ReactNode, label: string, run: () => void, extra = "") => (
    <button className={`sheet-item${extra}`} onClick={run}>
      {icon}
      <span>{label}</span>
    </button>
  );
  const setMode = (m: ViewMode) => () => {
    vault.setMode(m);
    onClose();
  };
  if (confirm) {
    return (
      <div className="sheet-confirm">
        <span>Delete “{titleOf(note.path)}”?</span>
        <button className="btn" onClick={() => setConfirm(false)}>Cancel</button>
        <button className="btn btn-danger" onClick={() => { onClose(); vault.deleteNote(note.id); }}>Delete</button>
      </div>
    );
  }
  return (
    <div className="sheet-list">
      {item(<BookOpen size={16} />, "Reading view", setMode("read"), mode === "read" ? " is-current" : "")}
      {item(<PenLine size={16} />, "Editing view", setMode("edit"), mode === "edit" ? " is-current" : "")}
      <span className="only-wide-flex">{item(<Columns2 size={16} />, "Split: edit and preview", setMode("split"), mode === "split" ? " is-current" : "")}</span>
      <span className="menu-sep" />
      {item(<TextCursorInput size={16} />, "Rename…", () => { onClose(); setUI({ pendingRename: note.id }); })}
      {cards > 0 &&
        item(<Layers size={16} />, `Study ${cards} ${cards === 1 ? "card" : "cards"}`, () => { onClose(); router.push(`/flashcards/study?note=${note.id}`); })}
      <span className="only-mobile-flex">
        {item(<Link2 size={16} />, "Backlinks, cards and outline", () => { onClose(); setUI({ mobileRight: true }); })}
      </span>
      {item(<GitFork size={16} />, "Open graph view", () => { onClose(); router.push("/graph"); })}
      {item(<ClipboardCopy size={16} />, "Copy note text", () => {
        navigator.clipboard?.writeText(note.content).then(() => toast("Copied to clipboard"), () => toast("Couldn't copy"));
        onClose();
      })}
      <span className="menu-sep" />
      {item(<Trash2 size={16} />, "Delete file", () => setConfirm(true), " is-danger")}
    </div>
  );
}

/** Desktop view header: history arrows, breadcrumb, reading/editing toggle, more options. */
function ViewHeader({ note, mode }: { note: Note; mode: ViewMode }) {
  const { notes, workspace } = useVault();
  const [menu, setMenu] = useState<Anchor>(null);
  const canBack = workspace.history.slice(0, workspace.historyIndex).some((id) => notes[id]);
  const canForward = workspace.history.slice(workspace.historyIndex + 1).some((id) => notes[id]);
  const folder = folderOf(note.path);
  return (
    <div className="view-header">
      <div className="view-header-nav">
        <button className="icon-btn" disabled={!canBack} onClick={() => vault.go(-1)} aria-label="Navigate back" title="Navigate back">
          <ArrowLeft size={17} />
        </button>
        <button className="icon-btn" disabled={!canForward} onClick={() => vault.go(1)} aria-label="Navigate forward" title="Navigate forward">
          <ArrowRight size={17} />
        </button>
      </div>
      <div className="view-header-title" title={note.path}>
        {folder && (
          <>
            <span className="crumb">{folder.split("/").join(" / ")}</span>
            <span className="crumb-sep">/</span>
          </>
        )}
        <button className="crumb-title" onClick={() => setUI({ pendingRename: note.id })}>
          {titleOf(note.path)}
        </button>
      </div>
      <div className="view-actions">
        <button
          className="icon-btn"
          aria-label={mode === "read" ? "Edit (⌘E)" : "Reading view (⌘E)"}
          title={mode === "read" ? "Currently in reading view. Click to edit (⌘E)" : "Currently editing. Click for reading view (⌘E)"}
          onClick={() => vault.setMode(mode === "read" ? "edit" : "read")}
        >
          {mode === "read" ? <PenLine size={17} /> : <BookOpen size={17} />}
        </button>
        <button
          className="icon-btn"
          aria-label="More options"
          title="More options"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setMenu({ x: r.right - 240, y: r.bottom + 4 });
          }}
        >
          <MoreHorizontal size={17} />
        </button>
      </div>
      <Sheet open={!!menu} anchor={menu} onClose={() => setMenu(null)}>
        <NoteMenu note={note} onClose={() => setMenu(null)} />
      </Sheet>
    </div>
  );
}

/** Phone header, as in Obsidian mobile. */
function MobileHeader({ note, mode }: { note?: Note; mode: ViewMode }) {
  const [menu, setMenu] = useState(false);
  return (
    <header className="mobile-header">
      <button className="icon-btn" aria-label="Open file explorer" onClick={() => setUI({ mobileLeft: true, leftView: "files" })}>
        <PanelLeft size={20} />
      </button>
      <button className="mobile-title" onClick={() => setUI({ palette: "notes" })} aria-label="Switch note">
        <span>{note ? titleOf(note.path) : "Green Graphite"}</span>
      </button>
      {note && (
        <>
          <button
            className="icon-btn"
            aria-label={mode === "read" ? "Edit note" : "Reading view"}
            onClick={() => vault.setMode(mode === "read" ? "edit" : "read")}
          >
            {mode === "read" ? <PenLine size={19} /> : <BookOpen size={19} />}
          </button>
          <button className="icon-btn" aria-label="More options" onClick={() => setMenu(true)}>
            <MoreVertical size={20} />
          </button>
          <Sheet open={menu} onClose={() => setMenu(false)} title={titleOf(note.path)}>
            <NoteMenu note={note} onClose={() => setMenu(false)} />
          </Sheet>
        </>
      )}
    </header>
  );
}

function EmptyWorkspace() {
  const { notes } = useVault();
  const all = Object.values(notes);
  const recent = [...all].sort((a, b) => b.updated - a.updated).slice(0, 5);
  const firstRun = all.length === 0;
  return (
    <div className="empty-workspace">
      <div className="hero-art" aria-hidden>
        <span className="bubble b1">[[Hallo]]</span>
        <span className="bubble b2">Hund :: dog</span>
        <span className="bubble b3">#deutsch</span>
        <span className="bubble b4">Ich ==bin== müde</span>
        <span className="bubble b5">Tschüss!</span>
      </div>
      <div className="empty-inner">
        <p className="eyebrow"><span className="dot" /> {firstRun ? "Your vault is ready" : "No note open"}</p>
        <h1 className="hero-title">{firstRun ? "Start your first note." : "Pick up where you left off."}</h1>
        <p className="hero-lede">
          Link ideas with <b>[[double brackets]]</b> and write flashcards like <b>Hallo :: Hello</b> right inside your notes.
        </p>
        <div className="hero-actions">
          <button className="btn btn-primary btn-lg" onClick={() => setUI({ pendingRename: vault.createNote() })}>
            Create a note
          </button>
          <button className="btn btn-lg" onClick={() => vault.openDaily()}>
            Today&apos;s daily note
          </button>
        </div>
        <button className="empty-action learn-link" onClick={() => setUI({ onboarding: true })}>
          New here? Take the 1-minute tour
        </button>
        {!firstRun && (
          <>
            <button className="empty-action" onClick={() => setUI({ palette: "notes" })}>
              Go to file <kbd>⌘O</kbd>
            </button>
            <div className="empty-sub">Recent files</div>
            <div className="recent-chips">
              {recent.map((n) => (
                <button key={n.id} className="chip" onClick={() => vault.openNote(n.id)} title={n.path}>
                  {titleOf(n.path)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Workspace() {
  const { notes, workspace } = useVault();
  const note = workspace.active ? notes[workspace.active] : undefined;
  return (
    <div className="workspace">
      <MobileHeader note={note} mode={workspace.mode} />
      <section className="pane">
        {note && <ViewHeader note={note} mode={workspace.mode} />}
        {note ? <NoteView key={note.id} note={note} mode={workspace.mode} /> : <EmptyWorkspace />}
      </section>
    </div>
  );
}
