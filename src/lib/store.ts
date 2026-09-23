"use client";
// A tiny external store: one immutable VaultState, persisted to localStorage.
import { useSyncExternalStore } from "react";
import {
  EMPTY_STATE,
  INVALID_TITLE_CHARS,
  STORAGE_KEY,
  Note,
  Settings,
  VaultState,
  ViewMode,
  folderOf,
  isoDay,
  loadState,
  newId,
  normalize,
  saveState,
  seedState,
  titleOf,
} from "./vault";
import { VaultIndex, buildIndex, rewriteLinks } from "./links";
import { Card, allCards } from "./cards";

let state: VaultState = EMPTY_STATE;
let loaded = false;
const listeners = new Set<() => void>();
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = undefined;
  if (!saveState(state)) toast("Couldn't save: browser storage is full");
}

function ensureLoaded() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  state = loadState();
  window.addEventListener("beforeunload", flush);
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      state = normalize(JSON.parse(e.newValue));
      listeners.forEach((l) => l());
    } catch {
      /* ignore malformed writes from other tabs */
    }
  });
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureLoaded();
  return state;
}

function set(update: (s: VaultState) => VaultState) {
  state = update(state);
  listeners.forEach((l) => l());
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 300);
}

export const getVault = () => state;

export function useVault() {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY_STATE);
}

/* Derived data is cached per `notes` object so every component shares one copy. */
const indexCache = new WeakMap<object, VaultIndex>();
const cardCache = new WeakMap<object, Card[]>();

export function indexOf(notes: VaultState["notes"]) {
  let idx = indexCache.get(notes);
  if (!idx) indexCache.set(notes, (idx = buildIndex(notes)));
  return idx;
}

export function cardsOf(notes: VaultState["notes"]) {
  let cards = cardCache.get(notes);
  if (!cards) cardCache.set(notes, (cards = allCards(notes, indexOf(notes).noteTags)));
  return cards;
}

export function useIndex() {
  return indexOf(useVault().notes);
}

export function useCards() {
  return cardsOf(useVault().notes);
}

/* ------------------------------------------------------------------ */
/* Toasts                                                              */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}
let toasts: Toast[] = [];
const toastListeners = new Set<() => void>();
const emitToasts = () => toastListeners.forEach((l) => l());

export function toast(message: string, action?: Toast["action"]) {
  const t = { id: Date.now() + Math.random(), message, action };
  toasts = [...toasts.slice(-2), t];
  emitToasts();
  setTimeout(() => dismissToast(t.id), action ? 6000 : 3000);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emitToasts();
}

const EMPTY_TOASTS: Toast[] = [];
export function useToasts() {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => toastListeners.delete(l);
    },
    () => toasts,
    () => EMPTY_TOASTS,
  );
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

const pathTaken = (s: VaultState, path: string, except?: string) =>
  Object.values(s.notes).some((n) => n.id !== except && n.path.toLowerCase() === path.toLowerCase());

function uniquePath(s: VaultState, folder: string, base: string) {
  const join = (t: string) => (folder ? `${folder}/${t}` : t);
  let path = join(base);
  for (let i = 1; pathTaken(s, path); i++) path = join(`${base} ${i}`);
  return path;
}

export function validateTitle(title: string) {
  if (!title.trim()) return "A note needs a name.";
  if (INVALID_TITLE_CHARS.test(title)) return 'Names can\'t contain \\ / [ ] # | ^ : * " < > ?';
  return null;
}

function withNote(s: VaultState, note: Note): VaultState {
  return { ...s, notes: { ...s.notes, [note.id]: note } };
}

export const vault = {
  openNote(id: string, opts: { newTab?: boolean } = {}) {
    set((s) => {
      if (!s.notes[id]) return s;
      const ws = s.workspace;
      let tabs = ws.tabs;
      if (!tabs.includes(id)) {
        if (opts.newTab || !ws.active || !tabs.includes(ws.active)) tabs = [...tabs, id];
        else tabs = tabs.map((t) => (t === ws.active ? id : t));
      }
      const history =
        ws.history[ws.historyIndex] === id ? ws.history : [...ws.history.slice(0, ws.historyIndex + 1), id].slice(-50);
      const folder = folderOf(s.notes[id].path);
      const parents = folder ? folder.split("/").map((_, i, a) => a.slice(0, i + 1).join("/")) : [];
      const expanded = [...new Set([...ws.expanded, ...parents])];
      return {
        ...s,
        workspace: { ...ws, tabs, active: id, history, historyIndex: history.length - 1, expanded },
      };
    });
  },

  openRandom() {
    const ids = Object.keys(state.notes).filter((id) => id !== state.workspace.active);
    if (ids.length) vault.openNote(ids[Math.floor(Math.random() * ids.length)]);
  },

  go(delta: -1 | 1) {
    set((s) => {
      const ws = s.workspace;
      let i = ws.historyIndex + delta;
      while (i >= 0 && i < ws.history.length && !s.notes[ws.history[i]]) i += delta;
      if (i < 0 || i >= ws.history.length) return s;
      const id = ws.history[i];
      const tabs = ws.tabs.includes(id) ? ws.tabs : ws.tabs.map((t) => (t === ws.active ? id : t));
      return { ...s, workspace: { ...ws, tabs: tabs.length ? tabs : [id], active: id, historyIndex: i } };
    });
  },

  closeTab(id: string) {
    set((s) => {
      const ws = s.workspace;
      const i = ws.tabs.indexOf(id);
      const tabs = ws.tabs.filter((t) => t !== id);
      const active = ws.active === id ? tabs[Math.min(i, tabs.length - 1)] ?? null : ws.active;
      return { ...s, workspace: { ...ws, tabs, active } };
    });
  },

  createNote(opts: { folder?: string; title?: string; content?: string; newTab?: boolean } = {}) {
    const id = newId();
    set((s) => {
      const path = uniquePath(s, opts.folder ?? "", opts.title?.trim() || "Untitled");
      const now = Date.now();
      return withNote(s, { id, path, content: opts.content ?? "", created: now, updated: now });
    });
    vault.openNote(id, { newTab: opts.newTab });
    return id;
  },

  /** Create the note a dangling [[link]] points at. */
  createFromLink(target: string, fromId?: string) {
    const clean = target.replace(/\.md$/i, "");
    const folder = clean.includes("/")
      ? folderOf(clean)
      : fromId && state.notes[fromId]
        ? folderOf(state.notes[fromId].path)
        : "";
    return vault.createNote({ folder, title: titleOf(clean) });
  },

  updateNote(id: string, content: string) {
    set((s) => (s.notes[id] ? withNote(s, { ...s.notes[id], content, updated: Date.now() }) : s));
  },

  renameNote(id: string, newTitle: string, newFolder?: string): string | null {
    const note = state.notes[id];
    if (!note) return "Note not found.";
    const title = newTitle.trim();
    const error = validateTitle(title);
    if (error) return error;
    const folder = newFolder ?? folderOf(note.path);
    const path = folder ? `${folder}/${title}` : title;
    if (path === note.path) return null;
    if (pathTaken(state, path, id)) return `"${path}" already exists.`;
    set((s) => {
      const notes: VaultState["notes"] = {};
      for (const n of Object.values(s.notes)) {
        const content = rewriteLinks(n.content, note.path, path);
        notes[n.id] = n.id === id ? { ...n, path, content, updated: Date.now() } : content === n.content ? n : { ...n, content };
      }
      return { ...s, notes };
    });
    return null;
  },

  deleteNote(id: string) {
    const note = state.notes[id];
    if (!note) return;
    const before = state;
    set((s) => {
      const notes = { ...s.notes };
      delete notes[id];
      const ws = s.workspace;
      const i = ws.tabs.indexOf(id);
      const tabs = ws.tabs.filter((t) => t !== id);
      const active = ws.active === id ? tabs[Math.max(0, i - 1)] ?? null : ws.active;
      return { ...s, notes, workspace: { ...ws, tabs, active } };
    });
    toast(`Deleted "${titleOf(note.path)}"`, {
      label: "Undo",
      run: () => set((s) => ({ ...s, notes: { ...s.notes, [id]: note }, workspace: before.workspace })),
    });
  },

  createFolder(parent = "", name = "New folder") {
    let path = parent ? `${parent}/${name}` : name;
    const all = allFolders(state);
    for (let i = 1; all.includes(path); i++) path = parent ? `${parent}/${name} ${i}` : `${name} ${i}`;
    set((s) => ({
      ...s,
      folders: [...s.folders, path],
      workspace: { ...s.workspace, expanded: [...new Set([...s.workspace.expanded, parent].filter(Boolean))] },
    }));
    return path;
  },

  renameFolder(oldPath: string, newName: string): string | null {
    const name = newName.trim();
    const error = validateTitle(name);
    if (error) return error.replace("note", "folder");
    const parent = folderOf(oldPath);
    const newPath = parent ? `${parent}/${name}` : name;
    if (newPath === oldPath) return null;
    if (allFolders(state).includes(newPath)) return `"${newPath}" already exists.`;
    const move = (p: string) => (p === oldPath || p.startsWith(oldPath + "/") ? newPath + p.slice(oldPath.length) : p);
    set((s) => {
      const moved = Object.values(s.notes).filter((n) => move(n.path) !== n.path);
      const notes: VaultState["notes"] = {};
      for (const n of Object.values(s.notes)) {
        let content = n.content;
        for (const m of moved) content = rewriteLinks(content, m.path, move(m.path));
        notes[n.id] = { ...n, path: move(n.path), content };
      }
      return {
        ...s,
        notes,
        folders: s.folders.map(move),
        workspace: { ...s.workspace, expanded: s.workspace.expanded.map(move) },
      };
    });
    return null;
  },

  deleteFolder(path: string) {
    const inside = (p: string) => p === path || p.startsWith(path + "/");
    const before = state;
    const count = Object.values(state.notes).filter((n) => inside(folderOf(n.path))).length;
    set((s) => {
      const notes = Object.fromEntries(Object.entries(s.notes).filter(([, n]) => !inside(folderOf(n.path))));
      const ws = s.workspace;
      const tabs = ws.tabs.filter((t) => notes[t]);
      return {
        ...s,
        notes,
        folders: s.folders.filter((f) => !inside(f)),
        workspace: { ...ws, tabs, active: ws.active && notes[ws.active] ? ws.active : tabs[0] ?? null },
      };
    });
    toast(`Deleted "${titleOf(path)}"${count ? ` and ${count} note${count === 1 ? "" : "s"}` : ""}`, {
      label: "Undo",
      run: () => set(() => before),
    });
  },

  moveNote(id: string, folder: string) {
    const note = state.notes[id];
    if (!note || folderOf(note.path) === folder) return null;
    return vault.renameNote(id, titleOf(note.path), folder);
  },

  toggleFolder(path: string, open?: boolean) {
    set((s) => {
      const has = s.workspace.expanded.includes(path);
      const want = open ?? !has;
      if (want === has) return s;
      const expanded = want ? [...s.workspace.expanded, path] : s.workspace.expanded.filter((p) => p !== path);
      return { ...s, workspace: { ...s.workspace, expanded } };
    });
  },

  setMode(mode: ViewMode) {
    set((s) => ({ ...s, workspace: { ...s.workspace, mode } }));
  },

  setPanel(panel: "leftOpen" | "rightOpen", open?: boolean) {
    set((s) => ({ ...s, workspace: { ...s.workspace, [panel]: open ?? !s.workspace[panel] } }));
  },

  updateSettings(patch: Partial<Settings>) {
    set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
  },

  logStudy(count = 1) {
    set((s) => {
      const day = isoDay(new Date());
      return { ...s, activity: { ...s.activity, [day]: (s.activity[day] ?? 0) + count } };
    });
  },

  openDaily() {
    const day = isoDay(new Date());
    const path = `Daily/${day}`;
    const existing = Object.values(state.notes).find((n) => n.path === path);
    if (existing) return vault.openNote(existing.id);
    vault.createNote({
      folder: "Daily",
      title: day,
      content: `#daily\n\n## Today\n- [ ] \n\n## New words\nword :: meaning\n`,
    });
  },

  exportJSON() {
    const { ready: _ready, ...rest } = state;
    void _ready;
    return JSON.stringify(rest, null, 2);
  },

  exportMarkdown() {
    return Object.values(state.notes)
      .sort((a, b) => a.path.localeCompare(b.path))
      .map((n) => `<!-- ${n.path}.md -->\n${n.content.trim()}\n`)
      .join("\n---\n\n");
  },

  importJSON(text: string): string | null {
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== "object" || typeof parsed.notes !== "object") {
        return "That file isn't a Green Graphite vault export.";
      }
      const before = state;
      set(() => normalize(parsed));
      toast(`Imported ${Object.keys(state.notes).length} notes`, { label: "Undo", run: () => set(() => before) });
      return null;
    } catch {
      return "That file isn't valid JSON.";
    }
  },

  reset() {
    set(() => seedState(Date.now()));
  },
};

export function allFolders(s: VaultState) {
  const set = new Set<string>();
  const add = (folder: string) => {
    const parts = folder.split("/");
    for (let i = 1; i <= parts.length; i++) set.add(parts.slice(0, i).join("/"));
  };
  for (const n of Object.values(s.notes)) {
    const f = folderOf(n.path);
    if (f) add(f);
  }
  for (const f of s.folders) add(f);
  return [...set].sort((a, b) => a.localeCompare(b));
}
