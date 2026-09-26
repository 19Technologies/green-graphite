// Core data model, persistence and migration from earlier builds.

export interface Note {
  id: string;
  /** Folder path + title, e.g. "German/Greetings". No extension. */
  path: string;
  content: string;
  created: number;
  updated: number;
}

export type ViewMode = "read" | "edit" | "split";
export type Theme = "paper" | "graphite" | "system";

export interface Settings {
  theme: Theme;
  shuffle: boolean;
  startWithBack: boolean;
  blurAnswersInNotes: boolean;
  showTagsInGraph: boolean;
  showOrphansInGraph: boolean;
}

export interface Workspace {
  tabs: string[];
  active: string | null;
  history: string[];
  historyIndex: number;
  mode: ViewMode;
  leftOpen: boolean;
  rightOpen: boolean;
  expanded: string[];
}

export interface VaultState {
  ready: boolean;
  notes: Record<string, Note>;
  /** Explicitly created folders (folders that contain notes are implied). */
  folders: string[];
  /** ISO date (YYYY-MM-DD) → number of cards studied that day. */
  activity: Record<string, number>;
  settings: Settings;
  workspace: Workspace;
}

export const STORAGE_KEY = "cranoly-vault";
/** Keys written by earlier builds; read once so nobody loses notes. */
// Earlier names of the app, newest first. Their vaults move to STORAGE_KEY on first load.
const OLDER_KEYS = ["green-graphite-vault", "kurzbite-vault-v2"];

export const DEFAULT_SETTINGS: Settings = {
  theme: "paper",
  shuffle: false,
  startWithBack: false,
  blurAnswersInNotes: true,
  showTagsInGraph: true,
  showOrphansInGraph: true,
};

export const titleOf = (path: string) => path.slice(path.lastIndexOf("/") + 1);
export const folderOf = (path: string) =>
  path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";

export const INVALID_TITLE_CHARS = /[\\/\[\]#|^:*"<>?]/;

export function newId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function isoDay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** A new vault is empty: no starter notes. */
export function emptyState(): VaultState {
  return {
    ready: true,
    notes: {},
    folders: [],
    activity: {},
    settings: { ...DEFAULT_SETTINGS },
    workspace: {
      tabs: [],
      active: null,
      history: [],
      historyIndex: -1,
      mode: "edit",
      leftOpen: true,
      rightOpen: true,
      expanded: [],
    },
  };
}

export const EMPTY_STATE: VaultState = { ...emptyState(), ready: false };

/* ------------------------------------------------------------------ */
/* Persistence + migration                                             */
/* ------------------------------------------------------------------ */

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Accept anything shaped roughly like a VaultState and fill in the gaps. */
export function normalize(input: Partial<VaultState>): VaultState {
  const base = emptyState();
  const notes = input.notes && typeof input.notes === "object" ? { ...input.notes } : base.notes;
  // Earlier builds shipped starter notes (ids "seed-…"). Drop the ones nobody ever edited.
  for (const [id, n] of Object.entries(notes)) {
    if (id.startsWith("seed-") && n.updated === n.created) delete notes[id];
  }
  const ws = { ...base.workspace, ...(input.workspace ?? {}) };
  ws.tabs = ws.tabs.filter((id) => notes[id]);
  if (ws.active && !notes[ws.active]) ws.active = ws.tabs[0] ?? null;
  ws.history = ws.history.filter((id) => notes[id]);
  ws.historyIndex = Math.min(ws.historyIndex, ws.history.length - 1);
  return {
    ready: true,
    notes,
    folders: Array.isArray(input.folders) ? input.folders : [],
    activity: input.activity && typeof input.activity === "object" ? input.activity : {},
    settings: { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) },
    workspace: ws,
  };
}

/** Imports notes saved by the very first prototype (`langvault-*` keys). */
function migrateLegacy(): VaultState | null {
  const oldNotes = safeParse<Record<string, string>>(localStorage.getItem("langvault-notes"));
  const oldDict = safeParse<Array<{ word: string; definition: string }>>(
    localStorage.getItem("langvault-dictionary"),
  );
  const oldCards = safeParse<Array<{ front: string; back: string }>>(
    localStorage.getItem("langvault-flashcards"),
  );
  if (!oldNotes && !oldDict && !oldCards) return null;

  const state = emptyState();
  const now = Date.now();
  const add = (path: string, content: string) => {
    const id = newId();
    state.notes[id] = { id, path, content, created: now, updated: now };
    return id;
  };

  for (const [title, content] of Object.entries(oldNotes ?? {})) {
    if (content.startsWith("# Welcome to LangVault")) continue; // the prototype's built-in welcome note
    add(title.replace(INVALID_TITLE_CHARS, " ").trim() || "Untitled", content);
  }

  const pairs = new Map<string, string>();
  for (const w of oldDict ?? []) if (w.word && w.definition) pairs.set(w.word, w.definition);
  for (const c of oldCards ?? []) if (c.front && c.back && !pairs.has(c.front)) pairs.set(c.front, c.back);
  if (pairs.size) add("Vocabulary/Dictionary", [...pairs].map(([w, d]) => `${w} :: ${d}`).join("\n") + "\n");

  const first = Object.keys(state.notes)[0];
  if (first) Object.assign(state.workspace, { tabs: [first], active: first, history: [first], historyIndex: 0 });
  return state;
}

export function loadState(): VaultState {
  const saved = safeParse<Partial<VaultState>>(localStorage.getItem(STORAGE_KEY));
  if (saved) {
    const state = normalize(saved);
    saveState(state); // persist any clean-up done by normalize()
    return state;
  }
  for (const key of OLDER_KEYS) {
    const older = safeParse<Partial<VaultState>>(localStorage.getItem(key));
    if (!older) continue;
    const state = normalize(older);
    if (saveState(state)) localStorage.removeItem(key);
    return state;
  }
  const state = migrateLegacy() ?? emptyState();
  saveState(state);
  return state;
}

export function saveState(state: VaultState) {
  try {
    const { ready: _ready, ...rest } = state;
    void _ready;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    return true;
  } catch {
    return false;
  }
}
