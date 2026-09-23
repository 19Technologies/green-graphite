"use client";
// Ephemeral UI state shared across components (not persisted).
import { useSyncExternalStore } from "react";
import type { InstallPromptEvent } from "@/components/ServiceWorker";

export type LeftView = "files" | "search";
export type PaletteMode = "commands" | "notes" | null;
export type SheetKind = "menu" | "tabs" | null;
export type RightTab = "backlinks" | "outgoing" | "cards" | "outline" | "graph";

export interface UIState {
  leftView: LeftView;
  searchQuery: string;
  palette: PaletteMode;
  mobileLeft: boolean;
  mobileRight: boolean;
  /** Note whose inline title should grab focus next time it renders. */
  pendingRename: string | null;
  /** Heading slug to scroll to after the next note render. */
  pendingHeading: string | null;
  /** Line to select in the editor after the next note render. */
  pendingLine: number | null;
  /** Mobile bottom sheet currently open. */
  sheet: SheetKind;
  /** True while the note editor has focus (mobile shows the editing toolbar). */
  editorFocused: boolean;
  installPrompt: InstallPromptEvent | null;
  rightTab: RightTab;
}

const INITIAL: UIState = {
  leftView: "files",
  searchQuery: "",
  palette: null,
  mobileLeft: false,
  mobileRight: false,
  pendingRename: null,
  pendingHeading: null,
  pendingLine: null,
  sheet: null,
  editorFocused: false,
  installPrompt: null,
  rightTab: "backlinks",
};

let ui = INITIAL;
const listeners = new Set<() => void>();

export function setUI(patch: Partial<UIState> | ((s: UIState) => Partial<UIState>)) {
  const next = typeof patch === "function" ? patch(ui) : patch;
  ui = { ...ui, ...next };
  listeners.forEach((l) => l());
}

export function getUI() {
  return ui;
}

export function useUI() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => ui,
    () => INITIAL,
  );
}

export function openSearch(query = "") {
  setUI({ leftView: "search", searchQuery: query, mobileLeft: true });
}
