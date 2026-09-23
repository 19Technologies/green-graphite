"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays, ClipboardCopy, Columns2, Command, Eye, FilePlus2, Link2, MoreVertical,
  Network, PanelLeft, PanelRight, PenLine, Search, TextCursorInput, Trash2, X,
} from "lucide-react";
import { Note, ViewMode, folderOf, titleOf } from "@/lib/vault";
import { cardsOf, toast, useVault, vault } from "@/lib/store";
import { setUI, useUI } from "@/lib/ui";
import MarkdownView from "./MarkdownView";
import Sheet from "./Sheet";
import Editor from "./Editor";
import RightPanel from "./RightPanel";

const MODES: Array<{ mode: ViewMode; label: string; icon: React.ReactNode }> = [
  { mode: "read", label: "Read", icon: <Eye size={14} /> },
  { mode: "split", label: "Split", icon: <Columns2 size={14} /> },
  { mode: "edit", label: "Edit", icon: <PenLine size={14} /> },
];

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
          if (commit()) (document.querySelector(".editor-input") as HTMLTextAreaElement | null)?.focus();
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
  const folder = folderOf(note.path);

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
        pullStart.current = scroller.current?.scrollTop === 0 && !(e.target as Element).closest("textarea") ? e.touches[0].clientY : null;
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
          {folder && (
            <div className="breadcrumb">
              {folder.split("/").map((part, i, arr) => (
                <span key={i}>
                  {part}
                  {i < arr.length - 1 && <span className="breadcrumb-sep">/</span>}
                </span>
              ))}
            </div>
          )}
          <InlineTitle note={note} />
          {cardCount > 0 && (
            <div className="note-meta">
              {cardCount > 0 && (
                <Link href={`/flashcards/study?note=${note.id}`} className="note-cards-chip">
                  <BookOpen size={12} /> {cardCount} {cardCount === 1 ? "card" : "cards"} · study
                </Link>
              )}
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

function NoteMenu({ note }: { note: Note }) {
  const router = useRouter();
  const { workspace, notes } = useVault();
  const [confirm, setConfirm] = useState(false);
  const cards = cardsOf(notes).filter((c) => c.noteId === note.id).length;
  const close = () => setUI({ sheet: null });
  const reading = workspace.mode === "read";
  const item = (icon: React.ReactNode, label: string, run: () => void, danger = false) => (
    <button className={`sheet-item${danger ? " is-danger" : ""}`} onClick={run}>
      {icon}
      <span>{label}</span>
    </button>
  );
  return (
    <div className="sheet-list">
      {item(reading ? <PenLine size={18} /> : <Eye size={18} />, reading ? "Edit note" : "Reading view", () => {
        vault.setMode(reading ? "edit" : "read");
        close();
      })}
      {item(<TextCursorInput size={18} />, "Rename", () => setUI({ sheet: null, pendingRename: note.id }))}
      {cards > 0 &&
        item(<BookOpen size={18} />, `Study ${cards} ${cards === 1 ? "card" : "cards"}`, () => router.push(`/flashcards/study?note=${note.id}`))}
      {item(<Link2 size={18} />, "Links, cards & outline", () => setUI({ sheet: null, mobileRight: true }))}
      {item(<Network size={18} />, "Open graph view", () => router.push("/graph"))}
      {item(<ClipboardCopy size={18} />, "Copy note text", () => {
        navigator.clipboard?.writeText(note.content).then(() => toast("Copied to clipboard"), () => toast("Couldn't copy"));
        close();
      })}
      {confirm ? (
        <div className="sheet-confirm">
          <span>Delete “{titleOf(note.path)}”?</span>
          <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn btn-danger" onClick={() => { close(); vault.deleteNote(note.id); }}>Delete</button>
        </div>
      ) : (
        item(<Trash2 size={18} />, "Delete note", () => setConfirm(true), true)
      )}
    </div>
  );
}

function MobileHeader({ note, mode }: { note?: Note; mode: ViewMode }) {
  const { sheet } = useUI();
  return (
    <header className="mobile-header">
      <button className="icon-btn" aria-label="Files" onClick={() => setUI({ mobileLeft: true, leftView: "files" })}>
        <PanelLeft size={20} />
      </button>
      <button className="mobile-title" onClick={() => setUI({ palette: "notes" })} aria-label="Switch note">
        {note ? (
          <>
            {folderOf(note.path) && <small>{folderOf(note.path)}</small>}
            <span>{titleOf(note.path)}</span>
          </>
        ) : (
          <span>Green Graphite</span>
        )}
      </button>
      {note && (
        <>
          <button
            className="icon-btn is-on"
            aria-label={mode === "read" ? "Edit note" : "Reading view"}
            onClick={() => vault.setMode(mode === "read" ? "edit" : "read")}
          >
            {mode === "read" ? <PenLine size={19} /> : <BookOpen size={19} />}
          </button>
          <button className="icon-btn" aria-label="More options" onClick={() => setUI({ sheet: "note" })}>
            <MoreVertical size={20} />
          </button>
          <Sheet open={sheet === "note"} onClose={() => setUI({ sheet: null })} title={titleOf(note.path)}>
            <NoteMenu note={note} />
          </Sheet>
        </>
      )}
    </header>
  );
}

function EmptyWorkspace() {
  const { notes } = useVault();
  const recent = Object.values(notes).sort((a, b) => b.updated - a.updated).slice(0, 5);
  return (
    <div className="empty-workspace">
      <div className="empty-inner">
        <h1>No note open</h1>
        <div className="empty-actions">
          <button onClick={() => setUI({ pendingRename: vault.createNote() })}>
            <FilePlus2 size={15} /> Create a note
          </button>
          <button onClick={() => vault.openDaily()}>
            <CalendarDays size={15} /> Open today&apos;s daily note
          </button>
          <button onClick={() => setUI({ palette: "notes" })}>
            <Search size={15} /> Go to a note <kbd>⌘O</kbd>
          </button>
          <button onClick={() => setUI({ palette: "commands" })}>
            <Command size={15} /> All commands <kbd>⌘K</kbd>
          </button>
        </div>
        {recent.length > 0 && (
          <>
            <div className="panel-caption">Recently edited</div>
            <div className="empty-recent">
              {recent.map((n) => (
                <button key={n.id} onClick={() => vault.openNote(n.id)}>
                  {titleOf(n.path)}
                  {folderOf(n.path) && <span>{folderOf(n.path)}</span>}
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
  const { mobileRight } = useUI();
  const note = workspace.active ? notes[workspace.active] : undefined;
  const canBack = workspace.history.slice(0, workspace.historyIndex).some((id) => notes[id]);
  const canForward = workspace.history.slice(workspace.historyIndex + 1).some((id) => notes[id]);

  return (
    <div className="workspace" data-right={workspace.rightOpen ? "open" : "closed"} data-mobile-right={mobileRight ? "open" : "closed"}>
      <MobileHeader note={note} mode={workspace.mode} />
      <div className="tabbar">
        <div className="nav-arrows">
          <button className="icon-btn" disabled={!canBack} onClick={() => vault.go(-1)} title="Back (⌘⌥←)">
            <ArrowLeft size={16} />
          </button>
          <button className="icon-btn" disabled={!canForward} onClick={() => vault.go(1)} title="Forward (⌘⌥→)">
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="tabs" role="tablist">
          {workspace.tabs.map((id) => {
            const n = notes[id];
            if (!n) return null;
            return (
              <div
                key={id}
                role="tab"
                aria-selected={id === workspace.active}
                className={`tab${id === workspace.active ? " is-active" : ""}`}
                onClick={() => vault.openNote(id)}
                onAuxClick={(e) => e.button === 1 && vault.closeTab(id)}
                title={n.path}
              >
                <span className="tab-title">{titleOf(n.path)}</span>
                <button
                  className="tab-close"
                  aria-label={`Close ${titleOf(n.path)}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    vault.closeTab(id);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
          <button className="tab-new icon-btn" title="New note" onClick={() => setUI({ pendingRename: vault.createNote({ newTab: true }) })}>
            <FilePlus2 size={15} />
          </button>
        </div>
        {note && (
          <div className="segmented mode-switch" role="radiogroup" aria-label="View mode">
            {MODES.map((m) => (
              <button
                key={m.mode}
                role="radio"
                aria-checked={workspace.mode === m.mode}
                className={`${workspace.mode === m.mode ? "is-on" : ""}${m.mode === "split" ? " only-wide" : ""}`}
                onClick={() => vault.setMode(m.mode)}
                title={m.mode === "split" ? "Edit with live preview" : `${m.label} (⌘E)`}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        )}
        <button
          className={`icon-btn${workspace.rightOpen ? " is-on" : ""}`}
          aria-label="Toggle right sidebar"
          title="Links, cards & outline"
          onClick={() => {
            if (window.matchMedia("(max-width: 1100px)").matches) setUI({ mobileRight: !mobileRight });
            else vault.setPanel("rightOpen");
          }}
        >
          <PanelRight size={17} />
        </button>
      </div>

      <div className="workspace-body">
        <section className="pane">{note ? <NoteView key={note.id} note={note} mode={workspace.mode} /> : <EmptyWorkspace />}</section>
        {note && (
          <aside className="right-panel" aria-label="Note details">
            <RightPanel note={note} />
          </aside>
        )}
      </div>
    </div>
  );
}
