import { Container, Graphics, Sprite } from 'pixi.js';
import { FactoryCore, type AssetName, type View } from './factory-core';
import { beltCells, beltPosition, beltRow, type Cell, type Point } from './paths';
import { pixelText, pixelWidth } from './pixel-font';
import { pixelAws } from './pixel-aws';
import { FOUNDATION_SITE } from './outpost-location';
import { buildTime, deploymentPhase, flightProgress, POWER_ON, DEPLOYMENT_DURATION, type BuildStage } from './foundation-deployment';

type Part = { stage: BuildStage; live: Container; ghost: Container; x: number; y: number; at: number; robot?: Sprite; shadow?: Graphics };
type Conveyor = { cells: Cell[]; items: Sprite[]; offset: number };
type Site = {
  root: Container; structures: Container; ghosts: Container; cargo: Container; wires: Container;
  parts: Part[]; belts: Conveyor[]; arms: { sprite: Sprite; phase: number }[];
  grid: Graphics; waiting: Container; lamps: Graphics; powered: boolean;
  animations: { sprite: Sprite; name: AssetName; phase: number }[];
};

/** A repeatable, deliberately small factory composed from one shared blueprint. */
export class FoundationOutpost extends FactoryCore {
  private scene = new Container();
  private flightLayer = new Container();
  private sites: Site[] = [];
  private started: number | null = null;
  private seconds: number | null = null;
  private built = 0;
  private airborne = 0;
  private targetStatus = new Container();
  private lastOnline = false;

  deploy(clock: number, instant = false) {
    this.started = clock - (instant ? DEPLOYMENT_DURATION : 0);
    this.seconds = instant ? DEPLOYMENT_DURATION : 0;
  }

  finish(clock: number) { this.deploy(clock, true); }

  get state() {
    return { phase: deploymentPhase(this.seconds), seconds: this.seconds, built: this.built,
      total: this.sites[1]?.parts.length ?? 0, robots: this.airborne, powered: this.sites[1]?.powered ?? false,
      progress: this.seconds === null ? 0 : Math.min(1, this.seconds / DEPLOYMENT_DURATION) };
  }

  protected build() {
    this.ground(this.layers[0], 'grass', 10752, -32768, 32768, 65536, 0xa7ac8e);
    this.root.addChild(this.scene);
    this.scene.position.set(FOUNDATION_SITE.x, FOUNDATION_SITE.y);
    this.ground(this.scene, 'dirt', -160, 256, 4800, 2272, 0xa0a08e);
    this.ground(this.scene, 'refined', 48, 32, 4384, 288, 0x888c7a);
    const heading = new Graphics().rect(80, 64, 8, 222).fill(0xe1b660);
    this.scene.addChild(heading);
    pixelText(this.scene, 'AWS FOUNDATION', 128, 92, 16, 0xe5ddbb);
    pixelAws(this.scene, 1984, 44, 10);
    const repoLabel = 'GITHUB.COM/JOSHCAZALAS/AWS-FOUNDATION';
    pixelText(this.scene, repoLabel, 132, 240, 6, 0xf1e7be);
    this.contacts.push({ label: 'AWS Foundation on GitHub', href: 'https://github.com/joshcazalas/aws-foundation',
      x: FOUNDATION_SITE.x + 114, y: FOUNDATION_SITE.y + 222, width: pixelWidth(repoLabel, 6) + 36, height: 78 });
    pixelText(this.scene, 'PROJECT / 01', 4000, 116, 4, 0xc8b383);
    pixelText(this.scene, 'REMOTE BUILD SITE', 3868, 232, 4, 0x9da88b);

    pixelText(this.scene, '01 / REFERENCE FOUNDATION', 128, 400, 7, 0xd9d4b5);
    pixelText(this.scene, 'ONLINE', 128, 472, 4, 0xa7c57a);
    pixelText(this.scene, '02 / REPEAT THE BLUEPRINT', 2528, 400, 7, 0xd9d4b5);
    this.targetStatus.position.set(2528, 472);
    this.scene.addChild(this.targetStatus);
    pixelText(this.targetStatus, 'CONSTRUCTION SITE', 0, 0, 4, 0x91bec8);
    this.sites = [this.makeSite(128, true), this.makeSite(2528, false)];

    // A construction depot between the two sites. Bots carry the blueprint east.
    this.ground(this.scene, 'refined', 2048, 1056, 256, 704, 0x8d927d);
    this.sprite(this.scene, 'roboportShadow', 2176, 1200);
    this.sprite(this.scene, 'roboport', 2176, 1200);
    this.sprite(this.scene, 'roboportPatch', 2176, 1200);
    this.sprite(this.scene, 'roboportLight', 2176, 1200, true);
    for (const y of [1376, 1440, 1504, 1568]) for (const x of [2144, 2208]) this.sprite(this.scene, 'chest', x, y);
    pixelText(this.scene, 'BOT', 2176, 1648, 5, 0xd2cfb2, true);
    pixelText(this.scene, 'DEPOT', 2176, 1704, 5, 0xd2cfb2, true);
    const guide = new Graphics();
    for (let x = 1888; x < 2528; x += 64) guide.moveTo(x, 1872).lineTo(x + 26, 1872);
    guide.stroke({ color: 0xa8bb96, width: 3, alpha: 0.45 });
    this.scene.addChild(guide);
    pixelText(this.scene, 'COPY > BUILD > RUN', 2176, 1992, 3.5, 0xd4bb89, true);
    this.scene.addChild(this.flightLayer);

    const target = this.sites[1];
    for (const stage of [0, 1, 2] as const) {
      const parts = target.parts.filter(part => part.stage === stage);
      parts.forEach((part, i) => {
        part.at = buildTime(stage, i, parts.length);
        part.shadow = new Graphics().ellipse(0, 0, 13, 7).fill({ color: 0x111a10, alpha: 0.35 });
        this.flightLayer.addChild(part.shadow);
        part.robot = this.sprite(this.flightLayer, 'robot', 0, 0);
      });
    }
  }

  private part(site: Site, stage: BuildStage, x: number, y: number, draw: (parent: Container) => void) {
    const live = new Container(), ghost = new Container();
    site.structures.addChild(live);
    draw(live);
    if (!site.powered) {
      for (const child of live.children) {
        if (!(child instanceof Sprite) || child.alpha < 0.6) continue;
        const copy = new Sprite(child.texture);
        copy.position.copyFrom(child.position); copy.scale.copyFrom(child.scale); copy.anchor.copyFrom(child.anchor);
        copy.rotation = child.rotation; copy.tint = 0x65cfff; copy.alpha = 0.52;
        ghost.addChild(copy);
      }
      site.ghosts.addChild(ghost);
    }
    site.parts.push({ stage, live, ghost, x, y, at: 0 });
  }

  private belt(site: Site, points: Point[], items: AssetName[], stage: BuildStage) {
    // Close the seam explicitly so both the belt corner and its cargo remain continuous.
    const cells = beltCells(points);
    if (points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1]) {
      cells.pop();
      const a = cells[0], b = cells.at(-1)!;
      a.ix = Math.sign(a.x - b.x); a.iy = Math.sign(a.y - b.y);
    }
    for (let i = 0; i < cells.length; i += 6) {
      const batch = cells.slice(i, i + 6), center = batch[Math.floor(batch.length / 2)];
      this.part(site, stage, center.x, center.y, parent => {
        for (const cell of batch) {
          const sprite = new Sprite(this.textures.get('belt')![beltRow(cell) * 32]);
          sprite.anchor.set(0.5); sprite.position.set(cell.x, cell.y); parent.addChild(sprite);
        }
      });
    }
    const cargo = Array.from({ length: Math.floor(cells.length * 1.2) }, (_, i) => {
      const item = this.sprite(site.cargo, items[i % items.length], 0, 0); item.scale.set(0.48); return item;
    });
    site.belts.push({ cells, items: cargo, offset: site.belts.length * 193 });
  }

  private equipment(site: Site, type: 'assembler' | 'accumulator' | 'roboport' | 'solar' | 'radar' | 'lab', x: number, y: number, stage: BuildStage) {
    const animatedSprite = (parent: Container, name: AssetName) => {
      const sprite = this.sprite(parent, name, x, y);
      site.animations.push({ sprite, name, phase: (x + y) % 31 });
      return sprite;
    };
    this.part(site, stage, x, y, parent => {
      this.sprite(parent, `${type}Shadow` as AssetName, x, y);
      if (type === 'lab') this.sprite(parent, 'labBase', x, y);
      if (['assembler', 'radar', 'lab'].includes(type)) animatedSprite(parent, type);
      else this.sprite(parent, type, x, y);
      if (type === 'roboport') {
        this.sprite(parent, 'roboportPatch', x, y);
        animatedSprite(parent, 'roboportLight');
      }
      if (type === 'lab') animatedSprite(parent, 'labLight').alpha = 0.4;
    });
  }

  private arm(site: Site, x: number, y: number, stage: BuildStage, reverse = false) {
    this.part(site, stage, x, y, parent => {
      this.sprite(parent, 'inserter', x, y);
      const sprite = this.sprite(parent, 'hand', x, y); sprite.anchor.set(0.5, 0.83);
      site.arms.push({ sprite, phase: x * 0.2 + y + (reverse ? Math.PI : 0) });
    });
  }

  private makeSite(x: number, reference: boolean): Site {
    const root = new Container(); root.position.set(x, 544); this.scene.addChild(root);
    const site: Site = { root, structures: new Container(), ghosts: new Container(), cargo: new Container(), wires: new Container(),
      parts: [], belts: [], arms: [], animations: [], grid: new Graphics(), waiting: new Container(), lamps: new Graphics(), powered: reference };
    const pads = [
      { x: 0, y: 0, w: 768, h: 576, title: 'MANAGEMENT', sub: 'POLICY / FOUNDATION STATE' },
      { x: 896, y: 0, w: 768, h: 576, title: 'DEPLOYMENT', sub: 'OIDC / APP STATE' },
      { x: 0, y: 768, w: 768, h: 768, title: 'UAT', sub: 'WORKLOAD ACCOUNT' },
      { x: 896, y: 768, w: 768, h: 768, title: 'PRODUCTION', sub: 'WORKLOAD ACCOUNT' }
    ];
    const borders = new Graphics();
    for (const pad of pads) {
      this.ground(root, 'refined', pad.x - 16, pad.y - 16, pad.w + 32, pad.h + 32, 0x686e5e);
      this.ground(root, 'concrete', pad.x, pad.y, pad.w, pad.h, reference ? 0xa9ac95 : 0x838c7d);
      borders.rect(pad.x + 8, pad.y + 8, pad.w - 16, pad.h - 16).stroke({ color: 0xd9c58a, width: 3, alpha: 0.45 });
      pixelText(root, pad.title, pad.x + 32, pad.y + 30, 5, 0xd8dcc0);
      pixelText(root, pad.sub, pad.x + 32, pad.y + 88, 4, 0xb3ba9a);
      for (let lx = pad.x + 32; lx < pad.x + pad.w - 16; lx += 96) {
        borders.rect(lx, pad.y + pad.h - 14, 36, 5).fill(0x353d2d);
        borders.rect(lx + 36, pad.y + pad.h - 14, 28, 5).fill(0xb8a065);
      }
      if (!reference) {
        for (let gx = pad.x + 16; gx < pad.x + pad.w; gx += 32) site.grid.moveTo(gx, pad.y + 128).lineTo(gx, pad.y + pad.h - 24);
        for (let gy = pad.y + 128; gy < pad.y + pad.h - 24; gy += 32) site.grid.moveTo(pad.x + 16, gy).lineTo(pad.x + pad.w - 16, gy);
      }
    }
    root.addChild(borders);
    site.grid.stroke({ color: 0x77b8d4, width: 1, alpha: 0.32 });
    root.addChild(site.grid, site.ghosts, site.structures, site.cargo, site.wires, site.lamps);

    // Physical belts are closed, local circuits. Separate pads express account boundaries.
    this.belt(site, [[64,160],[704,160],[704,512],[64,512],[64,160]], ['processor','circuit'], 0);
    this.belt(site, [[960,160],[1600,160],[1600,512],[960,512],[960,160]], ['processor','advanced','circuit'], 1);
    for (const ox of [0,896]) {
      this.belt(site, [[ox+64,928],[ox+704,928],[ox+704,1472],[ox+64,1472],[ox+64,928]], ['circuit','advanced','processor'], 2);
      this.belt(site, [[ox+96,1152],[ox+672,1152],[ox+672,1408],[ox+96,1408],[ox+96,1152]], ['redScience','greenScience','blueScience'], 2);
    }

    this.equipment(site, 'radar', 192, 288, 0);
    this.equipment(site, 'roboport', 512, 288, 0);
    for (const ax of [192,288,384,480,576]) this.equipment(site, 'accumulator', ax, 432, 0);
    for (const cy of [240,304]) for (const cx of [320,384]) this.part(site, 0, cx, cy, p => { this.sprite(p, 'chest', cx, cy); });
    this.equipment(site, 'roboport', 1088, 288, 1);
    for (const ax of [1312,1472]) for (const ay of [272,432]) {
      this.equipment(site, 'assembler', ax, ay, 1);
      this.arm(site, ax, ay + 64, 1);
    }
    for (const cy of [416,464]) for (const cx of [1056,1120]) this.part(site, 1, cx, cy, p => { this.sprite(p, 'chest', cx, cy); });
    for (const ox of [0,896]) {
      for (const ax of [192,384,576]) {
        this.equipment(site, 'assembler', ox + ax, 1040, 2);
        this.arm(site, ox + ax, 976, 2);
        this.arm(site, ox + ax, 1104, 2, true);
        this.equipment(site, 'lab', ox + ax, 1280, 2);
        this.arm(site, ox + ax, 1216, 2);
        this.arm(site, ox + ax, 1344, 2, true);
      }
    }
    // Shared power spine remains dark until the entire repeated blueprint is built.
    const power = new Graphics();
    const poles: Point[] = [[800,256],[800,640],[256,640],[1312,640],[800,1184],[800,1632]];
    for (const [i,j] of [[0,1],[1,2],[1,3],[1,4],[4,5]]) {
      const [px,py]=poles[i], [qx,qy]=poles[j];
      power.moveTo(px+8,py-76).quadraticCurveTo((px+qx)/2+8,(py+qy)/2-24,qx+8,qy-76);
    }
    power.stroke({ color: 0xbe874a, width: 3, alpha: 0.85 }); site.wires.addChild(power);
    for (const [px,py] of poles) this.part(site, 1, px, py, p => {
      this.sprite(p, 'substationShadow', px, py); this.sprite(p, 'substation', px, py);
    });
    const powerFloor = this.ground(root, 'refined', 0, 1648, 1664, 256, 0x747b65);
    root.setChildIndex(powerFloor, 0);
    pixelText(root, 'POWER / SHARED SERVICES', 32, 1670, 3.5, 0xb1bc94);
    for (const px of [128,256,384,512,640,768]) this.equipment(site, 'solar', px, 1792, 0);
    for (const px of [992,1088,1184,1280,1376,1472]) this.equipment(site, 'accumulator', px, 1792, 0);
    for (const [px,py] of [[32,576],[1632,576],[32,1536],[1632,1536]]) {
      this.part(site, 1, px, py, p => { this.sprite(p, 'lamp', px, py); });
      site.lamps.circle(px, py, 40).fill({ color: 0xe1cf7c, alpha: 0.09 });
      site.lamps.circle(px, py, 8).fill({ color: 0xf1e0a0, alpha: 0.4 });
    }
    root.addChild(site.waiting);
    if (!reference) {
      site.waiting.addChild(new Graphics().rect(300, 622, 1064, 100).fill({ color: 0x27362e, alpha: 0.88 }));
      pixelText(site.waiting, 'AWAITING BLUEPRINT', 832, 652, 5, 0x9dc9d3, true);
    }
    return site;
  }

  update(clock: number, view: View, zoom = 0.4) {
    this.seconds = this.started === null ? null : Math.max(0, clock - this.started);
    const t = this.seconds;
    const onScreen = view.right > FOUNDATION_SITE.x - 192 && view.left < FOUNDATION_SITE.x + FOUNDATION_SITE.width + 192 &&
      view.bottom > FOUNDATION_SITE.y - 192 && view.top < FOUNDATION_SITE.y + FOUNDATION_SITE.height + 192;
    this.root.visible = view.right > 10752;
    this.scene.visible = onScreen;
    this.built = 0; this.airborne = 0;
    for (const [index, site] of this.sites.entries()) {
      const reference = index === 0;
      site.powered = reference || t !== null && t >= POWER_ON;
      site.grid.visible = !reference && t !== null && t < POWER_ON;
      site.waiting.visible = t === null;
      site.wires.visible = site.powered; site.cargo.visible = site.powered; site.lamps.visible = site.powered;
      for (const part of site.parts) {
        const built = reference || t !== null && t >= part.at;
        part.live.visible = built;
        part.ghost.visible = !built && t !== null;
        if (!reference && built) this.built++;
        if (part.robot && part.shadow) {
          const duration = 1.35 + (part.x % 160) / 640;
          const flight = flightProgress(t ?? -100, part.at, duration);
          part.robot.visible = part.shadow.visible = flight.visible;
          if (flight.visible) {
            this.airborne++;
            const sx = 2176, sy = 1200, ex = 2528 + part.x, ey = 544 + part.y;
            const f = flight.fraction, x = sx + (ex - sx) * f, y = sy + (ey - sy) * f;
            part.shadow.position.set(x + 12, y + 16);
            part.robot.position.set(x, y - 22 - Math.sin(f * Math.PI) * 50);
            const angle = Math.atan2(ey - sy, ex - sx) + (flight.returning ? Math.PI : 0);
            part.robot.texture = this.textures.get('robot')![(Math.round((angle + Math.PI/2) / (Math.PI*2) * 16) + 16) % 16];
          }
        }
      }
      if (!onScreen) continue;
      for (const a of site.animations) {
        const frames = this.textures.get(a.name)!;
        a.sprite.texture = frames[site.powered ? Math.floor(clock * 12 + a.phase) % frames.length : 0];
        if (a.name === 'labLight' || a.name === 'roboportLight') a.sprite.visible = site.powered;
      }
      if (!site.powered) continue;
      for (const belt of site.belts) {
        const length = belt.cells.length * 32;
        for (const [i, item] of belt.items.entries()) {
          const distance = (i / belt.items.length * length + clock * 72 + belt.offset) % length;
          const [x,y] = beltPosition(belt.cells[Math.floor(distance / 32)], distance % 32 / 32, i % 2 ? 6 : -6);
          item.position.set(x, y);
        }
      }
      for (const arm of site.arms) arm.sprite.rotation = Math.sin(clock * 3.7 + arm.phase) * 1.3;
    }
    const online = t !== null && t >= DEPLOYMENT_DURATION;
    if (online !== this.lastOnline) {
      this.lastOnline = online;
      for (const child of this.targetStatus.removeChildren()) child.destroy();
      pixelText(this.targetStatus, online ? 'ONLINE / SAME BLUEPRINT' : 'CONSTRUCTION SITE', 0, 0, 4, online ? 0xa7c57a : 0x91bec8);
    }
    if (onScreen) super.update(clock, view, zoom);
  }
}
