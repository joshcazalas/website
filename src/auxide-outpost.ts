import { Container, Graphics, Sprite } from 'pixi.js';
import { FactoryCore, type View } from './factory-core';
import { pixelText, pixelWidth } from './pixel-font';
import { pixelFerris } from './pixel-ferris';
import { AUXIDE_SITE } from './outpost-location';
import { SERVERS, TRACKS, type PlaybackSnapshot } from './auxide-playback';

const LINE_X = 992, LINE_Y = 576, LINE_GAP = 672, LINE_WIDTH = 3296;
const translatedView = (v: View, x: number, y: number): View => ({ left: v.left-x, right: v.right-x, top: v.top-y, bottom: v.bottom-y });

class MusicLine extends FactoryCore {
  private lamps: { sprite: Sprite; column: number; row: number }[] = [];
  private needle = new Graphics();
  private selection = new Graphics();
  private activity = new Graphics();
  private glow = new Graphics();
  private title = new Container();
  private lastTitle = '';
  private frozenAt = 0;
  private currentTrack = -1;

  constructor(private server: number) { super(); }

  protected build() {
    const { name, color } = SERVERS[this.server];
    this.pad(0, 0, LINE_WIDTH, 576, '#758879', true);
    const trim = new Graphics().rect(8, 8, LINE_WIDTH-16, 560).stroke({ color, width: 3, alpha: 0.45 });
    trim.rect(16, 20, 8, 92).fill(color);
    this.layers[0].addChild(trim);
    pixelText(this.root, `0${this.server+1} / ${name.toUpperCase()}`, 48, 24, 6, color);
    pixelText(this.root, 'QUEUE', 64, 126, 4, 0xb8c5ac);
    pixelText(this.root, 'GUILD ACTOR', 960, 126, 4, 0xb8c5ac);
    pixelText(this.root, 'VOICE WORKER', 1464, 126, 4, 0xb8c5ac);
    pixelText(this.root, 'PROGRAMMABLE SPEAKERS', 2112, 126, 4, 0xcbd2ba);
    this.title.position.set(2112, 32); this.root.addChild(this.title);

    this.route([[64,192],[768,192],[768,512],[64,512],[64,192]], ['circuit','advanced','processor'], 48);
    for (const x of [192,352,512,672]) {
      for (const y of [288,416]) this.entity('chest', x, y);
      this.inserter(x, 240); this.inserter(x, 464, true, x);
      this.entity('constantShadow', x, 352, 3);
      this.entity('constant', x, 352);
    }
    this.machine('assembler', 1120, 352);
    for (const x of [976,1264]) for (const y of [256,352,448]) {
      this.entity('arithmeticShadow', x, y, 3); this.entity('arithmetic', x, y);
    }
    this.route([[912,192],[1328,192],[1328,512],[912,512],[912,192]], ['processor','advanced'], 64);
    this.machine('roboport', 1632, 336);
    for (const x of [1504,1632,1760]) {
      this.entity('constantShadow', x, 464, 3); this.entity('constant', x, 464);
    }
    this.route([[1472,192],[1792,192],[1792,512],[1472,512],[1472,192]], ['blueScience','greenScience'], 80);

    const stage = new Graphics().rect(2048, 192, 992, 328).fill(0x252e29);
    stage.rect(2048, 192, 992, 328).stroke({ color: 0x6f7d65, width: 4 });
    this.layers[0].addChild(stage);
    for (let col = 0; col < 16; col++) {
      this.entity('constantShadow', 2112 + col*56, 544, 3);
      this.entity('constant', 2112 + col*56, 544);
      for (let row = 0; row < 5; row++) {
        const x = 2112 + col*56, y = 448 - row*48;
        this.entity('lampShadow', x, y, 3);
        this.entity('lamp', x, y).tint = 0x58665d;
        const sprite = this.entity('lampLight', x, y, 5);
        sprite.tint = color; sprite.alpha = 0.08;
        this.lamps.push({ sprite, column: col, row });
      }
    }
    this.layers[5].addChildAt(this.glow, 0);
    for (const x of [1968,3152]) for (const y of [288,416,544]) {
      this.entity('speakerShadow', x, y, 3); this.entity('speaker', x, y);
    }
    const wire = new Graphics();
    const points = [[768,352],[864,320],[1120,320],[1392,320],[1632,320],[1888,352],[1968,288],[2112,544],[2952,544],[3152,288]];
    for (let i=1;i<points.length;i++) {
      const [x,y]=points[i-1], [nx,ny]=points[i];
      wire.moveTo(x,y).quadraticCurveTo((x+nx)/2, (y+ny)/2+32, nx,ny);
    }
    wire.stroke({ color: 0x9c633f, width: 2.5, alpha: 0.9 });
    this.layers[5].addChild(wire);
    this.poles([[848,448],[1392,448],[1888,448],[3216,448]]);
    this.needle.rect(0,0,44,280).fill({ color, alpha: 0.07 });
    this.needle.rect(0,274,44,5).fill({ color, alpha: 0.85 });
    this.layers[5].addChild(this.needle);
    this.selection.rect(-12,-12,LINE_WIDTH+24,600).stroke({ color, width: 5, alpha: 0.75 });
    this.root.addChild(this.selection, this.activity);
  }

  render(snapshot: PlaybackSnapshot, view: View, zoom: number, selected: boolean) {
    // Each entire line, including belts and inserters, uses its own playback clock.
    super.update(snapshot.total, view, zoom);
    this.selection.visible = selected;
    const text = `${snapshot.playing ? 'PLAYING' : 'PAUSED'} / ${snapshot.title.toUpperCase()}`;
    if (text !== this.lastTitle) {
      this.lastTitle = text;
      for (const child of this.title.removeChildren()) child.destroy();
      pixelText(this.title, text, 0, 0, 4, snapshot.playing ? SERVERS[this.server].color : 0x89957d);
    }
    if (this.currentTrack !== snapshot.track) { this.currentTrack = snapshot.track; this.frozenAt = snapshot.total; }
    this.glow.clear();
    for (const lamp of this.lamps) {
      const note = TRACKS[snapshot.track].melody[lamp.column];
      const age = (snapshot.step - lamp.column + 16) % 16 + snapshot.fraction;
      const on = note >= 0 && lamp.row <= Math.min(4, note);
      const brightness = Math.max(0, 1 - age / 4);
      lamp.sprite.alpha = on ? 0.22 + brightness * 0.78 : 0;
      if (on && brightness > 0.1) this.glow.circle(lamp.sprite.x,lamp.sprite.y,30).fill({ color: SERVERS[this.server].color, alpha: brightness*0.15 });
    }
    this.needle.position.set(2090 + snapshot.step*56, 228);
    this.activity.clear();
    const phase = snapshot.fraction, color = SERVERS[this.server].color;
    // Small signal pulses travel from the queue owner toward its voice worker.
    for (const start of [824,1344,1824]) {
      this.activity.circle(start + phase*72, 352, 6).fill({ color, alpha: 0.8 - phase*0.5 });
    }
    // A soft halo makes a track change visible without flashing the whole stage.
    const age = snapshot.total - this.frozenAt;
    if (age < 0.8) this.activity.rect(2048,192,992,328).stroke({ color, width: 3, alpha: (1-age/0.8)*0.5 });
  }
}

export class AuxideOutpost extends FactoryCore {
  private scene = new Container();
  private lines: MusicLine[] = [];

  protected build() {
    for (const layer of this.layers) layer.position.set(AUXIDE_SITE.x, AUXIDE_SITE.y);
    this.scene.position.set(AUXIDE_SITE.x, AUXIDE_SITE.y);
    this.root.addChild(this.scene);
    this.ground(this.layers[0], 'dirt', -160, 304, 4800, 2384, 0x999f8c);
    this.ground(this.layers[0], 'refined', 48, 32, 4384, 320, 0x747e70);
    this.scene.addChild(new Graphics().rect(80,64,8,256).fill(0x83c7bd));
    pixelText(this.scene, 'AUXIDE', 128, 88, 26, 0xe3e4c7);
    pixelFerris(this.scene, 1984, 42, 10);
    const repoLabel = 'GITHUB.COM/JOSHCAZALAS/AUXIDE';
    pixelText(this.scene, repoLabel, 136, 294, 6, 0xf1e7be);
    this.contacts.push({ label: 'Auxide on GitHub', href: 'https://github.com/joshcazalas/auxide',
      x: AUXIDE_SITE.x + 118, y: AUXIDE_SITE.y + 276, width: pixelWidth(repoLabel, 6) + 36, height: 78 });
    pixelText(this.scene, 'PROJECT / 02', 3940, 104, 4, 0xafc9b2);
    pixelText(this.scene, 'RUST / TOKIO / SONGBIRD', 3584, 290, 4, 0xa0b89f);
    pixelText(this.scene, 'SOURCE ADAPTER', 128, 452, 6, 0xd6d3b4);
    pixelText(this.scene, 'DISCORD SERVERS', 992, 452, 6, 0xbac9ae);

    this.pad(128,576,640,1920,'#7c967b',true);
    pixelText(this.scene, 'RESOLVE', 192, 624, 5, 0xcbd2b4);
    pixelText(this.scene, 'JUST IN TIME', 192, 684, 3.5, 0x9fab91);
    this.entity('radarShadow', 320, 864, 3, true);
    this.entity('radar', 320, 864, 4, true);
    this.machine('assembler', 576, 864);
    for (const y of [1024,1152]) for (const x of [256,384,512,640]) {
      this.entity('constantShadow',x,y,3); this.entity('constant',x,y);
    }
    this.route([[192,768],[704,768],[704,1248],[192,1248],[192,768]], ['circuit','advanced','processor'], 50);
    pixelText(this.scene, 'BOUNDED I/O', 192, 1360, 4.5, 0xcbd2b4);
    for (const y of [1536,1728]) for (const x of [288,544]) {
      this.machine('assembler',x,y);
      this.inserter(x,y-64); this.inserter(x,y+64,true,y);
    }
    this.route([[192,1440],[672,1440],[672,1856],[192,1856],[192,1440]], ['processor','blueScience'], 42);
    pixelText(this.scene, 'OPERATIONS', 192, 1968, 4.5, 0xcbd2b4);
    for (const x of [256,416,576]) {
      this.machine('accumulator',x,2128); this.machine('solar',x,2320);
    }
    pixelText(this.scene, 'LOGS / HEALTH / METRICS', 168, 2448, 3.5, 0xa9bc99);
    this.poles([[832,800],[832,1472],[832,2144],[832,2592],[1920,2592],[3008,2592],[4256,2592]]);
    for (let i=0;i<3;i++) {
      const y = LINE_Y + i*LINE_GAP;
      const branch = new Graphics().moveTo(752,832+i*224).lineTo(880+i*24,832+i*224).lineTo(880+i*24,y+320).lineTo(992,y+320)
        .stroke({ color: SERVERS[i].color, width: 3, alpha: 0.5 });
      this.scene.addChild(branch);
      const line = new MusicLine(i); line.useAssets(this);
      line.root.position.set(LINE_X,y); this.scene.addChild(line.root); this.lines.push(line);
    }
  }

  render(clock: number, view: View, zoom: number, snapshots: PlaybackSnapshot[], selected: number) {
    const local = translatedView(view,AUXIDE_SITE.x,AUXIDE_SITE.y);
    this.root.visible = local.right > -192 && local.left < AUXIDE_SITE.width+192 && local.bottom > -192 && local.top < AUXIDE_SITE.height+192;
    if (!this.root.visible) return;
    super.update(clock,local,zoom);
    for (const [i,line] of this.lines.entries()) line.render(snapshots[i],translatedView(local,LINE_X,LINE_Y+i*LINE_GAP),zoom,selected===i);
  }
}
