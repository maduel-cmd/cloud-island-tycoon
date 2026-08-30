import type { GridPos } from "../data/types";
import { keyOf, type GridSystem } from "./GridSystem";

interface Node {
  pos: GridPos;
  g: number;
  h: number;
  f: number;
}

function manhattan(a: GridPos, b: GridPos): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** A* pathfinding on walkable tiles (optional grass for staff) */
export function astar(
  grid: GridSystem,
  start: GridPos,
  goal: GridPos,
  opts?: { allowGrass?: boolean },
): GridPos[] {
  if (!grid.inBounds(start) || !grid.inBounds(goal)) return [];
  const walk = (p: GridPos) =>
    grid.isWalkable(p) || (opts?.allowGrass === true && grid.get(p.x, p.y) === "grass");

  let target = goal;
  if (!walk(goal)) {
    const near = grid.neighbors4(goal).find((n) => walk(n));
    if (!near) return [];
    target = near;
  }
  if (!walk(start)) return [];

  const open = new Map<string, Node>();
  const closed = new Set<string>();
  const parents = new Map<string, string | null>();
  const sk = keyOf(start);
  open.set(sk, {
    pos: start,
    g: 0,
    h: manhattan(start, target),
    f: manhattan(start, target),
  });
  parents.set(sk, null);

  while (open.size > 0) {
    let bestKey = "";
    let best: Node | null = null;
    for (const [k, n] of open) {
      if (!best || n.f < best.f || (n.f === best.f && n.h < best.h)) {
        best = n;
        bestKey = k;
      }
    }
    if (!best) break;
    if (best.pos.x === target.x && best.pos.y === target.y) {
      const out: GridPos[] = [];
      let ck: string | null = bestKey;
      while (ck) {
        const [xs, ys] = ck.split(",");
        out.push({ x: Number(xs), y: Number(ys) });
        ck = parents.get(ck) ?? null;
      }
      return out.reverse();
    }
    open.delete(bestKey);
    closed.add(bestKey);
    for (const n of grid.neighbors4(best.pos)) {
      const nk = keyOf(n);
      if (closed.has(nk) || !walk(n)) continue;
      const g = best.g + 1;
      const prev = open.get(nk);
      if (!prev || g < prev.g) {
        const h = manhattan(n, target);
        open.set(nk, { pos: n, g, h, f: g + h });
        parents.set(nk, bestKey);
      }
    }
  }
  return [];
}

export const findPath = astar;
