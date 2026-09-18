export type Point = [number, number];
export type Cell = { x: number; y: number; dx: number; dy: number; ix: number; iy: number; hidden: boolean };

/** Tile centers for an orthogonal route. Adjacent segments share one corner. */
export function beltCells(points: Point[]): Cell[] {
  const centers: Point[] = [];
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1], [nx, ny] = points[i];
    if ((x !== nx && y !== ny) || (nx - x) % 32 || (ny - y) % 32) throw new Error('Belt routes must follow the 32px tile grid');
    const dx = Math.sign(nx - x), dy = Math.sign(ny - y);
    const steps = (Math.abs(nx - x) + Math.abs(ny - y)) / 32;
    for (let j = 0; j < steps; j++) centers.push([x + j * dx * 32, y + j * dy * 32]);
  }
  if (points.length) centers.push(points[points.length - 1]);
  return centers.map(([x, y], i) => {
    const prev = centers[Math.max(0, i - 1)], next = centers[Math.min(centers.length - 1, i + 1)];
    const dx = Math.sign(next[0] - x) || (i === centers.length - 1 ? Math.sign(x - prev[0]) : 0);
    const dy = Math.sign(next[1] - y) || (i === centers.length - 1 ? Math.sign(y - prev[1]) : 0);
    return { x, y, dx, dy, ix: i ? Math.sign(x - prev[0]) : dx, iy: i ? Math.sign(y - prev[1]) : dy, hidden: false };
  });
}

/** Follow the centerline through a corner, keeping both item lanes separated. */
export function beltPosition(cell: Cell, t: number, lane: number): Point {
  const u = 1 - t;
  const x = cell.x - cell.ix * 16 * u * u + cell.dx * 16 * t * t;
  const y = cell.y - cell.iy * 16 * u * u + cell.dy * 16 * t * t;
  const dx = cell.ix * u + cell.dx * t, dy = cell.iy * u + cell.dy * t;
  const n = Math.hypot(dx, dy) || 1;
  return [x - dy / n * lane, y + dx / n * lane];
}

export function beltRow(c: Cell): number {
  if (c.ix === c.dx && c.iy === c.dy) return c.dx > 0 ? 0 : c.dx < 0 ? 1 : c.dy < 0 ? 2 : 3;
  if (c.ix > 0) return c.dy < 0 ? 4 : 9;
  if (c.ix < 0) return c.dy < 0 ? 6 : 11;
  if (c.iy < 0) return c.dx > 0 ? 5 : 7;
  return c.dx > 0 ? 8 : 10;
}

/** Round railway bends, then resample by distance so every carriage follows the track. */
export function railway(points: Point[], radius = 224, closed = false): Point[] {
  if (closed && points.length > 1 && points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1]) points = points.slice(0, -1);
  if (points.length < (closed ? 3 : 2)) throw new Error('Railways need distinct control points');
  for (let i = 1; i < points.length; i++) if (points[i][0] === points[i-1][0] && points[i][1] === points[i-1][1]) throw new Error('Railways need distinct control points');
  const corner = (i: number) => {
    const a = points[(i-1+points.length)%points.length], b = points[i], c = points[(i+1)%points.length];
    const l1 = Math.hypot(b[0]-a[0],b[1]-a[1]), l2 = Math.hypot(c[0]-b[0],c[1]-b[1]);
    const r = Math.min(radius,l1/2,l2/2);
    const p: Point = [b[0]-(b[0]-a[0])/l1*r,b[1]-(b[1]-a[1])/l1*r];
    const q: Point = [b[0]+(c[0]-b[0])/l2*r,b[1]+(c[1]-b[1])/l2*r];
    return {b,p,q};
  };
  // For a circuit the first control point is a bend too. Start at its exit,
  // then finish by rounding that same bend to get a continuous seam tangent.
  const dense: Point[] = [closed ? corner(0).q : points[0]];
  const line = (p: Point) => {
    const a = dense[dense.length - 1], n = Math.max(1, Math.ceil(Math.hypot(p[0] - a[0], p[1] - a[1]) / 8));
    for (let j = 1; j <= n; j++) dense.push([a[0] + (p[0] - a[0]) * j / n, a[1] + (p[1] - a[1]) * j / n]);
  };
  for (let i = 1; i < (closed ? points.length + 1 : points.length - 1); i++) {
    const {b,p,q} = corner(i % points.length);
    line(p);
    for (let j = 1; j <= 48; j++) { const t = j / 48, u = 1 - t; dense.push([u*u*p[0]+2*u*t*b[0]+t*t*q[0], u*u*p[1]+2*u*t*b[1]+t*t*q[1]]); }
  }
  if (!closed) line(points[points.length - 1]);
  const samples: Point[] = [dense[0]];
  let remaining = 8;
  for (let i = 1; i < dense.length; i++) {
    let a = dense[i - 1]; const b = dense[i];
    let d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    while (d >= remaining) {
      a = [a[0] + (b[0] - a[0]) * remaining / d, a[1] + (b[1] - a[1]) * remaining / d];
      samples.push(a); d -= remaining; remaining = 8;
    }
    remaining -= d;
  }
  if (closed) {
    if (Math.hypot(samples.at(-1)![0]-samples[0][0],samples.at(-1)![1]-samples[0][1])<0.001) samples.pop();
    samples.push([...samples[0]]);
  }
  return samples;
}

export type RailLoop = { points: Point[]; distances: number[]; length: number };

export function createRailLoop(points: Point[], radius = 224): RailLoop {
  const samples = railway(points,radius,true), distances = [0];
  for (let i=1;i<samples.length;i++) distances.push(distances[i-1]+Math.hypot(samples[i][0]-samples[i-1][0],samples[i][1]-samples[i-1][1]));
  return {points:samples,distances,length:distances.at(-1)!};
}

export const wrapDistance = (distance:number,length:number) => ((distance%length)+length)%length;

/** Negative carriage distances and arbitrarily many laps use the same track. */
export function railPosition(loop: RailLoop,distance: number) {
  const d=wrapDistance(distance,loop.length);
  let low=0,high=loop.distances.length-1;
  while(low+1<high) {const mid=(low+high)>>1;if(loop.distances[mid]<=d)low=mid;else high=mid;}
  const p=loop.points[low],q=loop.points[low+1],t=(d-loop.distances[low])/(loop.distances[low+1]-loop.distances[low]);
  return {x:p[0]+(q[0]-p[0])*t,y:p[1]+(q[1]-p[1])*t,angle:Math.atan2(q[1]-p[1],q[0]-p[0])};
}

export function nearestRailDistance(loop: RailLoop,point: Point) {
  let best=Infinity,result=0;
  for(let i=0;i<loop.points.length-1;i++) {
    const a=loop.points[i],b=loop.points[i+1],dx=b[0]-a[0],dy=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy)));
    const distance=Math.hypot(point[0]-a[0]-dx*t,point[1]-a[1]-dy*t);
    if(distance<best) {best=distance;result=loop.distances[i]+t*(loop.distances[i+1]-loop.distances[i]);}
  }
  return result;
}
