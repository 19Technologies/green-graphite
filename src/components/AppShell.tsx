"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays, Command, Files, Layers, Network, NotebookPen, Search, Settings, X,
} from "lucide-react";
import { cardsOf, dismissToast, getVault, indexOf, useToasts, useVault, vault } from "@/lib/store";
import { getUI, openSearch, setUI, useUI } from "@/lib/ui";
import FileTree from "./FileTree";
import SearchPanel from "./SearchPanel";
import CommandPalette from "./CommandPalette";
import MobileNav from "./MobileNav";
import EditToolbar from "./EditToolbar";
import Logo from "./Logo";

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
  const note = workspace.active ? notes[workspace.active] : undefined;
  const stats = useMemo(() => {
    const cards = cardsOf(notes);
    if (!note) return { cards: cards.length };
    const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;
    return {
      cards: cards.length,
      noteCards: cards.filter((c) => c.noteId === note.id).length,
      backlinks: indexOf(notes).backlinks.get(note.id)?.length ?? 0,
      words,
      chars: note.content.length,
    };
  }, [notes, note]);
  if (!ready) return <footer className="statusbar" />;
  return (
    <footer className="statusbar">
      {pathname === "/" && note && (
        <>
          <span>{stats.backlinks} backlinks</span>
          <span>{stats.noteCards} cards</span>
          <span>{stats.words} words</span>
          <span>{stats.chars} characters</span>
        </>
      )}
      <Link href="/flashcards" className="status-cards">
        <span className="pulse-dot" />
        {stats.cards} cards in vault
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
  const { workspace, ready } = useVault();
  const { leftView, mobileLeft, mobileRight, editorFocused } = useUI();
  const pathname = usePathname();
  const router = useRouter();
  useDrawerSwipe(pathname);

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

  const nav = [
    { href: "/", label: "Notes", icon: <NotebookPen size={19} /> },
    { href: "/graph", label: "Graph view", icon: <Network size={19} /> },
    { href: "/flashcards", label: "Flashcards", icon: <Layers size={19} /> },
  ];
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const showLeft = (v: "files" | "search") => {
    if (workspace.leftOpen && leftView === v) vault.setPanel("leftOpen", false);
    else {
      setUI({ leftView: v });
      vault.setPanel("leftOpen", true);
    }
  };

  return (
    <div
      className="shell"
      data-left={workspace.leftOpen ? "open" : "closed"}
      data-mobile-left={mobileLeft ? "open" : "closed"}
      data-mobile-right={mobileRight ? "open" : "closed"}
      data-editing={editorFocused ? "true" : undefined}
    >
      <nav className="ribbon" aria-label="Main">
        <Link href="/" className="ribbon-logo" aria-label="Green Graphite home">
          <Logo />
        </Link>
        <button className={`ribbon-btn only-desktop${workspace.leftOpen && leftView === "files" ? " is-on" : ""}`} title="Files" onClick={() => showLeft("files")}>
          <Files size={19} />
        </button>
        <button className={`ribbon-btn only-desktop${workspace.leftOpen && leftView === "search" ? " is-on" : ""}`} title="Search (⌘⇧F)" onClick={() => showLeft("search")}>
          <Search size={19} />
        </button>
        <span className="ribbon-sep only-desktop" />
        {nav.map((n) => (
          <Link key={n.href} href={n.href} title={n.label} className={`ribbon-btn${isActive(n.href) ? " is-active" : ""}`}>
            {n.icon}
          </Link>
        ))}
        <button className="ribbon-btn only-desktop" title="Today's daily note" onClick={() => { vault.openDaily(); router.push("/"); }}>
          <CalendarDays size={19} />
        </button>
        <span className="ribbon-spacer" />
        <button className="ribbon-btn only-desktop" title="Command palette (⌘K)" onClick={() => setUI({ palette: "commands" })}>
          <Command size={19} />
        </button>
        <Link href="/settings" title="Settings" className={`ribbon-btn${isActive("/settings") ? " is-active" : ""}`}>
          <Settings size={19} />
        </Link>
      </nav>

      <aside className="sidebar-left" aria-label="Files and search">
        <div className="sidebar-head">
          <div className="segmented">
            <button className={leftView === "files" ? "is-on" : ""} onClick={() => setUI({ leftView: "files" })}>
              <Files size={14} /> Files
            </button>
            <button className={leftView === "search" ? "is-on" : ""} onClick={() => setUI({ leftView: "search" })}>
              <Search size={14} /> Search
            </button>
          </div>
          <button className="icon-btn only-mobile" aria-label="Close" onClick={() => setUI({ mobileLeft: false })}>
            <X size={16} />
          </button>
        </div>
        <div className="sidebar-body">{ready && (leftView === "files" ? <FileTree /> : <SearchPanel />)}</div>
        <div className="vault-name">
          <span className="vault-dot" /> Green Graphite
          <Link href="/settings" className="icon-btn only-mobile vault-settings" aria-label="Settings">
            <Settings size={16} />
          </Link>
        </div>
      </aside>
      <div className="drawer-scrim" onClick={() => setUI({ mobileLeft: false, mobileRight: false })} />

      <main className="main">{ready ? children : <div className="boot"><Logo size={28} /></div>}</main>
      <StatusBar />
      <MobileNav />
      <EditToolbar />
      <CommandPalette />
      <Toasts />
    </div>
  );
}

