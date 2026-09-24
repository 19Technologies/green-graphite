"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays, ChevronsUpDown, Dices, FileSearch, Folder, GitFork, Layers, PanelLeft, Search, Settings, SquareTerminal, X,
} from "lucide-react";
import { cardsOf, dismissToast, getVault, indexOf, useToasts, useVault, vault } from "@/lib/store";
import { getUI, openSearch, setUI, useUI } from "@/lib/ui";
import FileTree from "./FileTree";
import SearchPanel from "./SearchPanel";
import CommandPalette from "./CommandPalette";
import MobileNav from "./MobileNav";
import EditToolbar from "./EditToolbar";
import Logo from "./Logo";
import TabBar from "./TabBar";
import RightPanel from "./RightPanel";

function Toasts() {
  const toasts = useToasts();
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.message}</span>
          {t.action && (
            <button
              className="toast-action"
              onClick={() => {
                t.action!.run();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button className="icon-btn" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function StatusBar() {
  const { notes, workspace, ready } = useVault();
  const pathname = usePathname();
  const note = pathname === "/" && workspace.active ? notes[workspace.active] : undefined;
  const stats = useMemo(() => {
    const cards = cardsOf(notes);
    if (!note) return { cards: cards.length };
    return {
      cards: cards.length,
      noteCards: cards.filter((c) => c.noteId === note.id).length,
      backlinks: indexOf(notes).backlinks.get(note.id)?.length ?? 0,
      words: note.content.trim() ? note.content.trim().split(/\s+/).length : 0,
      chars: note.content.length,
    };
  }, [notes, note]);
  if (!ready) return null;
  return (
    <footer className="statusbar">
      {note && (
        <>
          <span>{stats.backlinks} backlinks</span>
          <span>{stats.noteCards} cards</span>
          <span>{stats.words} words</span>
          <span>{stats.chars} characters</span>
        </>
      )}
      <Link href="/flashcards" className="status-item">
        <Layers size={12} /> {stats.cards}
      </Link>
    </footer>
  );
}

const NO_SWIPE = "[data-no-swipe], input, textarea, .tabs, .table-wrap, pre, .graph-canvas, .flip-wrap, .heatmap-wrap, .palette-backdrop";

/**
 * Obsidian-style drawer gestures on phones: swipe right to reveal the file explorer,
 * swipe left (in a note) for links & outline. The drawer tracks your finger.
 */
function useDrawerSwipe(pathname: string) {
  useEffect(() => {
    let start: { x: number; y: number; t: number } | null = null;
    let axis: "x" | "y" | null = null;
    let panel: { el: HTMLElement; side: "left" | "right"; opening: boolean } | null = null;
    let dx = 0;

    const isPhone = () => window.matchMedia("(max-width: 820px)").matches;
    const tabletRight = () => window.matchMedia("(max-width: 1100px)").matches;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const ui = getUI();
      const drawerOpen = ui.mobileLeft || ui.mobileRight;
      if (ui.sheet || ui.palette || (!drawerOpen && (e.target as Element).closest(NO_SWIPE))) return;
      start = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
      axis = null;
      panel = null;
      dx = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const x = e.touches[0].clientX - start.x;
      const y = e.touches[0].clientY - start.y;
      if (!axis) {
        if (Math.abs(x) < 10 && Math.abs(y) < 10) return;
        axis = Math.abs(x) > Math.abs(y) * 1.3 ? "x" : "y";
        if (axis === "y") return;
        const ui = getUI();
        let side: "left" | "right" | null = null;
        let opening = true;
        if (ui.mobileLeft) [side, opening] = ["left", false];
        else if (ui.mobileRight) [side, opening] = ["right", false];
        else if (x > 0 && isPhone()) side = "left";
        else if (x < 0 && pathname === "/" && tabletRight()) side = "right";
        const el = side && document.querySelector<HTMLElement>(side === "left" ? ".sidebar-left" : ".right-panel");
        if (!el || !side) {
          start = null;
          return;
        }
        panel = { el, side, opening };
        el.style.transition = "none";
      }
      if (axis !== "x" || !panel) return;
      e.preventDefault();
      dx = x;
      const w = panel.el.offsetWidth;
      const tx =
        panel.side === "left"
          ? Math.min(0, Math.max(-w, (panel.opening ? -w : 0) + dx))
          : Math.max(0, Math.min(w, (panel.opening ? w : 0) + dx));
      panel.el.style.transform = `translateX(${tx}px)`;
      document.documentElement.style.setProperty("--drawer-progress", String(1 - Math.abs(tx) / w));
      document.documentElement.classList.add("is-dragging-drawer");
    };

    const onEnd = () => {
      if (panel) {
        const { el, side, opening } = panel;
        const w = el.offsetWidth;
        const fast = Math.abs(dx) / Math.max(1, Date.now() - start!.t) > 0.5;
        const toward = side === "left" ? (opening ? dx > 0 : dx < 0) : opening ? dx < 0 : dx > 0;
        const flip = toward && (Math.abs(dx) > w * 0.3 || fast);
        const open = opening ? flip : !flip;
        el.style.transition = "";
        el.style.transform = "";
        document.documentElement.classList.remove("is-dragging-drawer");
        document.documentElement.style.removeProperty("--drawer-progress");
        setUI(side === "left" ? { mobileLeft: open } : { mobileRight: open });
        if (open && opening) navigator.vibrate?.(8);
      }
      start = null;
      panel = null;
      axis = null;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [pathname]);
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { workspace, notes, ready } = useVault();
  const { leftView, mobileLeft, mobileRight, editorFocused } = useUI();
  const pathname = usePathname();
  const router = useRouter();
  useDrawerSwipe(pathname);
  const note = pathname === "/" && workspace.active ? notes[workspace.active] : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if ((key === "k" || key === "p") && !e.shiftKey) {
        e.preventDefault();
        setUI((s) => ({ palette: s.palette === "commands" ? null : "commands" }));
      } else if (key === "o") {
        e.preventDefault();
        setUI((s) => ({ palette: s.palette === "notes" ? null : "notes" }));
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        vault.setPanel("leftOpen", true);
        openSearch();
      } else if (key === "\\") {
        e.preventDefault();
        vault.setPanel("leftOpen");
      } else if (key === "e" && pathname === "/") {
        e.preventDefault();
        vault.setMode(getVault().workspace.mode === "read" ? "edit" : "read");
      } else if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        vault.go(e.key === "ArrowLeft" ? -1 : 1);
        if (pathname !== "/") router.push("/");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, router]);

  useEffect(() => {
    setUI({ mobileLeft: false, mobileRight: false, sheet: null });
  }, [pathname]);

  const ribbon: Array<{ label: string; icon: ReactNode; run: () => void; active?: boolean }> = [
    { label: "Open quick switcher", icon: <FileSearch size={18} />, run: () => setUI({ palette: "notes" }) },
    { label: "Open graph view", icon: <GitFork size={18} />, run: () => router.push("/graph"), active: pathname === "/graph" },
    { label: "Flashcards", icon: <Layers size={18} />, run: () => router.push("/flashcards"), active: pathname.startsWith("/flashcards") },
    { label: "Open today's daily note", icon: <CalendarDays size={18} />, run: () => { vault.openDaily(); router.push("/"); } },
    { label: "Open random note", icon: <Dices size={18} />, run: () => { vault.openRandom(); router.push("/"); } },
    { label: "Open command palette", icon: <SquareTerminal size={18} />, run: () => setUI({ palette: "commands" }) },
  ];

  return (
    <div
      className="shell"
      data-left={workspace.leftOpen ? "open" : "closed"}
      data-right={note && workspace.rightOpen ? "open" : "closed"}
      data-mobile-left={mobileLeft ? "open" : "closed"}
      data-mobile-right={mobileRight ? "open" : "closed"}
      data-editing={editorFocused ? "true" : undefined}
    >
      <nav className="ribbon" aria-label="Ribbon">
        <button
          className="ribbon-btn ribbon-toggle"
          aria-label="Toggle left sidebar"
          title="Toggle left sidebar (⌘\)"
          onClick={() => vault.setPanel("leftOpen")}
        >
          <PanelLeft size={18} />
        </button>
        <div className="ribbon-group">
          {ribbon.map((r) => (
            <button key={r.label} className={`ribbon-btn${r.active ? " is-active" : ""}`} aria-label={r.label} title={r.label} onClick={r.run}>
              {r.icon}
            </button>
          ))}
        </div>
      </nav>

      <aside className="sidebar-left" aria-label="Files and search">
        <div className="sidebar-head">
          <div className="side-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={leftView === "files"}
              className={`side-tab${leftView === "files" ? " is-active" : ""}`}
              aria-label="Files"
              title="Files"
              onClick={() => setUI({ leftView: "files" })}
            >
              <Folder size={17} />
            </button>
            <button
              role="tab"
              aria-selected={leftView === "search"}
              className={`side-tab${leftView === "search" ? " is-active" : ""}`}
              aria-label="Search"
              title="Search (⌘⇧F)"
              onClick={() => setUI({ leftView: "search" })}
            >
              <Search size={17} />
            </button>
          </div>
          <button className="icon-btn only-mobile" aria-label="Close" onClick={() => setUI({ mobileLeft: false })}>
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-body">{ready && (leftView === "files" ? <FileTree /> : <SearchPanel />)}</div>
        <div className="vault-bar">
          <button className="vault-switcher" onClick={() => setUI({ palette: "notes" })} title="Green Graphite vault">
            <span>Green Graphite</span>
            <ChevronsUpDown size={14} />
          </button>
          <Link href="/settings" className="icon-btn" aria-label="Settings" title="Settings">
            <Settings size={16} />
          </Link>
        </div>
      </aside>
      <div className="drawer-scrim" onClick={() => setUI({ mobileLeft: false, mobileRight: false })} />

      <main className="main">
        <TabBar />
        <div className="view">{ready ? children : <div className="boot"><Logo size={28} /></div>}</div>
      </main>

      {pathname === "/" && (
        <aside className="right-panel" aria-label="Links, cards and outline">
          {ready && note && <RightPanel note={note} />}
        </aside>
      )}

      <StatusBar />
      <MobileNav />
      <EditToolbar />
      <CommandPalette />
      <Toasts />
    </div>
  );
}
