"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, BookOpen, CalendarDays, Dices, FileText, FolderPlus, GitFork, Layers, Menu, Plus, Search,
  Settings, SquareTerminal, X,
} from "lucide-react";
import { folderOf, titleOf } from "@/lib/vault";
import { plainLine } from "@/lib/links";
import { useCards, useVault, vault } from "@/lib/store";
import { openSearch, setUI, useUI } from "@/lib/ui";
import Sheet from "./Sheet";

const closeSheet = () => setUI({ sheet: null });

function MenuSheet() {
  const router = useRouter();
  const cards = useCards();
  const go = (fn: () => void) => () => {
    closeSheet();
    fn();
  };
  const items = [
    { label: "Notes", icon: <FileText size={18} />, run: () => router.push("/") },
    { label: "Graph view", icon: <GitFork size={18} />, run: () => router.push("/graph") },
    { label: "Flashcards", icon: <Layers size={18} />, run: () => router.push("/flashcards") },
    { label: `Study all ${cards.length} flashcards`, icon: <BookOpen size={18} />, run: () => router.push("/flashcards/study") },
    { label: "Daily note", icon: <CalendarDays size={18} />, run: () => { vault.openDaily(); router.push("/"); } },
    { label: "Search", icon: <Search size={18} />, run: () => openSearch() },
    { label: "Random note", icon: <Dices size={18} />, run: () => { vault.openRandom(); router.push("/"); } },
    { label: "New folder", icon: <FolderPlus size={18} />, run: () => { vault.createFolder(); setUI({ mobileLeft: true, leftView: "files" }); } },
    { label: "Command palette", icon: <SquareTerminal size={18} />, run: () => setUI({ palette: "commands" }) },
    { label: "Settings", icon: <Settings size={18} />, run: () => router.push("/settings") },
  ];
  return (
    <div className="sheet-list">
      {items.map((it) => (
        <button key={it.label} className="sheet-item" onClick={go(it.run)}>
          {it.icon}
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function TabsSheet() {
  const { notes, workspace } = useVault();
  const router = useRouter();
  const tabs = workspace.tabs.filter((id) => notes[id]);
  const previews = useMemo(
    () =>
      Object.fromEntries(
        tabs.map((id) => [
          id,
          notes[id].content
            .split("\n")
            .map(plainLine)
            .filter((l) => l && !/^#{1,6}\s|^#\w/.test(l))
            .slice(0, 4)
            .join(" "),
        ]),
      ),
    [tabs, notes],
  );
  return (
    <>
      <div className="tab-grid">
        {tabs.map((id) => (
          <div
            key={id}
            className={`tab-card${id === workspace.active ? " is-active" : ""}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              vault.openNote(id);
              closeSheet();
              router.push("/");
            }}
          >
            <div className="tab-card-head">
              <span>{titleOf(notes[id].path)}</span>
              <button
                className="icon-btn"
                aria-label={`Close ${titleOf(notes[id].path)}`}
                onClick={(e) => {
                  e.stopPropagation();
                  vault.closeTab(id);
                }}
              >
                <X size={14} />
              </button>
            </div>
            {folderOf(notes[id].path) && <span className="tab-card-path">{folderOf(notes[id].path)}</span>}
            <p className="tab-card-preview">{previews[id] || "Empty note"}</p>
          </div>
        ))}
      </div>
      <button
        className="btn btn-block sheet-action"
        onClick={() => {
          setUI({ sheet: null, pendingRename: vault.createNote({ newTab: true }) });
          router.push("/");
        }}
      >
        <Plus size={16} /> New tab
      </button>
    </>
  );
}

export default function MobileNav() {
  const { workspace, notes } = useVault();
  const { sheet, editorFocused } = useUI();
  const router = useRouter();
  const pathname = usePathname();
  const tabCount = workspace.tabs.filter((id) => notes[id]).length;
  const canBack = pathname !== "/" || workspace.history.slice(0, workspace.historyIndex).some((id) => notes[id]);
  const canForward = workspace.history.slice(workspace.historyIndex + 1).some((id) => notes[id]);

  return (
    <>
      <nav className={`mobile-nav${editorFocused ? " is-hidden" : ""}`} aria-label="Navigation">
        <button
          className="mnav-btn"
          aria-label="Back"
          disabled={!canBack}
          onClick={() => (pathname !== "/" ? router.push("/") : vault.go(-1))}
        >
          <ArrowLeft size={21} />
        </button>
        <button
          className="mnav-btn"
          aria-label="Forward"
          disabled={!canForward}
          onClick={() => {
            vault.go(1);
            if (pathname !== "/") router.push("/");
          }}
        >
          <ArrowRight size={21} />
        </button>
        <button
          className="mnav-btn"
          aria-label="New note"
          onClick={() => {
            const folder = workspace.active && notes[workspace.active] ? folderOf(notes[workspace.active].path) : "";
            setUI({ pendingRename: vault.createNote({ folder, newTab: true }) });
            router.push("/");
          }}
        >
          <Plus size={22} />
        </button>
        <button className="mnav-btn" aria-label={`${tabCount} open tabs`} onClick={() => setUI({ sheet: "tabs" })}>
          <span className="mnav-tabs">{tabCount}</span>
        </button>
        <button className="mnav-btn" aria-label="Menu" onClick={() => setUI({ sheet: "menu" })}>
          <Menu size={21} />
        </button>
      </nav>

      <Sheet open={sheet === "menu"} onClose={closeSheet}>
        <MenuSheet />
      </Sheet>
      <Sheet open={sheet === "tabs"} onClose={closeSheet} title={`${tabCount} open ${tabCount === 1 ? "tab" : "tabs"}`}>
        <TabsSheet />
      </Sheet>
    </>
  );
}
