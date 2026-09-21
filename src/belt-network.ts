import type { Cell } from './paths';

export type BeltRequest<T = string> = { cells: Cell[]; items: T; speed: number; phase: number };
export type BeltPortal = { cell: Cell; input: boolean };
export type BeltPlan<T = string> = BeltRequest<T> & { closed: boolean; portals: BeltPortal[] };
export type Footprint = { x: number; y: number; half: number };
export const tileKey = ({ x, y }: { x: number; y: number }) => `${x}:${y}`;

/** Use the actual footprint, including off-grid, even-sized machines. */
export function intersectsMachine(cell: Cell, machines: Footprint[]) {
  return machines.some(p => Math.abs(p.x - cell.x) < p.half + 16 - .01 && Math.abs(p.y - cell.y) < p.half + 16 - .01);
}

const straight = (c: Cell) => c.ix === c.dx && c.iy === c.dy;
const aligned = (a: Cell, b: Cell) => straight(a) && straight(b) && a.dx === b.dx && a.dy === b.dy;

/**
 * Resolve the complete main factory before drawing any belts. A visible run is
 * either a closed circuit or has a chest and an inserter at each
 * end. Only straight, short obstructions can become paired underground belts;
 * a longer obstruction or a bend ends the run at storage instead.
 */
export function planBelts<T>(requests: BeltRequest<T>[], blocked: (cell: Cell) => boolean): BeltPlan<T>[] {
  const occupied = new Set<string>(), plans: BeltPlan<T>[] = [];
  for (const request of requests) {
    let cells = request.cells.map(c => ({ ...c }));
    if (cells.length < 2) continue;
    const loop = tileKey(cells[0]) === tileKey(cells.at(-1)!);
    if (loop) {
      cells.pop();
      cells[0].ix = cells.at(-1)!.dx;
      cells[0].iy = cells.at(-1)!.dy;
    }
    const seen = new Set<string>();
    let solid = cells.map(c => {
      const key = tileKey(c), obstruction = blocked(c) || occupied.has(key) || seen.has(key);
      seen.add(key);
      return obstruction;
    });
    // Put a cut loop's seam inside the obstruction so its visible portion is
    // handled as one open run, with the same storage rules as every other belt.
    if (loop && solid.some(Boolean)) {
      const cut = solid.indexOf(true);
      cells = [...cells.slice(cut), ...cells.slice(0, cut)];
      solid = [...solid.slice(cut), ...solid.slice(0, cut)];
    }
    const portals: BeltPortal[] = [];
    for (let i = 1; i < cells.length - 1; i++) {
      if (!solid[i]) continue;
      const start = i;
      while (i < cells.length && solid[i]) i++;
      // Express undergrounds span at most eight hidden tiles. Both mouths must
      // have a clear, straight approach; never put a mouth on a machine or bend.
      if (i >= cells.length || i - start > 8 || start < 2 || i + 1 >= cells.length) continue;
      const approach = cells.slice(start - 2, i + 2);
      if (solid[start - 1] || solid[start - 2] || solid[i + 1] || approach.some(c => !aligned(cells[start - 1], c))) continue;
      if (portals.some(p => approach.includes(p.cell))) continue;
      for (let j = start; j < i; j++) { cells[j].hidden = true; solid[j] = false; }
      portals.push({ cell: cells[start - 1], input: true }, { cell: cells[i], input: false });
    }
    const commit = (run: Cell[], closed: boolean) => {
      if (!closed) {
        // Three distinct tiles: chest, inserter, pickup/drop-off belt. Keep at least
        // two exposed belt tiles between the two terminals.
        const usable = (part: Cell[]) => part.length === 4 && part.every(c => !c.hidden && aligned(part[0], c) && !portals.some(p => p.cell === c));
        while (run.length >= 8 && !usable(run.slice(0, 4))) run.shift();
        while (run.length >= 8 && !usable(run.slice(-4))) run.pop();
        if (run.length < 8) return;
      }
      const keys = run.filter(c => !c.hidden).map(tileKey);
      if (new Set(keys).size !== keys.length) throw new Error('A belt cannot occupy its own tile twice');
      for (const key of keys) occupied.add(key);
      plans.push({ ...request, cells: run, closed, portals: portals.filter(p => run.includes(p.cell)) });
    };
    if (loop && !solid.some(Boolean)) commit(cells, true);
    else {
      let start = 0;
      for (let i = 0; i <= cells.length; i++) {
        if (i < cells.length && !solid[i]) continue;
        if (i > start) commit(cells.slice(start, i), false);
        start = i + 1;
      }
    }
  }
  return plans;
}
