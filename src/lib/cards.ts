// Flashcards live inside notes (Obsidian Spaced Repetition syntax):
//   front :: back         one card
//   front ::: back        two cards, one each way
//   front / ? / back      multi-line card (?? makes it two-way)
//   ==cloze==             one card per highlight
import { Note, folderOf, titleOf } from "./vault";
import { stripCode } from "./links";

export type CardKind = "basic" | "reversed" | "multiline" | "cloze";

export interface Card {
  id: string;
  noteId: string;
  deck: string;
  kind: CardKind;
  front: string;
  back: string;
  line: number;
}

export interface Deck {
  name: string;
  depth: number;
  count: number;
  notes: Set<string>;
}

function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

const LINE_PREFIX = /^\s*(?:>\s*)*(?:[-*+]\s+|\d+[.)]\s+)?(?:\[[ xX]\]\s+)?/;
const SEPARATOR = /\s(:{2,3})\s/;
const CLOZE = /==([^=\n]+)==/g;
const QUESTION = /^\s*\?{1,2}\s*$/;
const HEADING = /^\s*#{1,6}\s/;

export function deckFor(note: Note, tags: string[]) {
  const tagged = tags.find((t) => t.startsWith("flashcards/"));
  if (tagged) return tagged.slice("flashcards/".length);
  return folderOf(note.path) || titleOf(note.path);
}

export function extractCards(note: Note, tags: string[]): Card[] {
  const deck = deckFor(note, tags);
  const lines = note.content.split("\n");
  const probe = stripCode(note.content).split("\n");
  const cards: Card[] = [];
  const used = new Set<number>();

  const push = (kind: CardKind, front: string, back: string, line: number, salt = "") => {
    cards.push({
      id: hash(`${note.id}|${kind}|${front}|${salt}`),
      noteId: note.id,
      deck,
      kind,
      front,
      back,
      line,
    });
  };

  // Multi-line cards: a paragraph, a line with only "?", then the answer paragraph.
  probe.forEach((p, i) => {
    if (!QUESTION.test(p)) return;
    let s = i - 1;
    while (s >= 0 && probe[s].trim() && !HEADING.test(probe[s]) && !used.has(s)) s--;
    let e = i + 1;
    while (e < lines.length && probe[e].trim() && !HEADING.test(probe[e])) e++;
    const front = lines.slice(s + 1, i).join("\n").trim();
    const back = lines.slice(i + 1, e).join("\n").trim();
    if (!front || !back) return;
    push("multiline", front, back, s + 1);
    if (p.trim() === "??") push("reversed", back, front, s + 1);
    for (let k = s + 1; k < e; k++) used.add(k);
  });

  probe.forEach((p, i) => {
    if (used.has(i) || !p.trim()) return;
    const line = lines[i];

    const sep = SEPARATOR.exec(p);
    if (sep) {
      const front = line.slice(0, sep.index).replace(LINE_PREFIX, "").trim();
      const back = line.slice(sep.index + sep[0].length).trim();
      if (!front || !back) return;
      push("basic", front, back, i);
      if (sep[1] === ":::") push("reversed", back, front, i);
      return;
    }

    const clozes = [...p.matchAll(CLOZE)];
    if (!clozes.length) return;
    const text = line.replace(LINE_PREFIX, "");
    const offset = line.length - text.length;
    clozes.forEach((target, k) => {
      let front = "";
      let back = "";
      let cursor = 0;
      for (const [j, m] of clozes.entries()) {
        const start = m.index! - offset;
        const before = text.slice(cursor, start);
        front += before + (j === k ? "==[…]==" : m[1]);
        back += before + (j === k ? `==${m[1]}==` : m[1]);
        cursor = start + m[0].length;
      }
      front += text.slice(cursor);
      back += text.slice(cursor);
      push("cloze", front.trim(), back.trim(), i, `${k}:${target[1]}`);
    });
  });

  return cards.sort((a, b) => a.line - b.line);
}

export function allCards(notes: Record<string, Note>, noteTags: Map<string, string[]>) {
  return Object.values(notes)
    .sort((a, b) => a.path.localeCompare(b.path))
    .flatMap((n) => extractCards(n, noteTags.get(n.id) ?? []));
}

/** Decks as a flat, sorted tree: "German" includes "German/Verbs". */
export function buildDecks(cards: Card[]): Deck[] {
  const map = new Map<string, Deck>();
  for (const c of cards) {
    const parts = c.deck.split("/");
    for (let d = 1; d <= parts.length; d++) {
      const name = parts.slice(0, d).join("/");
      const deck = map.get(name) ?? { name, depth: d - 1, count: 0, notes: new Set<string>() };
      deck.count++;
      deck.notes.add(c.noteId);
      map.set(name, deck);
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const inDeck = (card: Card, deck: string) =>
  card.deck === deck || card.deck.startsWith(deck + "/");
