// Core data model, persistence, legacy migration and the seed vault.

export interface Note {
  id: string;
  /** Folder path + title, e.g. "German/Greetings". No extension. */
  path: string;
  content: string;
  created: number;
  updated: number;
}

export type ViewMode = "read" | "edit" | "split";

export interface Settings {
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

export const STORAGE_KEY = "green-graphite-vault";
/** Keys written by earlier builds; read once so nobody loses notes. */
const OLDER_KEY = "kurzbite-vault-v2";

export const DEFAULT_SETTINGS: Settings = {
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

/* ------------------------------------------------------------------ */
/* Seed vault                                                          */
/* ------------------------------------------------------------------ */

const SEED: Array<[string, string, string]> = [
  [
    "seed-welcome",
    "Welcome",
    `Green Graphite is a vault for learning languages. Notes link to each other like in Obsidian, and **any note can hold flashcards**.

## Start here
- Follow a link: [[Greetings]] → [[Articles (der, die, das)]] → [[Cases]]
- Open the **Graph** from the left ribbon to see how everything connects
- Press \`⌘K\` for the command palette, \`⌘O\` to jump to a note, \`⌘E\` to switch between reading and editing

## Writing flashcards
Write cards straight into your notes. They are collected into decks automatically.

\`\`\`
Hallo :: Hello                 → one card
der Hund ::: the dog           → two cards (both directions)
Ich ==bin== müde.              → cloze card
What does "doch" do?
?
Contradicts a negative statement.   → multi-line card
\`\`\`

Cards go into the deck named after the note's folder. You can also pick a deck with a tag like \`#flashcards/Travel\`.

Your first daily note is [[2026-09-23]].`,
  ],
  [
    "seed-greetings",
    "German/Greetings",
    `#german #basics

How you greet someone depends on the time of day and how formal you're being. The formal *Sie* is covered in [[Verbs – sein & haben]].

## Everyday
Hallo ::: Hello
Guten Morgen ::: Good morning
Guten Tag ::: Good day
Guten Abend ::: Good evening
Tschüss :: Bye (informal)
Auf Wiedersehen :: Goodbye (formal)

## Regional
- Servus :: Hi / Bye — Bavaria & Austria
- Moin :: Hi — Northern Germany, any time of day
- Grüß Gott :: Hello — southern, literally "greet God"

> [!tip] Wie geht's?
> Only ask *Wie geht's?* if you actually want an answer. Germans take the question literally.

Wie geht es ==Ihnen==? (formal)
Wie geht es ==dir==? (informal)`,
  ],
  [
    "seed-articles",
    "German/Articles (der, die, das)",
    `#german #grammar

Every German noun has a gender. **Always learn the noun with its article.** The article changes with the case, see [[Cases]].

| Gender | Nominative | Example |
| --- | --- | --- |
| masculine | der | der Hund |
| feminine | die | die Katze |
| neuter | das | das Haus |
| plural | die | die Hunde |

## Patterns that help
- Nouns ending in *-ung*, *-heit*, *-keit* are almost always ==feminine==
- Nouns ending in *-chen* and *-lein* are always ==neuter==
- Days, months and seasons are ==masculine==

der Hund ::: the dog
die Katze ::: the cat
das Haus ::: the house
das Mädchen :: the girl (neuter because of *-chen*!)
die Zeitung :: the newspaper`,
  ],
  [
    "seed-verbs",
    "German/Verbs – sein & haben",
    `#german #grammar #flashcards/German/Verbs

*sein* and *haben* are the most important verbs. They also build the perfect tense.

## sein — to be
ich ==bin==, du ==bist==, er/sie/es ==ist==
wir ==sind==, ihr ==seid==, sie/Sie ==sind==

## haben — to have
*haben*, present tense: ich, du, er :: habe, hast, hat

When do you use *sein* for the perfect tense?
?
With verbs of **movement or change of state**: *Ich bin gefahren*, *Er ist eingeschlafen*.

Related: [[Greetings]] uses *Sie* forms, and [[Cases]] explains why it's *mit dem* but *für den*.`,
  ],
  [
    "seed-cases",
    "German/Cases",
    `#german #grammar

German has four cases. The case changes the article (see [[Articles (der, die, das)]]).

1. **Nominative**: the subject
2. **Accusative**: the direct object
3. **Dative**: the indirect object
4. **Genitive**: possession

| | masc. | fem. | neut. | plural |
|---|---|---|---|---|
| Nom. | der | die | das | die |
| Akk. | den | die | das | die |
| Dat. | dem | der | dem | den |
| Gen. | des | der | des | der |

Which prepositions always take the dative?
?
aus, bei, mit, nach, seit, von, zu (and gegenüber)

Ich sehe ==den== Hund. (accusative, masc.)
Ich gebe ==dem== Kind ein Buch. (dative, neut.)`,
  ],
  [
    "seed-daily",
    "Daily/2026-09-23",
    `#daily

## Today
- [x] Reviewed [[Greetings]]
- [ ] Learn the dative prepositions in [[Cases]]
- [ ] Write 5 sentences using *sein*

## New words
schwierig :: difficult
einfach :: simple, easy
der Feierabend :: time after work ends for the day

> Übung macht den Meister. — Practice makes perfect.`,
  ],
  [
    "seed-dictionary",
    "Vocabulary/Dictionary",
    `#vocabulary

Words gathered while reading. Add one per line: \`word :: meaning\`.

die Sehnsucht :: longing, yearning
gemütlich :: cosy, comfortable
das Fernweh :: longing for faraway places
der Ohrwurm :: a song stuck in your head
doch :: contradicts a negative — "yes it is!"`,
  ],
];

export function seedState(now = 1758585600000): VaultState {
  const notes: Record<string, Note> = {};
  SEED.forEach(([id, path, content], i) => {
    notes[id] = { id, path, content, created: now + i, updated: now + i };
  });
  return {
    ready: true,
    notes,
    folders: [],
    activity: {},
    settings: { ...DEFAULT_SETTINGS },
    workspace: {
      tabs: ["seed-welcome"],
      active: "seed-welcome",
      history: ["seed-welcome"],
      historyIndex: 0,
      mode: "read",
      leftOpen: true,
      rightOpen: true,
      expanded: ["German", "Daily", "Vocabulary"],
    },
  };
}

export const EMPTY_STATE: VaultState = {
  ...seedState(),
  ready: false,
};

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
  const base = seedState();
  const notes = input.notes && typeof input.notes === "object" ? input.notes : base.notes;
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

const LEGACY_WELCOME = "# Welcome to LangVault";

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

  const state = seedState(Date.now());
  const takenTitles = new Set(Object.values(state.notes).map((n) => titleOf(n.path).toLowerCase()));

  for (const [title, content] of Object.entries(oldNotes ?? {})) {
    if (content.startsWith(LEGACY_WELCOME)) continue; // the old default welcome note
    const clean = title.replace(INVALID_TITLE_CHARS, " ").trim() || "Untitled";
    const existing = Object.values(state.notes).find(
      (n) => titleOf(n.path).toLowerCase() === clean.toLowerCase(),
    );
    if (existing) {
      existing.content = content;
      continue;
    }
    const id = newId();
    state.notes[id] = { id, path: clean, content, created: Date.now(), updated: Date.now() };
    takenTitles.add(clean.toLowerCase());
  }

  const pairs = new Map<string, string>();
  for (const w of oldDict ?? []) if (w.word && w.definition) pairs.set(w.word, w.definition);
  for (const c of oldCards ?? []) if (c.front && c.back && !pairs.has(c.front)) pairs.set(c.front, c.back);
  if (pairs.size) {
    const dict = state.notes["seed-dictionary"];
    const known = new Set(dict.content.split("\n").map((l) => l.split("::")[0].trim()));
    const extra = [...pairs].filter(([w]) => !known.has(w)).map(([w, d]) => `${w} :: ${d}`);
    if (extra.length) dict.content += `\n\n## Imported\n${extra.join("\n")}`;
  }
  return state;
}

export function loadState(): VaultState {
  const saved = safeParse<Partial<VaultState>>(localStorage.getItem(STORAGE_KEY));
  if (saved) return normalize(saved);
  const older = safeParse<Partial<VaultState>>(localStorage.getItem(OLDER_KEY));
  if (older) {
    const state = normalize(older);
    saveState(state);
    localStorage.removeItem(OLDER_KEY);
    return state;
  }
  const migrated = migrateLegacy();
  const state = migrated ?? seedState(Date.now());
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
