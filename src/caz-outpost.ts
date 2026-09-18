import { Container, Graphics, type Sprite } from 'pixi.js';
import { FactoryCore, type View, type AssetName, type Point } from './factory-core';
import { pixelText } from './pixel-font';
import { pixelNix } from './pixel-nix';
import { CAZ_SITE } from './outpost-location';
import { generation, type ReleaseSnapshot } from './caz-release';

const localView = (v: View,x: number,y: number): View => ({left:v.left-x,right:v.right-x,top:v.top-y,bottom:v.bottom-y});
const BLUE=0x9acbe4, IVORY=0xe0e0c5, GREEN=0xadcd8b, RED=0xe49a78;
const SERVICES = [
  {name:'NETWORK + ACCESS',detail:'ADGUARD HOME / WIREGUARD',x:1024,y:640,w:832,color:0x96c8da,kind:'network'},
  {name:'OBSERVABILITY',detail:'PROMETHEUS / GRAFANA / ALERTMANAGER',x:3328,y:640,w:960,color:0xd5bd83,kind:'monitoring'},
  {name:'FILES + STORAGE',detail:'SAMBA / SHARED MEDIA',x:1024,y:1504,w:832,color:0xc3bd92,kind:'storage'},
  {name:'MEDIA',detail:'JELLYFIN / PERSONAL LIBRARY',x:3328,y:1504,w:960,color:0x95c8ab,kind:'media'},
  {name:'HOME AUTOMATION',detail:'HOME ASSISTANT',x:1024,y:2368,w:832,color:0x9db3dd,kind:'automation'},
  {name:'COMMUNITY',detail:'MINECRAFT / BLUEMAP / AUXIDE',x:3328,y:2368,w:960,color:0xd3a980,kind:'community'}
] as const;

class ServiceIsland extends FactoryCore {
  private glow = new Graphics();
  private lamp!: Sprite;
  constructor(readonly spec: typeof SERVICES[number]) { super(); }
  protected build() {
    const {w,color,name,detail,kind}=this.spec;
    this.pad(0,0,w,576,'#839382',true);
    this.layers[0].addChild(new Graphics().rect(8,8,w-16,560).stroke({color,width:3,alpha:.4}).rect(20,24,6,76).fill(color));
    pixelText(this.root,name,48,30,5.5,IVORY);
    pixelText(this.root,detail,48,96,3.2,color);
    for(let i=0;i<4;i++) {
      const x=128+i*(w===832?176:208);
      if(kind==='storage') {
        for(const y of [240,320,400]) for(const dx of [-24,24]) this.entity('chest',x+dx,y);
        this.machine('accumulator',x,480);
      } else if(kind==='monitoring') {
        this.machine('lab',x,288,i*7);
        this.entity('radarShadow',x,464,3); this.entity('radar',x,464,4,true,i*5);
      } else if(kind==='network') {
        this.machine('assembler',x,288,i*4);
        for(const y of [400,464]) { this.entity('arithmeticShadow',x,y,3); this.entity('arithmetic',x,y); }
      } else if(kind==='automation') {
        this.machine('assembler',x,288,i*9);
        for(const dx of [-40,40]) {
          this.entity('constantShadow',x+dx,432,3); this.entity('constant',x+dx,432);
          this.entity('lampShadow',x+dx,496,3); this.entity('lamp',x+dx,496);
        }
      } else if(kind==='media') {
        this.machine('furnace',x,304,i*7);
        this.machine('assembler',x,448,i*11);
      } else {
        if(i<2) this.machine('assembler',x,288,i*8); else this.machine('roboport',x,304);
        for(const dx of [-32,32]) {
          this.entity(i<2?'chest':'speakerShadow',x+dx,464,i<2?4:3);
          if(i>=2)this.entity('speaker',x+dx,464);
        }
      }
      this.inserter(x,208,false,i);
      this.inserter(x,528,true,i+4);
    }
    this.route([[32,160],[w-32,160],[w-32,544],[32,544],[32,160]],kind==='storage'?['iron','gear']:kind==='community'?['greenScience','circuit','blueScience']:['circuit','advanced','processor'],56);
    this.route([[64,352],[w-64,352],[w-64,576],[64,576],[64,352]],['copper','circuit'],44,96);
    this.poles([[w/2,192],[w/2,512]]);
    this.entity('lamp',w-40,64);
    this.lamp=this.entity('lampLight',w-40,64,5);this.lamp.tint=color;
    this.root.addChild(this.glow);
  }
  render(clock: number,view: View,zoom: number,unhealthy: boolean) {
    this.root.visible=view.right>-128&&view.left<this.spec.w+128&&view.bottom>-128&&view.top<704;
    if(!this.root.visible)return;
    super.update(clock,view,zoom);
    this.lamp.tint=unhealthy?RED:this.spec.color;
    this.glow.clear();
    if(unhealthy)this.glow.rect(4,4,this.spec.w-8,568).stroke({color:RED,width:7,alpha:.7});
  }
}

export class CazOutpost extends FactoryCore {
  private scene=new Container();
  private overlay=new Graphics();
  private captions=new Container();
  private islands:ServiceIsland[]=[];
  private lastCaption='';
  private banks: {x:number;y:number}[]=[];

  protected build() {
    for(const layer of this.layers)layer.position.set(CAZ_SITE.x,CAZ_SITE.y);
    this.scene.position.set(CAZ_SITE.x,CAZ_SITE.y); this.root.addChild(this.scene);
    this.ground(this.layers[0],'dirt',-128,384,4736,2656,0x979d8c);
    this.ground(this.layers[0],'refined',48,32,4384,320,0x747e70);
    this.scene.addChild(new Graphics().rect(80,64,8,256).fill(BLUE));
    pixelText(this.scene,'CAZ.NIX',128,88,26,IVORY);
    pixelNix(this.scene,1984,42,6.5);
    pixelText(this.scene,'ONE CONFIGURATION. A WHOLE HOME.',136,294,5,0xc0cdb0);
    pixelText(this.scene,'PROJECT / 03',3940,104,4,0xafc9b2);
    pixelText(this.scene,'NIXOS / HOME MANAGER / LINUX',3488,290,4,0xa0b89f);
    pixelText(this.scene,'PINNED INPUTS',128,454,6,BLUE);
    pixelText(this.scene,'A HOME SERVER, EXPRESSED AS CODE.',2688,454,6,IVORY,true);

    // The flake branches into a server closure and an independent WSL home.
    this.pad(128,640,608,1280,'#7e9193',true);
    for(const [i,label] of ['FLAKE.LOCK','MODULES','BUILD OUTPUTS'].entries()) {
      const y=688+i*384;
      pixelText(this.scene,label,176,y,5,BLUE);
      for(const x of [256,448,640]) {
        this.machine('assembler',x,y+176,i*7);
        this.inserter(x,y+96,false,i);this.inserter(x,y+256,true,i);
      }
      this.route([[160,y+64],[704,y+64],[704,y+288],[160,y+288],[160,y+64]],['circuit','processor','advanced'],48);
    }
    this.pad(128,2112,608,384,'#7e9193',true);
    pixelText(this.scene,'WSL / HOME MANAGER',168,2148,4,IVORY);
    pixelText(this.scene,'SEPARATE OUTPUT',176,2432,3.5,BLUE);
    for(const x of [288,576])this.machine('assembler',x,2320);
    this.route([[192,2240],[672,2240],[672,2400],[192,2400],[192,2240]],['gear','circuit'],48);
    this.route([[768,1696],[864,1696],[864,2272],[736,2272]],'processor',60);
    this.pad(128,2688,608,224,'#809782',true);
    pixelText(this.scene,'LOCAL APP ARCHIVES',160,2712,4,GREEN);
    for(const x of [224,320,416,512,608])for(const y of [2800,2864])this.entity('chest',x,y);

    // Two physical generation bays stay in place when the active profile changes.
    this.pad(2176,640,864,544,'#779296',true);
    pixelText(this.scene,'SYSTEM GENERATIONS',2232,670,5,BLUE);
    for(let i=0;i<2;i++) {
      const x=2224+i*432,y=784;this.banks.push({x,y});
      this.layers[0].addChild(new Graphics().rect(x,y,352,320).fill({color:0x243531,alpha:.48}));
      for(const bx of [x+80,x+256]) {
        this.machine('assembler',bx,y+160,i*10);this.inserter(bx,y+96);this.inserter(bx,y+232,true);
        this.entity('constantShadow',bx,y+288,3);this.entity('constant',bx,y+288);
      }
    }
    this.route([[2208,736],[3008,736],[3008,1152],[2208,1152],[2208,736]],['processor','advanced'],64);

    this.pad(2176,1440,864,640,'#78939a',true);
    pixelText(this.scene,'NIXOS / HOMESERVER',2608,1472,5.5,IVORY,true);
    pixelNix(this.scene,2416,1576,8);
    pixelText(this.scene,'DECLARATIVE SYSTEM',2608,2010,4,BLUE,true);
    for(const x of [2272,2944])for(const y of [1632,1888])this.machine('roboport',x,y);
    this.route([[2208,1536],[3008,1536],[3008,1984],[2208,1984],[2208,1536]],['processor','blueScience'],80);
    this.poles([[2128,1456],[3104,1456],[3104,2064],[2128,2064]]);

    this.pad(2176,2432,864,480,'#8b9b7e',true);
    pixelText(this.scene,'SERVICE HEALTH GATE',2224,2464,5,GREEN);
    for(let i=0;i<5;i++) {
      const x=2272+i*160;
      this.machine('lab',x,2672,i*6);
      this.entity('constantShadow',x,2832,3);this.entity('constant',x,2832);
    }
    this.route([[2208,2560],[3008,2560],[3008,2880],[2208,2880],[2208,2560]],['greenScience','blueScience'],60);

    for(const spec of SERVICES) {
      const island=new ServiceIsland(spec);island.useAssets(this);
      island.root.position.set(spec.x,spec.y);this.scene.addChild(island.root);this.islands.push(island);
    }

    // Parallel supply/return corridors weave the diagram together. Crossings use
    // the same underground belt entrances as the main factory.
    const paths: {points:Point[];items:AssetName[]}[] = [
      {points:[[768,832],[864,832],[864,544],[3104,544],[3104,1312],[1952,1312],[1952,1888],[864,1888],[864,832]],items:['processor','circuit']},
      {points:[[800,1152],[928,1152],[928,1376],[3168,1376],[3168,2304],[2016,2304],[2016,1248],[800,1248],[800,1152]],items:['advanced','processor']},
      {points:[[896,2816],[960,2816],[960,2208],[3232,2208],[3232,608],[4320,608],[4320,3008],[896,3008],[896,2816]],items:['iron','copper','circuit']},
      {points:[[2080,1184],[2080,2144],[3072,2144],[3072,1248],[2080,1248]],items:['processor','blueScience']},
      {points:[[2112,2336],[3136,2336],[3136,2976],[2112,2976],[2112,2336]],items:['greenScience','blueScience']}
    ];
    paths.forEach((p,i)=>this.route(p.points,p.items,62+i*7,i*113));
    for(let row=0;row<3;row++) {
      const y=640+row*864;
      this.route([[1888,y+160],[1952+row*64,y+160],[1952+row*64,1408+row*32],[2144,1408+row*32]],['circuit','advanced'],68);
      this.route([[3072,1344+row*32],[3264-row*32,1344+row*32],[3264-row*32,y+352],[3296,y+352]],['processor','circuit'],72);
    }
    this.route([[768,2816],[832,2816],[832,2272],[2048,2272],[2048,2912]],['gear','iron'],48);
    this.route([[2528,1216],[2528,1344],[2688,1344],[2688,1408]],'processor',64);
    for(const [x,y] of [[928,576],[2048,576],[3168,576],[4384,576],[928,2128],[4384,2128],[928,2976],[3168,2976],[4384,2976]]) {
      this.entity('substationShadow',x,y,3);this.entity('substation',x,y);
    }
    this.robotsBetween([2272,1632],[1408,928],3);
    this.robotsBetween([2944,1888],[3744,2656],3);
    this.robotsBetween([2272,1888],[1376,2656],3);
    pixelText(this.scene,'PIN. BUILD. ACTIVATE. VERIFY. KEEP A WAY BACK.',2240,3104,5,0xbcc8ab,true);
    this.scene.addChild(this.overlay,this.captions);
  }

  render(clock: number,view: View,zoom: number,state: ReleaseSnapshot) {
    const local=localView(view,CAZ_SITE.x,CAZ_SITE.y);
    this.root.visible=local.right>-192&&local.left<CAZ_SITE.width+192&&local.bottom>-192&&local.top<CAZ_SITE.height+192;
    if(!this.root.visible)return;
    super.update(clock,local,zoom);
    for(const island of this.islands) {
      const failed=island.spec.kind==='media'&&state.unhealthy;
      island.render(failed ? clock-state.seconds+10 : clock,localView(local,island.spec.x,island.spec.y),zoom,failed);
    }
    // Physical slots alternate after acceptance; a rejected slot remains visibly quarantined.
    const previousSlot=state.previousSlot, candidateSlot=1-previousSlot;
    const activeSlot=state.activeSlot;
    this.overlay.clear();
    this.banks.forEach((bank,i)=>{
      const rejected=i===candidateSlot&&(state.unhealthy||state.quarantined);
      this.overlay.rect(bank.x-4,bank.y-4,360,328).stroke({color:rejected?RED:i===activeSlot?GREEN:BLUE,width:i===activeSlot?7:3,alpha:i===activeSlot||rejected?.9:.35});
      if(i===activeSlot)this.overlay.rect(bank.x+12,bank.y+304,328,5).fill(state.unhealthy?RED:GREEN);
    });
    const key=[state.phase,state.previous,state.candidate,state.active].join(':');
    if(key!==this.lastCaption) {
      this.lastCaption=key;for(const c of this.captions.removeChildren())c.destroy();
      this.banks.forEach((bank,i)=>{
        const id=i===previousSlot?state.previous:state.candidate;
        const label=state.phase==='ready'&&i===candidateSlot?'NEXT':generation(id);
        pixelText(this.captions,label,bank.x+176,bank.y+12,6,i===activeSlot?GREEN:BLUE,true);
      });
      const label=state.quarantined?'FAILED RELEASE QUARANTINED':state.unhealthy?'MEDIA CHECK FAILED':state.busy?'VERIFY BEFORE ACCEPTING':'SERVICES HEALTHY';
      pixelText(this.captions,label,2608,2400,3.5,state.unhealthy||state.quarantined?RED:GREEN,true);
    }
    if(state.busy) {
      const markers:Point[]=[[432,832],[432,1600],[432,2800],[2608,1296],[2608,2736]];
      const index=state.seconds<3?0:state.seconds<6?1:state.seconds<8?2:state.seconds<10?3:4;
      const [x,y]=markers[index];
      this.overlay.circle(x,y,104).stroke({color:state.unhealthy?RED:BLUE,width:5,alpha:.55});
      // A signal follows the central profile connection in either direction.
      const back=state.phase==='rollback', t=(state.seconds%1.5)/1.5;
      this.overlay.circle(2608,back?1520-t*352:1168+t*352,10).fill(back?RED:BLUE);
    }
  }
}
