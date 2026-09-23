"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, Settings2, X } from "lucide-react";
import GraphCanvas from "@/components/GraphCanvas";
import { buildGraph } from "@/lib/graph";
import { indexOf, useVault, vault } from "@/lib/store";
import { openSearch } from "@/lib/ui";

export default function GraphPage() {
  const { notes, settings, workspace } = useVault();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [ghosts, setGhosts] = useState(true);
  const [controls, setControls] = useState(true);
  const [filters, setFilters] = useState(true);
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

      <div className={`graph-controls${controls ? "" : " is-closed"}`}>
        {controls ? (
          <>
            <div className="graph-controls-head">
              <button className="graph-section-toggle" onClick={() => setFilters(!filters)} aria-expanded={filters}>
                <ChevronDown size={14} className={`collapse-icon${filters ? "" : " is-collapsed"}`} />
                Filters
              </button>
              <button className="icon-btn" aria-label="Close graph settings" onClick={() => setControls(false)}>
                <X size={15} />
              </button>
            </div>
            {filters && (
              <div className="graph-section">
                <label className="search-box">
                  <Search size={14} />
                  <input value={query} placeholder="Search files..." onChange={(e) => setQuery(e.target.value)} />
                </label>
                <label className="setting-row">
                  <span>Tags</span>
                  <span className="switch">
                    <input
                      type="checkbox"
                      checked={settings.showTagsInGraph}
                      onChange={(e) => vault.updateSettings({ showTagsInGraph: e.target.checked })}
                    />
                    <span className="switch-track" />
                  </span>
                </label>
                <label className="setting-row">
                  <span>Existing files only</span>
                  <span className="switch">
                    <input type="checkbox" checked={!ghosts} onChange={(e) => setGhosts(!e.target.checked)} />
                    <span className="switch-track" />
                  </span>
                </label>
                <label className="setting-row">
                  <span>Orphans</span>
                  <span className="switch">
                    <input
                      type="checkbox"
                      checked={settings.showOrphansInGraph}
                      onChange={(e) => vault.updateSettings({ showOrphansInGraph: e.target.checked })}
                    />
                    <span className="switch-track" />
                  </span>
                </label>
              </div>
            )}
            <div className="graph-stats">
              {stats.notes} notes · {stats.links} links · {stats.tags} tags
            </div>
          </>
        ) : (
          <button className="icon-btn" aria-label="Open graph settings" title="Open graph settings" onClick={() => setControls(true)}>
            <Settings2 size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
