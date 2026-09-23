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

  const radius = (n: GraphNode) => (compact ? 3 : 3.5) + Math.sqrt(n.degree) * (compact ? 1.1 : 1.6);

  const drawNode = (node: GraphNode, ctx: CanvasRenderingContext2D, scale: number) => {
    const accent = cssVar("--accent", "#5CE65C");
    const text = cssVar("--text", "#e6ede6");
    const muted = cssVar("--text-faint", "#5d6a5d");
    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const r = radius(node);
    const hovered = hover.current === node.id;
    const lit = isLit(node.id);
    const matches = !q || node.label.toLowerCase().includes(q);
    const isActive = node.noteId !== undefined && node.noteId === activeId;
    const dim = (!lit || !matches) && !isActive;

    ctx.save();
    ctx.globalAlpha = dim ? 0.14 : 1;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (node.kind === "note") {
      const strong = isActive || hovered || (hover.current && lit) || (q && matches);
      ctx.fillStyle = strong ? accent : withAlpha(text, 0.78);
      if (strong) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = isActive ? 22 : 14;
      }
      ctx.fill();
      if (isActive) {
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1.5 / scale;
        ctx.strokeStyle = withAlpha(accent, 0.55);
        ctx.beginPath();
        ctx.arc(x, y, r + 4 / scale + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else {
      ctx.lineWidth = 1.4 / scale + 0.4;
      ctx.setLineDash(node.kind === "ghost" ? [2 / scale + 1, 2 / scale + 1] : []);
      ctx.strokeStyle = node.kind === "tag" ? withAlpha(accent, hovered ? 1 : 0.6) : muted;
      ctx.fillStyle = cssVar("--bg", "#0b0e0b");
      ctx.fill();
      ctx.stroke();
    }

    const showLabel = hovered || isActive || (hover.current && lit) || (q && matches) || scale > (compact ? 1.6 : 1.25);
    if (showLabel && !dim) {
      const fontSize = Math.max(11 / scale, 2.2);
      ctx.font = `${hovered || isActive ? 600 : 450} ${fontSize}px ${cssVar("--font-ui", "system-ui")}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.shadowBlur = 0;
      ctx.fillStyle = node.kind === "note" ? (hovered || isActive ? text : withAlpha(text, 0.72)) : withAlpha(accent, 0.8);
      ctx.fillText(node.label, x, y + r + 3 / scale + 1);
    }
    ctx.restore();
  };

  const linkColor = (link: { source?: unknown; target?: unknown; kind?: string }) => {
    const s = (link.source as GraphNode)?.id;
    const t = (link.target as GraphNode)?.id;
    const accent = cssVar("--accent", "#5CE65C");
    const line = cssVar("--graph-line", "#2a332a");
    if (hover.current && (s === hover.current || t === hover.current)) return withAlpha(accent, 0.75);
    if (hover.current) return withAlpha(line, 0.35);
    return link.kind === "tag" ? withAlpha(accent, 0.14) : line;
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
            return hover.current && (s === hover.current || t === hover.current) ? 1.6 : 0.8;
          }}
          linkDirectionalParticles={(l) => {
            const s = ((l as { source: GraphNode }).source as GraphNode)?.id;
            const t = ((l as { target: GraphNode }).target as GraphNode)?.id;
            return hover.current && (s === hover.current || t === hover.current) ? 2 : 0;
          }}
          linkDirectionalParticleWidth={2}
          linkDirectionalParticleColor={() => cssVar("--accent", "#5CE65C")}
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
