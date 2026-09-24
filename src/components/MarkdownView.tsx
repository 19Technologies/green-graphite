"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Element, ElementContent } from "hast";
import { usePathname, useRouter } from "next/navigation";
import { remarkWiki } from "@/lib/remark-wiki";
import { slugify } from "@/lib/links";
import { titleOf } from "@/lib/vault";
import { useIndex, useVault, vault } from "@/lib/store";
import { openSearch, setUI } from "@/lib/ui";

interface Ctx {
  sourceId?: string;
  interactive: boolean;
  depth: number;
  onToggleTask?: (line: number) => void;
}

const MarkdownCtx = createContext<Ctx>({ interactive: true, depth: 0 });
const TaskLineCtx = createContext<number | null>(null);

function hastText(node: ElementContent | Element | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value;
  if ("children" in node) return node.children.map((c) => hastText(c as ElementContent)).join("");
  return "";
}

/* ------------------------------------------------------------------ */

function HoverPreview({ noteId, rect, onEnter, onLeave }: {
  noteId: string;
  rect: DOMRect;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const { notes } = useVault();
  const note = notes[noteId];
  if (!note) return null;
  const width = Math.min(420, window.innerWidth - 24);
  const below = window.innerHeight - rect.bottom > 300 || rect.top < 300;
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
  const style = below
    ? { top: rect.bottom + 8, left, width }
    : { bottom: window.innerHeight - rect.top + 8, left, width };
  return (
    <div className="hover-preview" style={style} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <div className="hover-preview-title">{titleOf(note.path)}</div>
      <div className="hover-preview-body">
        <MarkdownView content={note.content} sourceId={note.id} cards depth={1} />
      </div>
    </div>
  );
}

function WikiLink({ target, children }: { target: string; children: ReactNode }) {
  const { sourceId, interactive, depth } = useContext(MarkdownCtx);
  const index = useIndex();
  const router = useRouter();
  const pathname = usePathname();
  const [preview, setPreview] = useState<DOMRect | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hash = target.indexOf("#");
  const name = hash === -1 ? target : target.slice(0, hash);
  const heading = hash === -1 ? null : target.slice(hash + 1);
  const note = index.resolve(name);

  if (!interactive) return <span className="internal-link is-static">{children}</span>;

  const open = (e: React.MouseEvent) => {
    e.preventDefault();
    clearTimeout(timer.current);
    setPreview(null);
    const newTab = e.metaKey || e.ctrlKey;
    if (note) vault.openNote(note.id, { newTab });
    else vault.createFromLink(name, sourceId);
    if (heading) setUI({ pendingHeading: slugify(heading) });
    if (pathname !== "/") router.push("/");
  };

  const show = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!note || depth > 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPreview(rect), 350);
  };
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setPreview(null), 180);
  };

  return (
    <>
      <a
        href={note ? `/?note=${encodeURIComponent(note.path)}` : "#"}
        className={`internal-link${note ? "" : " is-unresolved"}`}
        title={note ? undefined : `"${name}" doesn't exist yet. Click to create it.`}
        onClick={open}
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        {children}
      </a>
      {preview && note && (
        <HoverPreview
          noteId={note.id}
          rect={preview}
          onEnter={() => clearTimeout(timer.current)}
          onLeave={hide}
        />
      )}
    </>
  );
}

/** Tutora pastel tint for a tag, stable per tag name. Mint is left out: green is for links only. */
const TINTS = ["sun", "sky", "lilac", "peach"] as const;
export function tintFor(tag: string) {
  let h = 7;
  for (const ch of tag.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

function TagLink({ tag, children }: { tag: string; children: ReactNode }) {
  const { interactive } = useContext(MarkdownCtx);
  if (!interactive) return <span className="tag" data-tint={tintFor(tag)}>{children}</span>;
  return (
    <a
      href="#"
      className="tag"
      data-tint={tintFor(tag)}
      onClick={(e) => {
        e.preventDefault();
        openSearch(`#${tag}`);
      }}
    >
      {children}
    </a>
  );
}

function TaskCheckbox({ checked }: { checked: boolean }) {
  const line = useContext(TaskLineCtx);
  const { onToggleTask } = useContext(MarkdownCtx);
  return (
    <input
      type="checkbox"
      className="task-checkbox"
      checked={checked}
      disabled={!onToggleTask || line === null}
      onChange={() => line !== null && onToggleTask?.(line)}
    />
  );
}

function heading(Tag: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
  const Heading: Components["h1"] = ({ node, children, ...props }) => {
    void node;
    return (
      <Tag id={slugify(hastText(node))} {...props}>
        {children}
      </Tag>
    );
  };
  return Heading;
}

const components: Components = {
  a: ({ href = "", children, node, ...props }) => {
    void node;
    if (href.startsWith("#wiki/")) return <WikiLink target={decodeURIComponent(href.slice(6))}>{children}</WikiLink>;
    if (href.startsWith("#tag/")) return <TagLink tag={decodeURIComponent(href.slice(5))}>{children}</TagLink>;
    return (
      <a href={href} target="_blank" rel="noreferrer" className="external-link" {...props}>
        {children}
      </a>
    );
  },
  h1: heading("h1"),
  h2: heading("h2"),
  h3: heading("h3"),
  h4: heading("h4"),
  h5: heading("h5"),
  h6: heading("h6"),
  table: ({ node, ...props }) => {
    void node;
    return (
      <div className="table-wrap">
        <table {...props} />
      </div>
    );
  },
  li: ({ node, children, ...props }) => {
    const isTask = String(props.className ?? "").includes("task-list-item");
    const line = node?.position ? node.position.start.line - 1 : null;
    return (
      <li {...props}>
        {isTask ? <TaskLineCtx.Provider value={line}>{children}</TaskLineCtx.Provider> : children}
      </li>
    );
  },
  input: ({ node, ...props }) => {
    void node;
    if (props.type === "checkbox") return <TaskCheckbox checked={!!props.checked} />;
    return <input {...props} />;
  },
};

export default function MarkdownView({
  content,
  sourceId,
  cards = false,
  interactive = true,
  depth = 0,
  blurAnswers = false,
  onToggleTask,
  className = "",
}: {
  content: string;
  sourceId?: string;
  cards?: boolean;
  interactive?: boolean;
  depth?: number;
  blurAnswers?: boolean;
  onToggleTask?: (line: number) => void;
  className?: string;
}) {
  const plugins = useMemo(() => [remarkGfm, [remarkWiki, { cards }]] as const, [cards]);
  const ctx = useMemo(
    () => ({ sourceId, interactive, depth, onToggleTask }),
    [sourceId, interactive, depth, onToggleTask],
  );
  return (
    <MarkdownCtx.Provider value={ctx}>
      <div className={`markdown${blurAnswers ? " blur-answers" : ""} ${className}`}>
        <ReactMarkdown remarkPlugins={plugins as never} components={components}>
          {content}
        </ReactMarkdown>
      </div>
    </MarkdownCtx.Provider>
  );
}
