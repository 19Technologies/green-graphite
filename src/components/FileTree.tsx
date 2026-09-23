"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen, ChevronRight, FilePlus2, FileText, Folder, FolderInput, FolderOpen, FolderPlus, ChevronsDownUp, PanelTop,
  Pencil, Trash2, Check, X,
} from "lucide-react";
import Sheet from "./Sheet";
import { Note, folderOf, titleOf } from "@/lib/vault";
import { allFolders, cardsOf, toast, useVault, vault } from "@/lib/store";
import { setUI } from "@/lib/ui";

type Editing = { kind: "note" | "folder"; key: string } | null;
type Ctx = { kind: "note" | "folder"; key: string; step?: "move" | "confirm" } | null;

function InlineInput({ initial, onDone }: { initial: string; onDone: (value: string | null) => void }) {
  const [value, setValue] = useState(initial);
  return (
    <input
      className="tree-input"
      autoFocus
      value={value}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onDone(value);
        if (e.key === "Escape") onDone(null);
      }}
      onBlur={() => onDone(value)}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function ConfirmDelete({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <span className="tree-confirm" onClick={(e) => e.stopPropagation()}>
      Delete?
      <button className="icon-btn is-danger" onClick={onYes} aria-label="Confirm delete">
        <Check size={13} />
      </button>
      <button className="icon-btn" onClick={onNo} aria-label="Cancel">
        <X size={13} />
      </button>
    </span>
  );
}

export default function FileTree() {
  const state = useVault();
  const { notes, workspace } = state;
  const router = useRouter();
  const pathname = usePathname();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [ctx, setCtx] = useState<Ctx>(null);
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; fired: boolean }>({ fired: false });

  /** Long-press on touch, right-click on desktop: opens the item's action sheet. */
  const pressProps = (kind: "note" | "folder", key: string) => ({
    onTouchStart: () => {
      press.current.fired = false;
      clearTimeout(press.current.timer);
      press.current.timer = setTimeout(() => {
        press.current.fired = true;
        navigator.vibrate?.(10);
        setCtx({ kind, key });
      }, 450);
    },
    onTouchMove: () => clearTimeout(press.current.timer),
    onTouchEnd: (e: React.TouchEvent) => {
      clearTimeout(press.current.timer);
      if (press.current.fired) e.preventDefault();
    },
    onContextMenu: (e: React.MouseEvent) => {
      e.preventDefault();
      setCtx({ kind, key });
    },
  });

  const folders = useMemo(() => allFolders(state), [state]);
  const cardCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cardsOf(notes)) m.set(c.noteId, (m.get(c.noteId) ?? 0) + 1);
    return m;
  }, [notes]);

  const activeFolder = workspace.active && notes[workspace.active] ? folderOf(notes[workspace.active].path) : "";

  const open = (id: string, e: React.MouseEvent) => {
    vault.openNote(id, { newTab: e.metaKey || e.ctrlKey });
    setUI({ mobileLeft: false });
    if (pathname !== "/") router.push("/");
  };

  const newNote = (folder: string) => {
    const id = vault.createNote({ folder });
    setUI({ pendingRename: id, mobileLeft: false });
    if (pathname !== "/") router.push("/");
  };

  const newFolder = (parent: string) => {
    const path = vault.createFolder(parent);
    setEditing({ kind: "folder", key: path });
  };

  const drop = (folder: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTarget(null);
    const id = e.dataTransfer.getData("text/graphite-note");
    if (!id) return;
    const error = vault.moveNote(id, folder);
    if (error) toast(error);
  };

  const dropProps = (folder: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes("text/graphite-note")) return;
      e.preventDefault();
      e.stopPropagation();
      setDropTarget(folder);
    },
    onDragLeave: () => setDropTarget((t) => (t === folder ? null : t)),
    onDrop: (e: React.DragEvent) => {
      e.stopPropagation();
      drop(folder, e);
    },
  });

  const renderNote = (n: Note, depth: number) => {
    const isEditing = editing?.kind === "note" && editing.key === n.id;
    const cards = cardCounts.get(n.id);
    return (
      <li key={n.id}>
        <div
          className={`tree-row is-note${workspace.active === n.id ? " is-active" : ""}`}
          style={{ paddingLeft: 10 + depth * 14 }}
          draggable={!isEditing}
          onDragStart={(e) => {
            e.dataTransfer.setData("text/graphite-note", n.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={(e) => !isEditing && open(n.id, e)}
          onDoubleClick={() => setEditing({ kind: "note", key: n.id })}
          title={n.path}
          {...pressProps("note", n.id)}
        >
          <FileText size={14} className="tree-icon" />
          {isEditing ? (
            <InlineInput
              initial={titleOf(n.path)}
              onDone={(v) => {
                setEditing(null);
                if (v === null) return;
                const err = vault.renameNote(n.id, v);
                if (err) toast(err);
              }}
            />
          ) : (
            <span className="tree-label">{titleOf(n.path)}</span>
          )}
          {confirming === n.id ? (
            <ConfirmDelete
              onYes={() => {
                setConfirming(null);
                vault.deleteNote(n.id);
              }}
              onNo={() => setConfirming(null)}
            />
          ) : (
            !isEditing && (
              <>
                {cards ? <span className="tree-badge" title={`${cards} flashcards`}>{cards}</span> : null}
                <span className="tree-actions">
                  <button className="icon-btn" aria-label="Rename" onClick={(e) => { e.stopPropagation(); setEditing({ kind: "note", key: n.id }); }}>
                    <Pencil size={12} />
                  </button>
                  <button className="icon-btn" aria-label="Delete" onClick={(e) => { e.stopPropagation(); setConfirming(n.id); }}>
                    <Trash2 size={12} />
                  </button>
                </span>
              </>
            )
          )}
        </div>
      </li>
    );
  };

  const renderFolder = (path: string, depth: number): React.ReactNode => {
    const open = workspace.expanded.includes(path);
    const isEditing = editing?.kind === "folder" && editing.key === path;
    const childFolders = folders.filter((f) => folderOf(f) === path);
    const childNotes = Object.values(notes)
      .filter((n) => folderOf(n.path) === path)
      .sort((a, b) => titleOf(a.path).localeCompare(titleOf(b.path)));
    const key = `folder:${path}`;
    return (
      <li key={key}>
        <div
          className={`tree-row is-folder${dropTarget === path ? " is-drop" : ""}${activeFolder === path && !open ? " has-active" : ""}`}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => !isEditing && vault.toggleFolder(path)}
          onDoubleClick={() => setEditing({ kind: "folder", key: path })}
          {...dropProps(path)}
          {...pressProps("folder", path)}
        >
          <ChevronRight size={13} className={`tree-chevron${open ? " is-open" : ""}`} />
          {open ? <FolderOpen size={14} className="tree-icon" /> : <Folder size={14} className="tree-icon" />}
          {isEditing ? (
            <InlineInput
              initial={titleOf(path)}
              onDone={(v) => {
                setEditing(null);
                if (v === null) return;
                const err = vault.renameFolder(path, v);
                if (err) toast(err);
              }}
            />
          ) : (
            <span className="tree-label">{titleOf(path)}</span>
          )}
          {confirming === key ? (
            <ConfirmDelete
              onYes={() => {
                setConfirming(null);
                vault.deleteFolder(path);
              }}
              onNo={() => setConfirming(null)}
            />
          ) : (
            !isEditing && (
              <span className="tree-actions">
                <button className="icon-btn" aria-label="New note in folder" onClick={(e) => { e.stopPropagation(); vault.toggleFolder(path, true); newNote(path); }}>
                  <FilePlus2 size={12} />
                </button>
                <button className="icon-btn" aria-label="Delete folder" onClick={(e) => { e.stopPropagation(); setConfirming(key); }}>
                  <Trash2 size={12} />
                </button>
              </span>
            )
          )}
        </div>
        {open && (childFolders.length > 0 || childNotes.length > 0) && (
          <ul className="tree-children">
            {childFolders.map((f) => renderFolder(f, depth + 1))}
            {childNotes.map((n) => renderNote(n, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const closeCtx = () => setCtx(null);
  const ctxNote = ctx?.kind === "note" ? notes[ctx.key] : undefined;
  const ctxCards = ctxNote ? cardCounts.get(ctxNote.id) ?? 0 : 0;
  const ctxInside = ctx?.kind === "folder"
    ? Object.values(notes).filter((n) => n.path.startsWith(ctx.key + "/")).length
    : 0;
  const item = (icon: React.ReactNode, label: string, run: () => void, danger = false) => (
    <button className={`sheet-item${danger ? " is-danger" : ""}`} onClick={run}>
      {icon}
      <span>{label}</span>
    </button>
  );
  const sheetBody = () => {
    if (!ctx) return null;
    if (ctx.step === "move" && ctxNote) {
      const here = folderOf(ctxNote.path);
      return (
        <div className="sheet-list">
          {["", ...folders].map((f) => (
            <button
              key={f || "(root)"}
              className={`sheet-item${f === here ? " is-current" : ""}`}
              disabled={f === here}
              onClick={() => {
                closeCtx();
                const err = vault.moveNote(ctxNote.id, f);
                if (err) toast(err);
              }}
            >
              <Folder size={18} />
              <span>{f || "Vault root"}</span>
            </button>
          ))}
        </div>
      );
    }
    if (ctx.step === "confirm") {
      return (
        <div className="sheet-confirm">
          <span>
            {ctx.kind === "note"
              ? "Delete this note?"
              : `Delete this folder${ctxInside ? ` and its ${ctxInside} ${ctxInside === 1 ? "note" : "notes"}` : ""}?`}
          </span>
          <button className="btn btn-ghost" onClick={closeCtx}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={() => {
              closeCtx();
              if (ctx.kind === "note") vault.deleteNote(ctx.key);
              else vault.deleteFolder(ctx.key);
            }}
          >
            Delete
          </button>
        </div>
      );
    }
    if (ctxNote) {
      return (
        <div className="sheet-list">
          {item(<PanelTop size={18} />, "Open in new tab", () => {
            closeCtx();
            vault.openNote(ctxNote.id, { newTab: true });
            setUI({ mobileLeft: false });
            if (pathname !== "/") router.push("/");
          })}
          {item(<Pencil size={18} />, "Rename", () => {
            closeCtx();
            setEditing({ kind: "note", key: ctxNote.id });
          })}
          {item(<FolderInput size={18} />, "Move to…", () => setCtx({ ...ctx, step: "move" }))}
          {ctxCards > 0 &&
            item(<BookOpen size={18} />, `Study ${ctxCards} ${ctxCards === 1 ? "card" : "cards"}`, () => {
              closeCtx();
              router.push(`/flashcards/study?note=${ctxNote.id}`);
            })}
          {item(<Trash2 size={18} />, "Delete", () => setCtx({ ...ctx, step: "confirm" }), true)}
        </div>
      );
    }
    return (
      <div className="sheet-list">
        {item(<FilePlus2 size={18} />, "New note here", () => {
          closeCtx();
          vault.toggleFolder(ctx.key, true);
          newNote(ctx.key);
        })}
        {item(<FolderPlus size={18} />, "New folder inside", () => {
          closeCtx();
          vault.toggleFolder(ctx.key, true);
          newFolder(ctx.key);
        })}
        {item(<Pencil size={18} />, "Rename", () => {
          closeCtx();
          setEditing({ kind: "folder", key: ctx.key });
        })}
        {item(<Trash2 size={18} />, "Delete folder", () => setCtx({ ...ctx, step: "confirm" }), true)}
      </div>
    );
  };

  const rootFolders = folders.filter((f) => !f.includes("/"));
  const rootNotes = Object.values(notes)
    .filter((n) => !folderOf(n.path))
    .sort((a, b) => titleOf(a.path).localeCompare(titleOf(b.path)));

  return (
    <div className="file-tree">
      <div className="panel-toolbar">
        <button className="icon-btn" title="New note" onClick={() => newNote(activeFolder)}>
          <FilePlus2 size={16} />
        </button>
        <button className="icon-btn" title="New folder" onClick={() => newFolder("")}>
          <FolderPlus size={16} />
        </button>
        <button
          className="icon-btn"
          title="Collapse all"
          onClick={() => folders.forEach((f) => vault.toggleFolder(f, false))}
        >
          <ChevronsDownUp size={16} />
        </button>
      </div>
      <ul
        className={`tree-root${dropTarget === "" ? " is-drop" : ""}`}
        {...dropProps("")}
      >
        {rootFolders.map((f) => renderFolder(f, 0))}
        {rootNotes.map((n) => renderNote(n, 0))}
        {Object.keys(notes).length === 0 && (
          <li className="tree-empty">
            No notes yet.{" "}
            <button className="link-btn" onClick={() => newNote("")}>
              Create one
            </button>
          </li>
        )}
      </ul>
      <Sheet
        open={!!ctx}
        onClose={closeCtx}
        title={ctx ? (ctx.step === "move" ? "Move to…" : titleOf(ctxNote ? ctxNote.path : ctx.key)) : undefined}
      >
        {sheetBody()}
      </Sheet>
    </div>
  );
}
