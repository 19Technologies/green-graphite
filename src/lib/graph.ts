// Graph data for the force layout: notes, tags and unresolved ("ghost") links.
import { Note, titleOf } from "./vault";
import { VaultIndex } from "./links";

export type NodeKind = "note" | "tag" | "ghost";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  degree: number;
  noteId?: string;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  kind: "link" | "tag";
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
  neighbours: Map<string, Set<string>>;
}

interface Options {
  tags: boolean;
  orphans: boolean;
  ghosts: boolean;
  /** Only include nodes within `depth` hops of this note. */
  focus?: string;
  depth?: number;
}

const cache = new Map<string, GraphData>();
const positions = new Map<string, { x: number; y: number }>();

const endId = (end: string | GraphNode) => (typeof end === "string" ? end : end.id);

/**
 * Returns the same object for the same graph shape, so typing in a note
 * doesn't restart the physics simulation.
 */
export function buildGraph(notes: Record<string, Note>, index: VaultIndex, opts: Options): GraphData {
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const add = (node: GraphNode) => nodes.get(node.id) ?? (nodes.set(node.id, node), node);

  for (const n of Object.values(notes)) {
    add({ id: n.id, label: titleOf(n.path), kind: "note", degree: 0, noteId: n.id });
  }
  const seen = new Set<string>();
  for (const n of Object.values(notes)) {
    for (const ref of index.outgoing.get(n.id) ?? []) {
      let target: string;
      if (ref.note) target = ref.note.id;
      else if (opts.ghosts) {
        target = `ghost:${ref.target.toLowerCase()}`;
        add({ id: target, label: ref.target, kind: "ghost", degree: 0 });
      } else continue;
      if (target === n.id) continue;
      const key = [n.id, target].sort().join("→");
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ source: n.id, target, kind: "link" });
    }
    if (opts.tags) {
      for (const tag of index.noteTags.get(n.id) ?? []) {
        const id = `tag:${tag}`;
        add({ id, label: `#${tag}`, kind: "tag", degree: 0 });
        links.push({ source: n.id, target: id, kind: "tag" });
      }
    }
  }

  const neighbours = new Map<string, Set<string>>();
  for (const l of links) {
    const s = endId(l.source);
    const t = endId(l.target);
    nodes.get(s)!.degree++;
    nodes.get(t)!.degree++;
    if (!neighbours.has(s)) neighbours.set(s, new Set());
    if (!neighbours.has(t)) neighbours.set(t, new Set());
    neighbours.get(s)!.add(t);
    neighbours.get(t)!.add(s);
  }

  let keep = [...nodes.values()];
  if (opts.focus && nodes.has(opts.focus)) {
    const within = new Set([opts.focus]);
    let frontier = [opts.focus];
    for (let d = 0; d < (opts.depth ?? 1); d++) {
      frontier = frontier.flatMap((id) => [...(neighbours.get(id) ?? [])].filter((x) => !within.has(x)));
      frontier.forEach((x) => within.add(x));
    }
    keep = keep.filter((n) => within.has(n.id));
  } else if (!opts.orphans) {
    keep = keep.filter((n) => n.degree > 0);
  }
  const kept = new Set(keep.map((n) => n.id));
  const keptLinks = links.filter((l) => kept.has(endId(l.source)) && kept.has(endId(l.target)));

  const sig =
    JSON.stringify(opts) +
    keep.map((n) => n.id + n.label + n.degree).join("|") +
    keptLinks.map((l) => endId(l.source) + ">" + endId(l.target)).join("|");
  const hit = cache.get(sig);
  if (hit) return hit;

  // Carry positions over from the previous layout so the graph doesn't jump.
  for (const n of keep) {
    const p = positions.get(n.id);
    if (p) Object.assign(n, p);
  }
  const data: GraphData = { nodes: keep, links: keptLinks, neighbours };
  if (cache.size > 20) cache.clear();
  cache.set(sig, data);
  return data;
}

/** Called by the canvas when the simulation settles. */
export function rememberPositions(nodes: GraphNode[]) {
  for (const n of nodes) if (n.x !== undefined && n.y !== undefined) positions.set(n.id, { x: n.x, y: n.y });
}
