import { Container, Graphics } from 'pixi.js';
import { FactoryCore, type AssetName, type View } from './factory-core';

const WIDTH=2816, HEIGHT=1792;
const SCENES=['Rail yard','Research','Oil refinery'] as const;
const SCENE_SECONDS=18;

/** Small, close-up tableaux in the style of Factorio's live menu simulations. */
class MenuScene extends FactoryCore {
  protected animateConveyors=true;
  constructor(private kind: number) { super(); }
  protected build() {
    this.ground(this.layers[0],'grass',-4096,-4096,11264,9984,0xa7ac8e);
    for(const [x,y,w,h] of [[-512,96,1600,1504],[1696,0,1632,1920],[864,1152,960,928]])
      this.ground(this.layers[0],'dirt',x,y,w,h,0xa4a593);
    if(this.kind===0)this.railYard();
    else if(this.kind===1)this.research();
    else this.refinery();
  }

  private railYard() {
    // The return legs and broad bends are outside the title camera. These are
    // persistent trains on real closed paths, not newly spawned passing sprites.
    this.rail({id:'menu-station',points:[[-768,192],[3584,192],[3840,448],[3840,768],[-768,768],[-1024,512]],radius:224,
      trains:[{cars:6,speed:1376,phase:.05,stop:[640,192],dwell:3},{cars:5,speed:1376,phase:.55,stop:[640,192],dwell:3}]});
    this.rail({id:'menu-mainline',points:[[-768,1376],[3584,1376],[3840,1632],[3840,2048],[-768,2048],[-1024,1792],[-1024,1632]],radius:224,
      trains:[{cars:7,speed:1760,phase:.26},{cars:6,speed:1760,phase:.76}]});
    for(const x of [128,320,512,704,896,1952,2144,2336,2528,2720]) {
      for(const y of [288,352,608,672]) {
        this.entity('chest',x,y);this.entity('chest',x+48,y);
      }
      this.inserter(x,240);this.inserter(x+48,240,false,x);
      this.inserter(x,720,true);this.inserter(x+48,720,true,x);
      this.machine('assembler',x,480,x/32);
      this.inserter(x,416);this.inserter(x,544,true);
    }
    for(const y of [384,576]) {
      this.route([[-256,y],[1056,y],[1056,y+96],[-256,y+96],[-256,y]],['iron','copper','gear'],160);
      this.route([[1792,y],[3072,y],[3072,y+96],[1792,y+96],[1792,y]],['circuit','advanced','processor'],160);
    }
    for(const x of [128,352,576,800,1984,2208,2432,2656]) {
      this.machine('furnace',x,1040,x/24);
      this.machine('assembler',x,1200,x/16);
      this.inserter(x,960);this.inserter(x,1120,true);this.inserter(x,1264,true);
    }
    this.route([[-256,896],[1120,896],[1120,1312],[-256,1312],[-256,896]],['iron','copper'],144);
    this.route([[1728,896],[3104,896],[3104,1312],[1728,1312],[1728,896]],['gear','circuit'],144);
    for(let i=0;i<3;i++)this.route([[1088+i*64,160],[1088+i*64,1472+i*64],[1664-i*64,1472+i*64],[1664-i*64,160]],['iron','copper','circuit'],128+i*16,i*150);
    for(const x of [96,544,992,1824,2272,2720])this.poles([[x,80],[x,528],[x,848],[x,1296],[x,1568]]);
    for(const x of [320,768,2048,2496]) {
      this.machine('roboport',x,1616);this.robotsBetween([x,1616],[x+160,512],4);
    }
  }

  private research() {
    const science:AssetName[]=['redScience','greenScience','blueScience','purpleScience','yellowScience'];
    for(const side of [0,1]) {
      const left=side?1792:64, right=left+960;
      for(let row=0;row<6;row++) {
        const y=256+row*224;
        for(let col=0;col<5;col++) {
          const x=left+96+col*192;
          this.machine('lab',x,y,row*11+col*7);
          this.inserter(x,y-64,false,col);this.inserter(x,y+64,true,row);
        }
        this.route([[left,y-96],[right,y-96],[right,y+96],[left,y+96],[left,y-96]],science,120,row*27);
        this.poles([[left+64,y+32],[left+448,y+32],[right-64,y+32]]);
      }
    }
    for(let i=0;i<4;i++) {
      const x=1120+i*64;
      this.route([[x,-192],[x,1504+i*64],[1664-i*64,1504+i*64],[1664-i*64,-192]],science,128,i*93);
    }
    for(const x of [96,384,672,960,1888,2176,2464,2752]) {
      this.machine('assembler',x,1584,x/20);this.inserter(x,1520);this.inserter(x,1648,true);
    }
    this.route([[-256,1488],[3008,1488],[3008,1712],[-256,1712],[-256,1488]],['circuit','advanced','processor'],144);
    this.machine('roboport',1408,1312);
    this.robotsBetween([1408,1312],[512,448],5);this.robotsBetween([1408,1312],[2304,1120],5);
  }

  private refinery() {
    for(const x of [256,640,1024]) for(const y of [320,800,1280]) {
      this.machine('refinery',x,y,x/64);
      this.pipe([[x-96,y-160],[x+128,y-160],[x+128,y+128],[x-96,y+128]]);
      this.pipe([[x-64,y+128],[x-64,y+224],[x+256,y+224]]);
    }
    for(const x of [1856,2176,2496,2816]) for(const y of [224,608,992]) {
      this.machine('tank',x,y);
      this.pipe([[x-64,y+96],[x+160,y+96],[x+160,y-96],[x+64,y-96]]);
    }
    for(const y of [1312,1632]) for(const x of [1792,2016,2240,2464,2688]) {
      this.machine('chemical',x,y,x/24+y/20);
      this.inserter(x,y+96,true);this.entity('chest',x,y+144);
    }
    for(let i=0;i<4;i++) {
      const x=1184+i*64;
      this.pipe([[x,-128],[x,1120+i*96],[1632-i*32,1120+i*96],[1632-i*32,-128]]);
    }
    this.pipe([[-256,1440],[1056,1440],[1056,1568],[3072,1568]]);
    this.route([[1696,1184],[2944,1184],[2944,1760],[1696,1760],[1696,1184]],['copper','circuit','advanced'],112);
    for(const x of [128,512,896,1728,2112,2496,2880])this.poles([[x,64],[x,512],[x,1056],[x,1536]]);
    this.machine('roboport',1408,1584);this.robotsBetween([1408,1584],[2368,576],7);
  }
}

export class MenuBackdrop {
  readonly root=new Container();
  private scenes:MenuScene[]=[];
  private fade=new Graphics();
  private seconds=0;
  private index=0;
  constructor(source:FactoryCore) {
    for(let i=0;i<SCENES.length;i++) {
      const scene=new MenuScene(i);scene.useAssets(source);this.scenes.push(scene);this.root.addChild(scene.root);
    }
    this.root.addChild(this.fade);
  }
  update(seconds:number,width:number,height:number) {
    this.seconds=seconds;this.index=Math.floor(seconds/SCENE_SECONDS)%SCENES.length;
    // Fill each aspect ratio with a close-up, rather than zooming all the way out.
    const zoom=Math.max(width/WIDTH,height/HEIGHT)*1.08;
    const cx=width<height?704:WIDTH/2,cy=HEIGHT/2;
    const view:View={left:cx-width/zoom/2,right:cx+width/zoom/2,top:cy-height/zoom/2,bottom:cy+height/zoom/2};
    for(const [i,scene] of this.scenes.entries()) {
      scene.root.visible=i===this.index;if(!scene.root.visible)continue;
      scene.root.scale.set(zoom);scene.root.position.set(width/2-cx*zoom,height/2-cy*zoom);
      scene.update(seconds+9,view,zoom);
    }
    const within=seconds%SCENE_SECONDS;
    const fade=within<.22?1-within/.22:within>SCENE_SECONDS-.22?(within-SCENE_SECONDS+.22)/.22:0;
    this.fade.clear();
    if(seconds>0&&fade>0)this.fade.rect(0,0,width,height).fill({color:0x151910,alpha:fade});
  }
  get state(){return{scene:SCENES[this.index],index:this.index,seconds:this.seconds,trains:this.scenes[this.index].trainState};}
}
