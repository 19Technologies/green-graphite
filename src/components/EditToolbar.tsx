"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import {
  Bold, ChevronDown, Hash, Heading2, IndentDecrease, IndentIncrease, Italic, Link2, ListChecks, Redo2, Undo2,
} from "lucide-react";
import { useUI } from "@/lib/ui";
import { indent, insert, toggleLinePrefix, wrap } from "@/lib/textarea";

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

const editor = () => document.querySelector<HTMLTextAreaElement>(".editor-input");

function Tool({ label, onPress, children }: { label: string; onPress: (ta: HTMLTextAreaElement) => void; children: ReactNode }) {
  return (
    <button
      className="tool"
      aria-label={label}
      title={label}
      // Keep focus (and the keyboard) in the editor.
      onPointerDown={(e) => e.preventDefault()}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        const ta = editor();
        if (ta) onPress(ta);
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
        <Tool label="Undo" onPress={(ta) => { ta.focus(); document.execCommand("undo"); }}>
          <Undo2 size={18} />
        </Tool>
        <Tool label="Redo" onPress={(ta) => { ta.focus(); document.execCommand("redo"); }}>
          <Redo2 size={18} />
        </Tool>
        <span className="tool-sep" />
        <Tool label="Link to a note" onPress={(ta) => wrap(ta, "[[", "]]")}>
          <Link2 size={18} />
        </Tool>
        <Tool label="Flashcard ( :: )" onPress={(ta) => insert(ta, ta.selectionStart, ta.selectionEnd, " :: ")}>
          <span className="tool-text">::</span>
        </Tool>
        <Tool label="Tag" onPress={(ta) => insert(ta, ta.selectionStart, ta.selectionEnd, "#")}>
          <Hash size={18} />
        </Tool>
        <Tool label="Checklist" onPress={(ta) => toggleLinePrefix(ta, "- [ ] ", /^\s*[-*+] \[[ xX]\] /)}>
          <ListChecks size={18} />
        </Tool>
        <Tool label="Heading" onPress={(ta) => toggleLinePrefix(ta, "## ", /^#{1,6} /)}>
          <Heading2 size={18} />
        </Tool>
        <Tool label="Bold" onPress={(ta) => wrap(ta, "**")}>
          <Bold size={18} />
        </Tool>
        <Tool label="Italic" onPress={(ta) => wrap(ta, "*")}>
          <Italic size={18} />
        </Tool>
        <Tool label="Highlight (cloze card)" onPress={(ta) => wrap(ta, "==")}>
          <span className="tool-text tool-mark">==</span>
        </Tool>
        <Tool label="Indent" onPress={(ta) => indent(ta, false)}>
          <IndentIncrease size={18} />
        </Tool>
        <Tool label="Outdent" onPress={(ta) => indent(ta, true)}>
          <IndentDecrease size={18} />
        </Tool>
      </div>
      <Tool label="Hide keyboard" onPress={(ta) => ta.blur()}>
        <ChevronDown size={20} />
      </Tool>
    </div>
  );
}
