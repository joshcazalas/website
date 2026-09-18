import { assetUrl } from './asset-url';
import { Assets, Container, Graphics, Particle, ParticleContainer, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';
import rawCatalog from './asset-catalog.json';
import { beltCells, beltPosition, beltRow, createRailLoop, nearestRailDistance, railPosition, wrapDistance, type RailLoop, type Cell, type Point } from './paths';
import { trainSchedule, trainMotion, type TrainSchedule } from './train-motion';
import type { RailCircuit } from './rail-network';
export type { Point } from './paths';
export type AssetName = keyof typeof rawCatalog;
type Spec = { file: string; w: number; h: number; dx?: number; dy?: number; scale?: number };
const catalog: Record<string, Spec> = rawCatalog;
export type Contact = { label: string; href: string; x: number; y: number; width: number; height: number };
export type View = { left: number; top: number; right: number; bottom: number };
type Animation = { sprite: Sprite; frames: Texture[]; rate: number; phase: number; owner: Container };
type Block = { container: Container; x: number; y: number; w: number; h: number; color?: string };
type Belt = { cells: Cell[]; items: Particle[]; active: boolean; speed: number; phase: number; bounds: View };
type Train = { id:string; cars: Sprite[]; loop: RailLoop; schedule: TrainSchedule; phase: number };
type Machine = 'assembler' | 'furnace' | 'lab' | 'chemical' | 'solar' | 'accumulator' | 'refinery' | 'tank' | 'roboport';
type Packed = { pages: number; assets: Record<string, { scale: number; frames: { page: number; x: number; y: number; w: number; h: number }[] }> };
const visible = (x: number, y: number, v: View, margin = 96) => x > v.left - margin && x < v.right + margin && y > v.top - margin && y < v.bottom + margin;

export class FactoryCore {
  root = new Container();
  contacts: Contact[] = [];
  textures = new Map<string, Texture[]>();
  blocks: Block[] = [];
  machineCount = 0;
  beltCount = 0;
  crossingCount = 0;
  railRoutes: Point[][] = [];
  mapBelts: Point[][] = [];
  protected layers = Array.from({ length: 8 }, () => new Container());
  protected animateConveyors = false;
  private chunks = new Map<string, Block>();
  private animations: Animation[] = [];
  private belts: Belt[] = [];
  private arms: { sprite: Sprite; phase: number; owner: Container; reverse: boolean; angle: number }[] = [];
  private itemBatches = new Map<Texture['source'], ParticleContainer>();
  private trains: Train[] = [];
  private trainSeconds = 0;
  private robots: { sprite: Sprite; start: Point; end: Point; phase: number }[] = [];
  private occupied = new Map<string, Cell>();
  private railTiles = new Set<string>();
  private machineTiles = new Set<string>();
  private footprints: {x:number;y:number;half:number}[] = [];
  private packedScale = new Map<string, number>();
  private lastFrame = -1;
  private beltFrames: Texture[][] = [];

  async load(onProgress: (fraction: number) => void) {
    const response = await fetch(assetUrl('factorio/packed/manifest.json'));
    if (!response.ok) throw new Error('Packed sprites are missing. Run npm run assets:import.');
    const manifest: Packed = await response.json();
    let done = 0;
    const atlases = await Promise.all(Array.from({ length: manifest.pages }, async (_, i) => {
      const texture = await Assets.load<Texture>(assetUrl(`factorio/packed/atlas-${i}.png`));
      texture.source.scaleMode = 'linear'; onProgress(++done / manifest.pages); return texture;
    }));
    for (const [name, spec] of Object.entries(manifest.assets)) {
      this.packedScale.set(name, spec.scale);
      this.textures.set(name, spec.frames.map(f => new Texture({ source: atlases[f.page].source, frame: new Rectangle(f.x, f.y, f.w, f.h) })));
    }
    this.beltFrames = Array.from({ length: 20 }, (_, row) => this.textures.get('belt')!.slice(row * 32, (row + 1) * 32));
    this.root.addChild(...this.layers);
    this.build();
  }

  /** Outposts reuse the loaded atlas frames without loading or duplicating textures. */
  useAssets(source: FactoryCore) {
    this.textures = source.textures;
    this.packedScale = source.packedScale;
    this.beltFrames = source.beltFrames;
    this.root.addChild(...this.layers);
    this.build();
  }

  protected build() {}

  protected group(x: number, y: number, w: number, h: number) {
    const container = new Container(); container.position.set(x, y); this.root.addChild(container);
    this.blocks.push({ container, x, y, w, h, color: '#bdbfa4' }); return container;
  }

  private chunk(layer: number, x: number, y: number) {
    const cx = Math.floor(x / 768) * 768, cy = Math.floor(y / 768) * 768, key = `${layer}:${cx}:${cy}`;
    let block = this.chunks.get(key);
    if (!block) {
      const container = new Container(); this.layers[layer].addChild(container);
      // Belts, track, shadows, and pipework are static scenery. Cache only these
      // spatial chunks; the items, machines, inserters, and trains remain live.
      if((layer===1&&!this.animateConveyors)||layer===3)container.cacheAsTexture({resolution:1});
      block = { container, x: cx, y: cy, w: 768, h: 768 }; this.chunks.set(key, block);
    }
    return block.container;
  }

  protected sprite(parent: Container, name: AssetName, x: number, y: number, animated = false, rate = 12, phase = 0) {
    const spec = catalog[name], frames = this.textures.get(name)!;
    const sprite = new Sprite(frames[Math.floor(phase) % frames.length]);
    sprite.anchor.set(0.5); sprite.position.set(x + (spec.dx ?? 0), y + (spec.dy ?? 0));
    sprite.scale.set((spec.scale ?? 0.5) / this.packedScale.get(name)!);
    if (name.endsWith('Shadow')) sprite.alpha = 0.48;
    parent.addChild(sprite);
    if (animated) this.animations.push({ sprite, frames, rate, phase, owner: parent });
    return sprite;
  }

  protected ground(parent: Container, name: 'grass' | 'dirt' | 'concrete' | 'refined', x: number, y: number, width: number, height: number, tint = 0xffffff) {
    const sprite = new TilingSprite({ texture: this.textures.get(name)![0], width, height });
    sprite.position.set(x, y); sprite.tileScale.set(0.5); sprite.tilePosition.set(-x % 256, -y % 256); sprite.tint = tint;
    parent.addChild(sprite); return sprite;
  }

  terrain() {
    this.ground(this.layers[0], 'grass', -32768, -32768, 65536, 65536, 0xa7ac8e);
    // Overlapping irregular patches make a continuous, worn industrial surface.
    for (const [x, y, w, h] of [[128,0,9280,5664],[800,5312,8320,2048],[32,704,960,4000],[9184,1024,1024,4992]])
      this.ground(this.layers[0], 'dirt', x, y, w, h, 0x9e9e8f);
  }

  pad(x: number, y: number, w: number, h: number, color = '#968c59', concrete = false) {
    const sprite = this.ground(this.layers[0], concrete ? 'concrete' : 'dirt', x - 32, y - 32, w + 64, h + 64, concrete ? 0x9b9d8e : 0xa7a38e);
    this.blocks.push({ container: sprite, x, y, w, h, color });
  }

  entity(name: AssetName, x: number, y: number, layer = 4, animated = false, phase = 0) {
    return this.sprite(this.chunk(layer, x, y), name, x, y, animated, 16, phase);
  }

  machine(type: Machine, x: number, y: number, phase = 0) {
    const half=type==='refinery'?80:type==='roboport'?64:type==='accumulator'?32:48;
    if(this.footprints.some(p=>Math.abs(p.x-x)<p.half+half-4&&Math.abs(p.y-y)<p.half+half-4))return false;
    for(let px=x-half+16;px<x+half;px+=32)for(let py=y-half+16;py<y+half;py+=32)
      if(this.railTiles.has(`${Math.round(px/32)*32}:${Math.round(py/32)*32}`))return false;
    this.footprints.push({x,y,half});
    for(let px=x-half+16;px<x+half;px+=32)for(let py=y-half+16;py<y+half;py+=32)
      this.machineTiles.add(`${Math.round(px/32)*32}:${Math.round(py/32)*32}`);
    this.machineCount++;
    this.entity(`${type}Shadow` as AssetName, x, y, 3);
    if (type === 'lab') this.entity('labBase', x, y, 3);
    this.entity(type, x, y, 4, ['assembler','lab','chemical'].includes(type), phase);
    if (type === 'furnace') { this.entity('heater', x, y, 4, true, phase); this.entity('fan', x, y, 4, true, phase); }
    if (type === 'lab') { const light = this.entity('labLight', x, y, 4, true, phase); light.alpha = 0.35; light.blendMode = 'add'; }
    if (type === 'chemical') this.entity('chemicalLiquid', x, y, 4, true, phase).tint = 0x77cfc0;
    if (type === 'refinery') this.entity('refineryFire', x, y, 4, true, phase);
    if (type === 'roboport') { this.entity('roboportPatch', x, y); this.entity('roboportLight', x, y, 4, true, phase); }
    return true;
  }

  inserter(x: number, y: number, reverse = false, phase = 0, angle = 0) {
    this.entity('inserter', x, y, 4);
    const owner = this.chunk(5, x, y), arm = this.sprite(owner, 'hand', x, y);
    arm.anchor.set(0.5, 0.83); this.arms.push({ sprite: arm, phase, owner, reverse, angle });
  }

  poles(points: Point[]) {
    const wires = new Graphics();
    for (let i = 1; i < points.length; i++) {
      const [x,y] = points[i-1], [nx,ny] = points[i];
      wires.moveTo(x+8,y-76).quadraticCurveTo((x+nx)/2+8,(y+ny)/2-30,nx+8,ny-76);
    }
    wires.stroke({ color: 0x82502f, width: 1.7, alpha: 0.8 }); this.layers[5].addChild(wires);
    for (const [x,y] of points) { this.entity('substationShadow',x,y,3); this.entity('substation',x,y); }
  }

  /** A continuous, two-lane conveyor, with automatic underground crossings. */
  route(points: Point[], items: AssetName | AssetName[], speed = 44, phase = 0) {
    const cells = beltCells(points); if (cells.length < 2) return;
    const caps: { c: Cell; input: boolean }[] = [];
    // Rail crossings are actual gaps in the visible conveyor, not items drifting
    // over the top of a train. Keep the animation continuous below the surface.
    const obstructed=(c:Cell)=>this.railTiles.has(`${c.x}:${c.y}`)||this.machineTiles.has(`${c.x}:${c.y}`);
    for(let i=2;i<cells.length-2;i++) {
      if(!obstructed(cells[i]))continue;
      const start=i;
      while(i<cells.length-2&&obstructed(cells[i]))i++;
      const end=i-1;
      for(let j=start;j<=end;j++)cells[j].hidden=true;
      caps.push({c:cells[start-1],input:true},{c:cells[end+1],input:false});this.crossingCount++;
    }
    for (let i = 3; i < cells.length - 3; i++) {
      const c = cells[i], other = this.occupied.get(`${c.x}:${c.y}`);
      if (!other || c.hidden || other.hidden || (c.dx !== 0) === (other.dx !== 0)) continue;
      if (cells.slice(i-2,i+3).some(a => a.dx !== c.dx || a.dy !== c.dy || a.ix !== c.dx || a.iy !== c.dy || a.hidden)) continue;
      for (let j = i-1; j <= i+1; j++) cells[j].hidden = true;
      caps.push({c:cells[i-2],input:true},{c:cells[i+2],input:false}); this.crossingCount++;
      i += 3;
    }
    for (const c of cells) {
      if (c.hidden) continue;
      const owner = this.chunk(1,c.x,c.y), frames = this.beltFrames[beltRow(c)];
      const sprite = new Sprite(frames[0]); sprite.anchor.set(0.5); sprite.position.set(c.x,c.y); owner.addChild(sprite);
      if(this.animateConveyors)this.animations.push({sprite,frames,rate:32,phase:0,owner});
      this.beltCount++;
      this.occupied.set(`${c.x}:${c.y}`,c);
    }
    for (const {c,input} of caps) {
      const direction = c.dy < 0 ? 0 : c.dx > 0 ? 1 : c.dy > 0 ? 2 : 3;
      const s = this.entity('underground',c.x,c.y,3);
      s.texture = this.textures.get('underground')![(input ? 4 : 0)+direction];
    }
    const variants = Array.isArray(items) ? items : [items];
    const particles: Particle[] = [];
    const count = Math.ceil(cells.length * 32 / 28) * 2;
    for (let i = 0; i < count; i++) {
      const texture = this.textures.get(variants[(i * 7 + Math.floor(i / 3)) % variants.length])![0];
      let batch = this.itemBatches.get(texture.source);
      if(!batch) {
        batch = new ParticleContainer({texture,dynamicProperties:{position:true}});
        batch.boundsArea = new Rectangle(-2048,-2048,16384,12288);
        this.itemBatches.set(texture.source,batch); this.layers[2].addChild(batch);
      }
      const particle = new Particle({texture,anchorX:0.5,anchorY:0.5,scaleX:0.48,scaleY:0.48,x:-100000,y:-100000});
      batch.addParticle(particle); particles.push(particle);
    }
    const xs = cells.map(c=>c.x), ys = cells.map(c=>c.y);
    this.belts.push({cells,items:particles,active:false,speed,phase,bounds:{left:Math.min(...xs),top:Math.min(...ys),right:Math.max(...xs),bottom:Math.max(...ys)}});
    if (cells.length > 22) this.mapBelts.push(points);
  }

  splitter(x: number, y: number, east = false) {
    this.entity(east?'splitterEast':'splitter',x,y,3,true);
    if (east) this.entity('splitterEastTop',x,y,3,true);
  }

  pipe(points: Point[]) {
    for (const c of beltCells(points)) {
      let name: AssetName = c.dx ? 'pipe' : 'pipeV';
      if(c.ix!==c.dx || c.iy!==c.dy) {
        const up = c.iy > 0 || c.dy < 0, right = c.ix < 0 || c.dx > 0;
        name = up ? (right?'pipeUR':'pipeUL') : (right?'pipeDR':'pipeDL');
      }
      this.entity(name,c.x,c.y,3);
    }
  }

  rail(circuit: RailCircuit) {
    const loop=createRailLoop(circuit.points,circuit.radius),samples=loop.points;
    this.railRoutes.push(samples);
    for(const [x,y] of samples)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)this.railTiles.add(`${Math.round(x/32)*32+dx*32}:${Math.round(y/32)*32+dy*32}`);
    // Stamp the whole closed centerline, including the short final seam segment.
    const pieces=Math.ceil(loop.length/16),step=loop.length/pieces;
    for (let i = 0; i < pieces; i++) {
      const {x,y,angle}=railPosition(loop,i*step);
      for (const name of ['railBed','railStone','railTies','railMetal'] as const) {
        const sprite = this.entity(name,x,y,1); sprite.rotation = angle;
      }
    }
    for(const [index,config] of circuit.trains.entries()) {
      const cars: Sprite[] = [];
      for (let i=0;i<config.cars;i++) cars.push(this.sprite(this.layers[6],i?'wagon':'locomotive',0,0));
      const stop=config.stop?nearestRailDistance(loop,config.stop):undefined;
      this.trains.push({id:`${circuit.id}:${index}`,cars,loop,schedule:trainSchedule(loop.length,config.speed,stop,config.dwell),phase:config.phase});
    }
  }

  get trainState() {
    return this.trains.map(train=>{
      const motion=trainMotion(this.trainSeconds,train.schedule,train.phase);
      return {id:train.id,length:train.loop.length,period:train.schedule.period,distance:wrapDistance(motion.distance,train.loop.length),speed:motion.speed,
        cars:train.cars.map((car,i)=>({x:car.x,y:car.y+(i?25:16)}))};
    });
  }

  robotsBetween(start: Point, end: Point, count = 6) {
    for(let i=0;i<count;i++) {
      const sprite = this.sprite(this.layers[7],'robot',0,0);
      this.robots.push({sprite,start,end,phase:i*0.151});
    }
  }

  update(seconds: number, view: View, zoom = 0.4) {
    for (const block of this.chunks.values()) block.container.visible = block.x+block.w+192>view.left&&block.x-192<view.right&&block.y+block.h+192>view.top&&block.y-192<view.bottom;
    // The identity plaza has its own container; other map entries are ground sprites.
    for (const block of this.blocks) if (!(block.container instanceof Sprite)) block.container.visible=block.x+block.w+192>view.left&&block.x-192<view.right&&block.y+block.h+192>view.top&&block.y-192<view.bottom;
    const frame = Math.floor(seconds*24);
    if (frame !== this.lastFrame) {
      this.lastFrame = frame;
      for (const a of this.animations) if (a.owner.visible) a.sprite.texture=a.frames[Math.floor(seconds*a.rate+a.phase)%a.frames.length];
    }
    for (const belt of this.belts) {
      const b=belt.bounds, active=b.right+40>view.left&&b.left-40<view.right&&b.bottom+40>view.top&&b.top-40<view.bottom;
      if(!active) {
        if(belt.active)for(const item of belt.items){item.x=-100000;item.y=-100000;}
        belt.active=false;continue;
      }
      belt.active=true;
      const length=belt.cells.length*32, perLane=belt.items.length/2;
      for(let i=0;i<belt.items.length;i++) {
        const item=belt.items[i], distance=(Math.floor(i/2)*length/perLane+seconds*belt.speed+belt.phase)%length;
        const cell=belt.cells[Math.floor(distance/32)];
        if(cell.hidden||!visible(cell.x,cell.y,view,24)){item.x=-100000;item.y=-100000;continue;}
        const [x,y]=beltPosition(cell,(distance%32)/32,i%2?6:-6); item.x=x;item.y=y;
      }
    }
    if(zoom > 0.13) for(const a of this.arms) {
      if(!a.owner.visible)continue;
      a.sprite.rotation=Math.sin(seconds*3.7+a.phase)*1.35+(a.reverse?Math.PI:0)+a.angle;
      a.sprite.scale.y=0.4+(Math.cos(seconds*3.7+a.phase)+1)*0.05;
    }
    this.trainSeconds=seconds;
    for(const train of this.trains) {
      const {distance}=trainMotion(seconds,train.schedule,train.phase);
      for(let i=0;i<train.cars.length;i++) {
        const car=train.cars[i],{x,y,angle}=railPosition(train.loop,distance-i*196);
        // Only camera culling hides a carriage. It always exists on the loop,
        // including when the locomotive and its wagons straddle the lap seam.
        car.position.set(x,y+(i?-25:-16));
        car.visible=visible(x,y,view,250); if(!car.visible)continue;
        const direction=(Math.round((angle+Math.PI/2)/(Math.PI*2)*32)+32)%32;
        car.texture=this.textures.get(i?'wagon':'locomotive')![i?direction%16:direction];
      }
    }
    for(const robot of this.robots) {
      const t=(seconds/18+robot.phase)%2, f=t<1?t:2-t;
      const x=robot.start[0]+(robot.end[0]-robot.start[0])*f, y=robot.start[1]+(robot.end[1]-robot.start[1])*f;
      robot.sprite.visible=visible(x,y,view)&&zoom>0.15;
      robot.sprite.position.set(x,y-20+Math.sin(seconds*2+robot.phase)*2);
      const angle=Math.atan2((robot.end[1]-robot.start[1])*(t<1?1:-1),(robot.end[0]-robot.start[0])*(t<1?1:-1));
      robot.sprite.texture=this.textures.get('robot')![(Math.round((angle+Math.PI/2)/(Math.PI*2)*16)+16)%16];
    }
  }
}
