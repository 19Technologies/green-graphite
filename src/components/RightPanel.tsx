"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, GitFork, Layers, Link2, ListTree } from "lucide-react";
import { Note, folderOf, titleOf } from "@/lib/vault";
import { extractHeadings, stripInline } from "@/lib/links";
import { buildGraph } from "@/lib/graph";
import { cardsOf, indexOf, useVault, vault } from "@/lib/store";
import { RightTab, setUI, useUI } from "@/lib/ui";
import GraphCanvas from "./GraphCanvas";

const TABS: Array<{ id: RightTab; label: string; icon: React.ReactNode }> = [
  { id: "backlinks", label: "Backlinks", icon: <Link2 size={17} /> },
  { id: "outgoing", label: "Outgoing links", icon: <ArrowUpRight size={17} /> },
  { id: "cards", label: "Flashcards", icon: <Layers size={17} /> },
  { id: "outline", label: "Outline", icon: <ListTree size={17} /> },
  { id: "graph", label: "Local graph", icon: <GitFork size={17} /> },
];

function Snippet({ text, target }: { text: string; target: string }) {
  const parts = stripInline(text).trim().split(/(\[\[[^\]]+\]\])/g);
  return (
    <span className="search-match">
      {parts.map((p, i) => {
        if (!p.startsWith("[[")) return p;
        const inner = p.slice(2, -2);
        const label = inner.split("|").pop()!;
        const hit = inner.split(/[|#]/)[0].trim().toLowerCase();
        const isHit = hit === target.toLowerCase() || hit.endsWith("/" + target.toLowerCase());
        return isHit ? <mark key={i}>{label}</mark> : <span key={i}>{label}</span>;
      })}
    </span>
  );
}

function Backlinks({ note }: { note: Note }) {
  const { notes } = useVault();
  const [open, setOpen] = useState(true);
  const backlinks = indexOf(notes).backlinks.get(note.id) ?? [];
  return (
    <>
      <button className="pane-section-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronDown size={14} className={`collapse-icon${open ? "" : " is-collapsed"}`} />
        <span>Linked mentions</span>
        <span className="pane-count">{backlinks.length}</span>
      </button>
      {open &&
        (backlinks.length ? (
          backlinks.map((b) => (
            <div key={b.from.id} className="search-result">
              <button className="search-result-file" onClick={(e) => vault.openNote(b.from.id, { newTab: e.metaKey || e.ctrlKey })}>
                {titleOf(b.from.path)}
              </button>
              <button className="search-result-match" onClick={() => vault.openNote(b.from.id)}>
                <Snippet text={b.snippet} target={titleOf(note.path)} />
              </button>
            </div>
          ))
        ) : (
          <p className="pane-empty">No backlinks found.</p>
        ))}
    </>
  );
}

function Outgoing({ note }: { note: Note }) {
  const { notes } = useVault();
  const outgoing = indexOf(notes).outgoing.get(note.id) ?? [];
  const unique = outgoing.filter((r, i) => outgoing.findIndex((o) => o.target.toLowerCase() === r.target.toLowerCase()) === i);
  const linked = unique.filter((r) => r.note);
  const missing = unique.filter((r) => !r.note);
  return (
    <>
      <div className="pane-section-head is-static">
        <span>Links</span>
        <span className="pane-count">{linked.length}</span>
      </div>
      {linked.map((r) => (
        <button key={r.target} className="pane-row" onClick={() => vault.openNote(r.note!.id)}>
          <span>{titleOf(r.note!.path)}</span>
          {folderOf(r.note!.path) && <small>{folderOf(r.note!.path)}</small>}
        </button>
      ))}
      {!linked.length && <p className="pane-empty">No outgoing links.</p>}
      {missing.length > 0 && (
        <>
          <div className="pane-section-head is-static">
            <span>Unresolved links</span>
            <span className="pane-count">{missing.length}</span>
          </div>
          {missing.map((r) => (
            <button key={r.target} className="pane-row is-unresolved" title="Create this note" onClick={() => vault.createFromLink(r.target, note.id)}>
              <span>{r.target}</span>
            </button>
          ))}
        </>
      )}
    </>
  );
}

function Cards({ note }: { note: Note }) {
  const { notes } = useVault();
  const cards = cardsOf(notes).filter((c) => c.noteId === note.id);
  if (!cards.length) {
    return (
      <p className="pane-empty">
        No flashcards in this note. Write <code>front :: back</code> on any line to add one.
      </p>
    );
  }
  return (
    <>
      <div className="pane-section-head is-static">
        <span>In this note</span>
        <span className="pane-count">{cards.length}</span>
      </div>
      {cards.map((c) => (
        <div key={c.id} className="pane-card">
          <span>{c.front.replace(/==\[…\]==/g, "[…]").replace(/[*_=`]/g, "")}</span>
          <small>{c.back.replace(/[*_=`]/g, "")}</small>
        </div>
      ))}
      <Link href={`/flashcards/study?note=${note.id}`} className="btn btn-primary pane-button">
        Study {cards.length} {cards.length === 1 ? "card" : "cards"}
      </Link>
    </>
  );
}

function Outline({ note }: { note: Note }) {
  const headings = useMemo(() => extractHeadings(note.content), [note.content]);
  if (!headings.length) return <p className="pane-empty">No headings found.</p>;
  return (
    <div className="outline">
      {headings.map((h) => (
        <button
          key={h.line}
          className="pane-row outline-item"
          style={{ paddingLeft: 10 + (h.level - 1) * 16 }}
          onClick={() => {
            vault.setMode("read");
            setUI({ pendingHeading: h.slug, mobileRight: false });
          }}
        >
          {h.text}
        </button>
      ))}
    </div>
  );
}

function LocalGraph({ note }: { note: Note }) {
  const { notes } = useVault();
  const graph = buildGraph(notes, indexOf(notes), { tags: false, orphans: true, ghosts: true, focus: note.id, depth: 1 });
  return (
    <div className="local-graph">
      <GraphCanvas
        compact
        data={graph}
        activeId={note.id}
        onNodeClick={(n) => {
          if (n.noteId) vault.openNote(n.noteId);
          else if (n.kind === "ghost") vault.createFromLink(n.label, note.id);
        }}
      />
    </div>
  );
}

export default function RightPanel({ note }: { note: Note }) {
  const { rightTab } = useUI();
  const tab = TABS.find((t) => t.id === rightTab) ?? TABS[0];
  return (
    <div className="right-panel-inner">
      <div className="side-tabs-bar">
        <div className="side-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={t.id === tab.id}
              aria-label={t.label}
              title={t.label}
              className={`side-tab${t.id === tab.id ? " is-active" : ""}`}
              onClick={() => setUI({ rightTab: t.id })}
            >
              {t.icon}
            </button>
          ))}
        </div>
      </div>
      <div className="pane-view">
        <div className="pane-view-title">{tab.label}</div>
        {tab.id === "backlinks" && <Backlinks note={note} />}
        {tab.id === "outgoing" && <Outgoing note={note} />}
        {tab.id === "cards" && <Cards note={note} />}
        {tab.id === "outline" && <Outline note={note} />}
        {tab.id === "graph" && <LocalGraph note={note} />}
      </div>
    </div>
  );
}
