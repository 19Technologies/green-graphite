"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import { GraphData, GraphNode, rememberPositions } from "@/lib/graph";
import { cssVar, withAlpha } from "@/lib/theme";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Methods = ForceGraphMethods<GraphNode>;

export default function GraphCanvas({
  data,
  activeId,
  query = "",
  compact = false,
  onNodeClick,
}: {
  data: GraphData;
  activeId?: string | null;
  query?: string;
  compact?: boolean;
  onNodeClick: (node: GraphNode, e: MouseEvent) => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const fg = useRef<Methods | undefined>(undefined);
  const hover = useRef<string | null>(null);
  const fitted = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const g = fg.current;
    if (!g) return;
    g.d3Force("charge")?.strength(compact ? -90 : -140);
    g.d3Force("link")?.distance(compact ? 42 : 60);
  }, [compact, data, size.width]);

  const q = query.trim().toLowerCase();

  const isLit = (id: string) => {
    const h = hover.current;
    if (!h) return true;
    return id === h || !!data.neighbours.get(h)?.has(id);
  };

  const radius = (n: GraphNode) => (compact ? 3 : 3.2) + Math.sqrt(n.degree) * (compact ? 1 : 1.4);

  // Flat, Obsidian-like rendering: grey nodes and links; the open note is white; hovered links turn green.
  const drawNode = (node: GraphNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const focused = cssVar("--graph-node-focused", "#f4f4f5");
    const tagColor = cssVar("--graph-node-tag", "#6f6f78");
    const nodeColor = cssVar("--graph-node", "#9a9a9a");
    const faint = cssVar("--graph-node-unresolved", "#5a5a5a");
    const text = cssVar("--text-normal", "#dadada");
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = radius(node);
    const hovered = hover.current === node.id;
    const lit = isLit(node.id);
    const matches = !q || node.label.toLowerCase().includes(q);
    const isActive = node.noteId !== undefined && node.noteId === activeId;
    const dim = (!lit || !matches) && !isActive;

    ctx.save();
    ctx.globalAlpha = dim ? 0.2 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle =
      hovered || isActive || (q && matches && node.kind === "note")
        ? focused
        : node.kind === "tag"
          ? tagColor
          : node.kind === "ghost"
            ? faint
            : nodeColor;
    ctx.fill();

    const showLabel = hovered || (hover.current && lit) || (q && matches) || scale > (compact ? 1.4 : 1.1);
    if (showLabel && !dim) {
      const fontSize = Math.max(12 / scale, 2);
      ctx.font = `${hovered ? 600 : 400} ${fontSize}px ${cssVar("--font-ui", "system-ui")}, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillStyle = withAlpha(text, hovered || isActive ? 1 : 0.8);
      ctx.fillText(node.label, x, y + r + 2 / scale + 1);
    }
    ctx.restore();
  };

  const linkColor = (link: { source?: unknown; target?: unknown }) => {
    const s = (link.source as GraphNode)?.id;
    const t = (link.target as GraphNode)?.id;
    const line = cssVar("--graph-line", "#4a4a4a");
    // Links are the only thing drawn in green.
    if (hover.current && (s === hover.current || t === hover.current)) return cssVar("--link", "#5ce65c");
    if (hover.current) return withAlpha(line, 0.3);
    return line;
  };

  return (
    <div ref={wrap} className={`graph-canvas${compact ? " is-compact" : ""}`}>
      {size.width > 0 && (
        <ForceGraph2D
          ref={fg as never}
          graphData={data as never}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          nodeRelSize={4}
          nodeVal={(n) => radius(n as GraphNode) / 2}
          nodeLabel={() => ""}
          nodeCanvasObject={(n, ctx, scale) => drawNode(n as GraphNode, ctx, scale)}
          nodePointerAreaPaint={(n, color, ctx) => {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, radius(n as GraphNode) + 3, 0, Math.PI * 2);
            ctx.fill();
          }}
          linkColor={linkColor as never}
          linkWidth={(l) => {
            const s = ((l as { source: GraphNode }).source as GraphNode)?.id;
            const t = ((l as { target: GraphNode }).target as GraphNode)?.id;
            return hover.current && (s === hover.current || t === hover.current) ? 1.4 : 1;
          }}
          autoPauseRedraw={false}
          cooldownTicks={compact ? 80 : 160}
          warmupTicks={compact ? 30 : 0}
          d3VelocityDecay={0.32}
          onEngineStop={() => {
            rememberPositions(data.nodes);
            if (compact || !fitted.current) fg.current?.zoomToFit(400, compact ? 44 : 120);
            fitted.current = true;
          }}
          onNodeHover={(n) => {
            hover.current = n ? (n as GraphNode).id : null;
            if (wrap.current) wrap.current.style.cursor = n ? "pointer" : "grab";
          }}
          onNodeClick={(n, e) => onNodeClick(n as GraphNode, e)}
          enableZoomInteraction={!compact || ((e: MouseEvent) => e.ctrlKey || e.metaKey)}
        />
      )}
    </div>
  );
}
