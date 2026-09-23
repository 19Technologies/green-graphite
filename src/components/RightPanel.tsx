"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, ChevronRight, FileQuestion, Link2, ListTree, Network, Layers } from "lucide-react";
import { Note, titleOf } from "@/lib/vault";
import { extractHeadings, stripInline } from "@/lib/links";
import { buildGraph } from "@/lib/graph";
import { cardsOf, indexOf, useVault, vault } from "@/lib/store";
import { setUI } from "@/lib/ui";
import GraphCanvas from "./GraphCanvas";

function Section({ title, icon, count, children, defaultOpen = true }: {
  title: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rp-section">
      <button className="rp-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronRight size={13} className={`tree-chevron${open ? " is-open" : ""}`} />
        {icon}
        <span>{title}</span>
        {count !== undefined && <span className="tree-badge">{count}</span>}
      </button>
      {open && <div className="rp-body">{children}</div>}
    </section>
  );
}

function Snippet({ text, target }: { text: string; target: string }) {
  const parts = stripInline(text).trim().split(/(\[\[[^\]]+\]\])/g);
  return (
    <span className="rp-snippet">
      {parts.map((p, i) => {
        if (!p.startsWith("[[")) return p;
        const inner = p.slice(2, -2);
        const label = inner.split("|").pop()!;
        const hit = inner.split(/[|#]/)[0].trim().toLowerCase();
        return (
          <b key={i} className={hit === target.toLowerCase() || hit.endsWith("/" + target.toLowerCase()) ? "is-hit" : ""}>
            {label}
          </b>
        );
      })}
    </span>
  );
}

export default function RightPanel({ note }: { note: Note }) {
  const { notes } = useVault();
  const index = indexOf(notes);
  const backlinks = index.backlinks.get(note.id) ?? [];
  const outgoing = index.outgoing.get(note.id) ?? [];
  const headings = useMemo(() => extractHeadings(note.content), [note.content]);
  const cards = cardsOf(notes).filter((c) => c.noteId === note.id);
  const graph = buildGraph(notes, index, { tags: false, orphans: true, ghosts: true, focus: note.id, depth: 1 });

  const uniqueOut = outgoing.filter((r, i) => outgoing.findIndex((o) => o.target.toLowerCase() === r.target.toLowerCase()) === i);

  return (
    <div className="right-panel-inner">
      <Section title="Local graph" icon={<Network size={13} />}>
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
          <Link href="/graph" className="local-graph-open" title="Open full graph">
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </Section>

      <Section title="Linked mentions" icon={<Link2 size={13} />} count={backlinks.length}>
        {backlinks.length ? (
          backlinks.map((b) => (
            <button key={b.from.id} className="rp-item" onClick={(e) => vault.openNote(b.from.id, { newTab: e.metaKey || e.ctrlKey })}>
              <span className="rp-item-title">{titleOf(b.from.path)}</span>
              <Snippet text={b.snippet} target={titleOf(note.path)} />
            </button>
          ))
        ) : (
          <p className="panel-empty">No notes link here yet.</p>
        )}
      </Section>

      <Section title="Outgoing links" icon={<ArrowUpRight size={13} />} count={uniqueOut.length} defaultOpen={false}>
        {uniqueOut.length ? (
          uniqueOut.map((r) =>
            r.note ? (
              <button key={r.target} className="rp-link" onClick={() => vault.openNote(r.note!.id)}>
                {titleOf(r.note.path)}
              </button>
            ) : (
              <button key={r.target} className="rp-link is-unresolved" title="Create this note" onClick={() => vault.createFromLink(r.target, note.id)}>
                <FileQuestion size={12} /> {r.target}
              </button>
            ),
          )
        ) : (
          <p className="panel-empty">This note doesn&apos;t link anywhere.</p>
        )}
      </Section>

      <Section title="Flashcards" icon={<Layers size={13} />} count={cards.length}>
        {cards.length ? (
          <>
            <ul className="rp-cards">
              {cards.slice(0, 6).map((c) => (
                <li key={c.id}>
                  <span className="rp-card-front">{c.front.replace(/==\[…\]==/g, "[…]").replace(/[*_=`]/g, "")}</span>
                  <span className="rp-card-kind">{c.kind === "reversed" ? "⇄" : c.kind === "cloze" ? "cloze" : c.kind === "multiline" ? "?" : "→"}</span>
                </li>
              ))}
            </ul>
            {cards.length > 6 && <p className="panel-caption">+{cards.length - 6} more</p>}
            <Link href={`/flashcards/study?note=${note.id}`} className="btn btn-primary btn-block">
              <BookOpen size={14} /> Study {cards.length} {cards.length === 1 ? "card" : "cards"}
            </Link>
          </>
        ) : (
          <p className="panel-empty">
            Write <code>front :: back</code> on any line to turn it into a card.
          </p>
        )}
      </Section>

      <Section title="Outline" icon={<ListTree size={13} />} count={headings.length} defaultOpen={false}>
        {headings.length ? (
          headings.map((h) => (
            <button
              key={h.line}
              className="rp-outline"
              style={{ paddingLeft: 8 + (h.level - 1) * 12 }}
              onClick={() => {
                vault.setMode("read");
                setUI({ pendingHeading: h.slug });
              }}
            >
              {h.text}
            </button>
          ))
        ) : (
          <p className="panel-empty">No headings.</p>
        )}
      </Section>
    </div>
  );
}
