"use client";

import { usePathname, useRouter } from "next/navigation";
import { BookOpen, GitFork, Layers, PanelRight, Plus, Settings, X } from "lucide-react";
import { titleOf } from "@/lib/vault";
import { useVault, vault } from "@/lib/store";
import { setUI } from "@/lib/ui";

/** Non-note views get a tab of their own, like Obsidian's graph view. */
const VIEWS: Record<string, { title: string; icon: React.ReactNode }> = {
  "/graph": { title: "Graph view", icon: <GitFork size={15} /> },
  "/flashcards": { title: "Flashcards", icon: <Layers size={15} /> },
  "/flashcards/study": { title: "Study session", icon: <BookOpen size={15} /> },
  "/settings": { title: "Settings", icon: <Settings size={15} /> },
};

export default function TabBar() {
  const { notes, workspace } = useVault();
  const pathname = usePathname();
  const router = useRouter();
  const view = VIEWS[pathname];
  const onNotes = pathname === "/";

  return (
    <div className="tabbar">
      <div className="tabs" role="tablist">
        {workspace.tabs.map((id) => {
          const n = notes[id];
          if (!n) return null;
          const active = onNotes && id === workspace.active;
          return (
            <div
              key={id}
              role="tab"
              aria-selected={active}
              className={`tab${active ? " is-active" : ""}`}
              onClick={() => {
                vault.openNote(id);
                if (!onNotes) router.push("/");
              }}
              onAuxClick={(e) => e.button === 1 && vault.closeTab(id)}
              title={n.path}
            >
              <span className="tab-title">{titleOf(n.path)}</span>
              <button
                className="tab-close"
                aria-label={`Close ${titleOf(n.path)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  vault.closeTab(id);
                }}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
        {view && (
          <div role="tab" aria-selected className="tab is-active">
            <span className="tab-icon">{view.icon}</span>
            <span className="tab-title">{view.title}</span>
            <button className="tab-close" aria-label={`Close ${view.title}`} onClick={() => router.push("/")}>
              <X size={14} />
            </button>
          </div>
        )}
        <button
          className="tab-new icon-btn"
          aria-label="New tab"
          title="New tab"
          onClick={() => {
            setUI({ pendingRename: vault.createNote({ newTab: true }) });
            if (!onNotes) router.push("/");
          }}
        >
          <Plus size={16} />
        </button>
      </div>
      {onNotes && (
        <button
          className={`icon-btn sidebar-toggle${workspace.rightOpen ? " is-on" : ""}`}
          aria-label="Toggle right sidebar"
          title="Toggle right sidebar"
          onClick={() => {
            if (window.matchMedia("(max-width: 1100px)").matches) setUI((s) => ({ mobileRight: !s.mobileRight }));
            else vault.setPanel("rightOpen");
          }}
        >
          <PanelRight size={17} />
        </button>
      )}
    </div>
  );
}
