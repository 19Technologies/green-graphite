"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Flame, Layers, Play, Shuffle, CalendarCheck, FileText } from "lucide-react";
import { buildDecks } from "@/lib/cards";
import { heatmap, streak } from "@/lib/study";
import { useCards, useVault } from "@/lib/store";
import { parseDay, useToday } from "@/lib/useToday";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Heatmap({ activity, today }: { activity: Record<string, number>; today: string }) {
  const cols = useMemo(() => heatmap(activity, parseDay(today), 18), [activity, today]);
  return (
    <div className="heatmap-wrap">
      <div className="heatmap-months" aria-hidden>
        {cols.map((col, i) => {
          const month = (j: number) => parseDay(cols[j][0].date).getMonth();
          const starts = i > 0 && month(i) !== month(i - 1);
          // Label the first column only if the next month label is far enough away.
          const first = i === 0 && cols.slice(1, 3).every((_, j) => month(j + 1) === month(0));
          return <span key={col[0].date}>{starts || first ? MONTHS[month(i)] : ""}</span>;
        })}
      </div>
      <div className="heatmap" role="img" aria-label="Cards studied per day over the last 18 weeks">
        <div className="heatmap-days" aria-hidden>
          <span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span />
        </div>
        {cols.map((col) => (
          <div key={col[0].date} className="heatmap-col">
            {col.map((d) => (
              <span
                key={d.date}
                className={`heat heat-${d.level}${d.future ? " is-future" : ""}${d.date === today ? " is-today" : ""}`}
                title={d.future ? "" : `${d.count} ${d.count === 1 ? "card" : "cards"} on ${d.date}`}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="heatmap-scale" aria-hidden>
        Less <span className="heat heat-0" /><span className="heat heat-1" /><span className="heat heat-2" /><span className="heat heat-3" /><span className="heat heat-4" /> More
      </div>
    </div>
  );
}

export default function FlashcardsPage() {
  const { activity } = useVault();
  const cards = useCards();
  const today = useToday();
  const router = useRouter();
  const decks = useMemo(() => buildDecks(cards), [cards]);
  const noteCount = new Set(cards.map((c) => c.noteId)).size;
  const days = Object.values(activity).filter((n) => n > 0).length;

  return (
    <div className="page">
      <header className="page-header">
        <p className="eyebrow"><span className="dot" /> Study</p>
        <h1>Flashcards</h1>
        <p className="page-lede">
          {cards.length} cards pulled from {noteCount} {noteCount === 1 ? "note" : "notes"}. Edit a note and its cards update
          on their own.
        </p>
      </header>

      <div className="stat-row">
        <div className="stat tint-sun">
          <Layers size={16} />
          <b>{cards.length}</b>
          <span>cards</span>
        </div>
        <div className="stat tint-sky">
          <CalendarCheck size={16} />
          <b>{today ? activity[today] ?? 0 : 0}</b>
          <span>studied today</span>
        </div>
        <div className="stat tint-peach">
          <Flame size={16} />
          <b>{today ? streak(activity, parseDay(today)) : 0}</b>
          <span>day streak</span>
        </div>
        <div className="stat tint-lilac">
          <FileText size={16} />
          <b>{days}</b>
          <span>days studied</span>
        </div>
      </div>

      <section className="card-panel">
        <div className="card-panel-head">
          <h2>Decks</h2>
          {cards.length > 0 && (
            <div className="btn-row">
              <Link href="/flashcards/study?shuffle=1" className="btn">
                <Shuffle size={14} /> Shuffle all
              </Link>
              <Link href="/flashcards/study" className="btn btn-primary">
                <Play size={14} /> Study all {cards.length}
              </Link>
            </div>
          )}
        </div>
        {decks.length ? (
          <ul className="deck-list">
            {decks.map((d) => (
              <li key={d.name}>
                <button
                  className={`deck-row depth-${Math.min(d.depth, 3)}`}
                  onClick={() => router.push(`/flashcards/study?deck=${encodeURIComponent(d.name)}`)}
                >
                  <span className="deck-name">
                    {d.depth > 0 && <span className="deck-branch" aria-hidden>└</span>}
                    {d.name.split("/").pop()}
                  </span>
                  <span className="deck-meta">
                    {d.notes.size} {d.notes.size === 1 ? "note" : "notes"}
                  </span>
                  <span className="deck-count">{d.count}</span>
                  <ArrowRight size={15} className="deck-go" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="deck-empty">
            <p>No cards yet. Add a line like this to any note:</p>
            <code>Guten Morgen :: Good morning</code>
            <Link href="/" className="btn btn-primary">
              Go to your notes
            </Link>
          </div>
        )}
      </section>

      <div className="two-col">
        <section className="card-panel">
          <div className="card-panel-head">
            <h2>Activity</h2>
          </div>
          {today && <Heatmap activity={activity} today={today} />}
        </section>

        <section className="card-panel cheatsheet">
          <div className="card-panel-head">
            <h2>Writing cards</h2>
          </div>
          <dl>
            <dt><code>Hallo :: Hello</code></dt>
            <dd>One card</dd>
            <dt><code>der Hund ::: the dog</code></dt>
            <dd>Two cards, one each way</dd>
            <dt><code>Ich ==bin== müde.</code></dt>
            <dd>Cloze: the highlight gets hidden</dd>
            <dt><code>Question<br />?<br />Answer</code></dt>
            <dd>Multi-line (use <code>??</code> for both ways)</dd>
            <dt><code>#flashcards/Travel</code></dt>
            <dd>Put the note&apos;s cards in a deck of your choice</dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
