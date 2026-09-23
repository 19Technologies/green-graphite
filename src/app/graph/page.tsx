"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import GraphCanvas from "@/components/GraphCanvas";
import { buildGraph } from "@/lib/graph";
import { indexOf, useVault, vault } from "@/lib/store";
import { openSearch } from "@/lib/ui";

export default function GraphPage() {
  const { notes, settings, workspace } = useVault();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [ghosts, setGhosts] = useState(true);
  const index = indexOf(notes);

  const data = buildGraph(notes, index, {
    tags: settings.showTagsInGraph,
    orphans: settings.showOrphansInGraph,
    ghosts,
  });
  const stats = useMemo(() => {
    const noteNodes = data.nodes.filter((n) => n.kind === "note").length;
    return { notes: noteNodes, links: data.links.filter((l) => l.kind === "link").length, tags: index.tags.size };
  }, [data, index]);

  return (
    <div className="graph-page">
      <GraphCanvas
        data={data}
        activeId={workspace.active}
        query={query}
        onNodeClick={(n, e) => {
          if (n.kind === "tag") {
            openSearch(n.label);
            vault.setPanel("leftOpen", true);
            return;
          }
          if (n.noteId) vault.openNote(n.noteId, { newTab: e.metaKey || e.ctrlKey });
          else vault.createFromLink(n.label);
          router.push("/");
        }}
      />

      <div className="graph-overlay">
        <div className="graph-title">
          <h1>Graph</h1>
          <p>
            {stats.notes} notes · {stats.links} links · {stats.tags} tags
          </p>
        </div>
        <label className="search-box graph-search">
          <Search size={14} />
          <input value={query} placeholder="Highlight notes…" onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button className="icon-btn" aria-label="Clear" onClick={() => setQuery("")}>
              <X size={13} />
            </button>
          )}
        </label>
        <div className="graph-toggles">
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.showTagsInGraph}
              onChange={(e) => vault.updateSettings({ showTagsInGraph: e.target.checked })}
            />
            <span className="switch-track" />
            Tags
          </label>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.showOrphansInGraph}
              onChange={(e) => vault.updateSettings({ showOrphansInGraph: e.target.checked })}
            />
            <span className="switch-track" />
            Orphans
          </label>
          <label className="switch">
            <input type="checkbox" checked={ghosts} onChange={(e) => setGhosts(e.target.checked)} />
            <span className="switch-track" />
            Unresolved
          </label>
        </div>
      </div>

      <div className="graph-legend">
        <span><i className="lg-note" /> note</span>
        <span><i className="lg-active" /> open note</span>
        <span><i className="lg-tag" /> tag</span>
        <span><i className="lg-ghost" /> not created yet</span>
        <span className="graph-hint">Scroll to zoom · drag to move · click to open</span>
      </div>
    </div>
  );
}
