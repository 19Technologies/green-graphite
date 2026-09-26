"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  Bold, ChevronDown, Hash, Heading2, IndentDecrease, IndentIncrease, Italic, Link2, ListChecks, Redo2, Undo2,
} from "lucide-react";
import { useUI } from "@/lib/ui";
import type { EditorView } from "@codemirror/view";
import { redo, undo } from "@codemirror/commands";
import { activeEditor, indent, insertText, toggleLinePrefix, wrap } from "@/lib/cm";

/** Height of the on-screen keyboard, from the visual viewport (0 when closed). */
function subscribe(onChange: () => void) {
  const vv = window.visualViewport;
  vv?.addEventListener("resize", onChange);
  vv?.addEventListener("scroll", onChange);
  return () => {
    vv?.removeEventListener("resize", onChange);
    vv?.removeEventListener("scroll", onChange);
  };
}
const keyboardInset = () => {
  const vv = window.visualViewport;
  return vv ? Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)) : 0;
};

function Tool({ label, onPress, children }: { label: string; onPress: (view: EditorView) => void; children: ReactNode }) {
  return (
    <button
      className="tool"
      aria-label={label}
      title={label}
      // Keep focus (and the keyboard) in the editor.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const view = activeEditor();
        if (view) onPress(view);
      }}
    >
      {children}
    </button>
  );
}

export default function EditToolbar() {
  const { editorFocused } = useUI();
  const inset = useSyncExternalStore(subscribe, keyboardInset, () => 0);
  if (!editorFocused) return null;

  return (
    <div className="edit-toolbar" style={{ bottom: inset }} role="toolbar" aria-label="Formatting" data-no-swipe>
      <div className="edit-toolbar-scroll">
        <Tool label="Undo" onPress={(v) => { undo(v); v.focus(); }}>
          <Undo2 size={18} />
        </Tool>
        <Tool label="Redo" onPress={(v) => { redo(v); v.focus(); }}>
          <Redo2 size={18} />
        </Tool>
        <span className="tool-sep" />
        <Tool label="Link to a note" onPress={(v) => wrap(v, "[[", "]]")}>
          <Link2 size={18} />
        </Tool>
        <Tool label="Flashcard ( :: )" onPress={(v) => insertText(v, " :: ")}>
          <span className="tool-text">::</span>
        </Tool>
        <Tool label="Tag" onPress={(v) => insertText(v, "#")}>
          <Hash size={18} />
        </Tool>
        <Tool label="Checklist" onPress={(v) => toggleLinePrefix(v, "- [ ] ", /^\s*[-*+] \[[ xX]\] /)}>
          <ListChecks size={18} />
        </Tool>
        <Tool label="Heading" onPress={(v) => toggleLinePrefix(v, "## ", /^#{1,6} /)}>
          <Heading2 size={18} />
        </Tool>
        <Tool label="Bold" onPress={(v) => wrap(v, "**")}>
          <Bold size={18} />
        </Tool>
        <Tool label="Italic" onPress={(v) => wrap(v, "*")}>
          <Italic size={18} />
        </Tool>
        <Tool label="Highlight (cloze card)" onPress={(v) => wrap(v, "==")}>
          <span className="tool-text tool-mark">==</span>
        </Tool>
        <Tool label="Indent" onPress={(v) => indent(v, false)}>
          <IndentIncrease size={18} />
        </Tool>
        <Tool label="Outdent" onPress={(v) => indent(v, true)}>
          <IndentDecrease size={18} />
        </Tool>
      </div>
      <Tool label="Hide keyboard" onPress={(v) => v.contentDOM.blur()}>
        <ChevronDown size={20} />
      </Tool>
    </div>
  );
}
