import type { FactoryCore, AssetName, Point } from './factory-core';
import { railNetwork } from './rail-network';

/** Authored districts and transport routes, composed around the existing plaza. */
export function buildLandscape(f: FactoryCore) {
  const science: AssetName[] = ['redScience','greenScience','blueScience','purpleScience','yellowScience','whiteScience'];
  const ingredients: AssetName[] = ['iron','copper','gear','circuit','advanced','processor','plastic','battery'];

  function array(x: number,y: number,cols: number,rows: number,type: 'assembler'|'furnace'|'lab'|'chemical',input: AssetName|AssetName[],output: AssetName,seed=0) {
    const colors = {assembler:'#aa9656',furnace:'#827d70',lab:'#557e9c',chemical:'#80975c'};
    const pitch=type==='chemical'?224:192;
    const maxRight=x+cols*96+96;
    f.pad(x-96,y-32,cols*96+160,rows*pitch,colors[type]);
    // Uneven edges and different row lengths make room for rerouted supply lines.
    f.route([[x-128,y-64],[x-128,y+(rows-1)*pitch+32]],input,44,seed*17);
    f.route([[x-64,y+160],[x-64,y+rows*pitch]],output,42);
    for(let row=0;row<rows;row++) {
      const inset=(row+seed)%5===2?96:0;
      const count=cols-((row+seed)%4===1?1:0), cy=y+row*pitch+96;
      const last=x+inset+(count-1)*96;
      f.route([[x-128,cy-64],[last+64,cy-64]],input,40+seed%8,row*13);
      f.route([[last+64,cy+64],[x-64,cy+64]],output,38,row*31);
      // An end-of-row return contributes elbows and small loops at the district edge.
      if(row%2===0)f.route([[last+64,cy-64],[last+128,cy-64],[last+128,cy+64],[last+64,cy+64]],input,40);
      for(let col=0;col<count;col++) {
        const cx=x+inset+col*96, phase=seed+row*3.7+col*1.3;
        if(!f.machine(type,cx,cy,phase))continue;
        f.inserter(cx,cy-48,false,phase); f.inserter(cx,cy+48,true,phase+0.6);
      }
      if(row%2===0) {
        f.poles([[x-192,cy+32],[maxRight+32,cy+32]]);
        f.entity('lamp',x-160,cy-16);
      }
      if(row<rows-1&&row%2===0)f.splitter(x-128,cy+128);
    }
  }

  function station(x: number,y: number,item: AssetName,reverse=false) {
    f.pad(x-64,y-128,1184,256,'#7f898b',true);
    for(let wagon=0;wagon<5;wagon++)for(let j=0;j<5;j++) {
      const px=x+wagon*192+j*32;
      f.entity('chest',px,y-64); f.entity('chest',px,y+64);
      f.inserter(px,y-32,false,j); f.inserter(px,y+32,true,j+1);
    }
    for(let lane=0;lane<4;lane++) {
      const yy=y+128+lane*32;
      const points: Point[]=[[x,yy],[x+1056+lane*32,yy],[x+1056+lane*32,y+384+lane*32],[x+544,y+384+lane*32]];
      f.route(reverse?points.reverse():points,item,48);
      f.splitter(x+256+lane*128,yy,true);
    }
    f.poles([[x-64,y],[x+1152,y]]);
    f.entity('lamp',x-32,y-96); f.entity('lamp',x+1120,y-96);
  }

  function columns(x:number,y:number,cols:number,rows:number,input:AssetName|AssetName[],output:AssetName,type:'assembler'|'chemical'='assembler') {
    f.pad(x-80,y-80,cols*192,rows*96+96,type==='chemical'?'#78957d':'#a99562');
    for(let col=0;col<cols;col++) {
      const cx=x+col*192, start=y+(col%2)*96;
      f.route([[cx-64,start-64],[cx-64,start+rows*96],[cx+64,start+rows*96],[cx+64,start-64]],input,46,col*25);
      f.route([[cx+96,start-32],[cx+96,start+(rows-1)*96],[cx+160,start+(rows-1)*96]],output,40);
      for(let row=0;row<rows;row++) {
        const cy=start+row*96;
        if(!f.machine(type,cx,cy,col*5+row))continue;
        f.inserter(cx-48,cy,false,row+col,Math.PI/2);
        f.inserter(cx+48,cy,true,row+col+1,Math.PI/2);
      }
      f.poles([[cx,start-96],[cx,start+rows*96+64]]);
    }
  }

  function chemistry(x: number,y: number,cols: number,rows: number) {
    f.pad(x-96,y-96,cols*256+64,rows*320+96,'#7c9274');
    for(let row=0;row<rows;row++) {
      for(let col=0;col<cols;col++) {
        const px=x+col*256, py=y+row*320;
        f.machine('refinery',px,py,row+col*5);
        f.pipe([[px-64,py+64],[px-64,py+160],[px+128,py+160],[px+128,py-64],[px+64,py-64]]);
      }
      f.pipe([[x-160,y+row*320-64],[x+cols*256-64,y+row*320-64]]);
    }
    for(let i=0;i<cols+1;i++) {
      f.machine('tank',x+i*160,y+rows*320+64);
      f.pipe([[x+i*160,y+rows*320+96],[x+i*160,y+rows*320+160],[x+(cols+1)*160,y+rows*320+160]]);
    }
    f.poles([[x-192,y-128],[x+cols*256,y-128],[x+cols*256,y+rows*320]]);
  }

  function solar(x: number,y: number,cols: number,rows: number) {
    f.pad(x-64,y-64,cols*104+128,rows*104+128,'#5d6d88');
    for(let row=0;row<rows;row++)for(let col=0;col<cols;col++) {
      // Cut corners give the power field a different outline from production.
      if((row<2&&col<2)||(row>rows-3&&col>cols-3))continue;
      f.machine('solar',x+col*104,y+row*104);
    }
    f.poles([[x-96,y],[x-96,y+rows*104],[x+cols*104,y+rows*104]]);
  }

  // Complete circuits reserve their footprints before the surrounding factory
  // is placed. The nameplate remains inside the original northern corridors.
  for(const circuit of railNetwork)f.rail(circuit);

  // Immediate surroundings: detailed manufacture close to every exposed edge
  // of the concrete, with the factory continuing beyond the first camera view.
  array(512,64,14,1,'furnace','ore','iron',1);
  array(2560,64,24,1,'assembler',['copper','iron'],'circuit',3);
  array(5920,64,17,1,'assembler',['iron','gear'],'gear',2);
  station(512,864,'copper');
  array(544,1376,12,2,'assembler',['copper','circuit'],'advanced',4);
  array(5952,672,15,2,'assembler',['circuit','plastic'],'advanced',2);
  array(5760,1536,13,3,'assembler',['advanced','circuit','sulfur'],'processor',6);
  array(7392,1536,9,3,'furnace','copperOre','copper',3);

  // Dense, asymmetric core directly below the nameplate.
  array(2592,1952,11,5,'assembler',['iron','copper'],'circuit',0);
  array(4448,1888,8,6,'assembler',['circuit','plastic'],'advanced',2);
  array(2688,2944,7,3,'assembler',['iron','gear','copper'],'redScience',4);
  array(3712,3264,13,2,'assembler',['circuit','gear'],'greenScience',1);
  array(256,2112,14,5,'furnace','ore','iron',0);

  // Petrochemistry mixes large silhouettes with tight pipe networks.
  chemistry(448,3296,5,3);
  array(864,4576,8,4,'chemical',['plastic','sulfur'],'battery',2);
  chemistry(5856,4288,4,2);
  array(7552,4256,8,4,'chemical',['sulfur','plastic'],'battery',3);

  // Research recirculates on closed sushi belts around each row of labs.
  f.pad(5824,2432,2240,1632,'#548094');
  for(let row=0;row<7;row++) {
    const y=2528+row*192, inset=row%3===1?192:0;
    f.route([[5728+inset,y-64],[7904,y-64],[7904,y+64],[5728+inset,y+64],[5728+inset,y-64]],science,45,row*113);
    for(let col=0;col<19-Math.floor(inset/96);col++) {
      const x=5984+inset+col*96;
      if(f.machine('lab',x,y,col*2+row*3))f.inserter(x,y-48,false,col+row);
    }
    f.poles([[5632,y+32],[8128,y+32]]);
  }
  f.route([[5664,2432],[8160,2432],[8160,4032],[5664,4032],[5664,2432]],science,48);

  // Southern extensions have longer runs and different aspect ratios.
  array(2752,3968,11,6,'assembler',['advanced','gear','steel'],'purpleScience',3);
  array(4288,3904,9,5,'assembler',['processor','battery','circuit'],'yellowScience',5);
  array(3616,6240,15,3,'furnace','iron','steel',1);
  array(5728,6112,11,5,'assembler',['processor','steel','plastic'],'whiteScience',4);
  array(9184,1408,8,7,'furnace','ore','iron',1);
  array(9280,3456,7,7,'assembler',['iron','copper','gear'],'circuit',5);
  array(7808,5888,8,3,'assembler',['gear','circuit'],'greenScience',7);
  station(4096,5888,'steel',true);

  // Infill grew around the older horizontal production lines. Vertical modules,
  // pipe-fed processors, storage, and short detours give those seams character.
  columns(3968,2880,2,3,['circuit','advanced'],'processor');
  columns(5760,1056,6,3,['copper','iron'],'circuit');
  columns(8832,5760,6,7,['copper','circuit'],'advanced');
  columns(160,4640,3,7,['sulfur','plastic'],'battery','chemical');
  columns(7360,6848,6,3,['gear','circuit'],'redScience');
  columns(3200,3840,3,2,['iron','copper'],'gear');
  for(let col=0;col<6;col++) {
    const x=5888+col*192;
    f.machine('chemical',x,5056,col);
    f.pipe([[x-64,4960],[x-64,5120],[x+64,5120],[x+64,4992]]);
    f.inserter(x,5120,true,col);
  }
  // Supply ribbons thread back through the older refinery district and bridge
  // the gaps between late-game expansions.
  for(let lane=0;lane<4;lane++) {
    const d=lane*32;
    f.route([[128+d,3136],[128+d,4480+d],[1760+d,4480+d],[1760+d,3616-d],[416+d,3616-d],[416+d,3008]],['plastic','sulfur','coal','battery'][lane] as AssetName,39+lane*3);
    f.route([[8832+d,5568],[8832+d,5664+d],[10048+d,5664+d],[10048+d,6560+d],[8896,6560+d]],ingredients,44);
    f.route([[2624+d,3552],[2624+d,3808+d],[4128+d,3808+d],[4128+d,5248+d],[5440,5248+d]],busItem(lane),44);
  }
  function busItem(i:number):AssetName {return ['copper','iron','steel','circuit'][i] as AssetName;}

  solar(512,5536,14,12);
  solar(7360,288,8,6);
  f.pad(2176,5696,832,1440,'#747e92',true);
  for(let row=0;row<17;row++)for(let col=0;col<9;col++)f.machine('accumulator',2208+col*80,5760+row*80);
  f.poles([[2112,5728],[3072,5728],[3072,7008],[2112,7008]]);

  // Main arteries bend around the plaza, then peel off into distant districts.
  // Lanes use individual item streams; local science and mixed manufacture use sushi.
  const bus: AssetName[]=['iron','copper','circuit','advanced','processor','plastic','gear','steel'];
  for(let lane=0;lane<8;lane++) {
    const d=lane*32;
    f.route([[2336-d,-256],[2336-d,448-d],[2432-d,448-d],[2432-d,1664+d],[3936-d,1664+d],[3936-d,3072+d],[5344+d,3072+d],[5344+d,5088-d],[7104,5088-d]],bus[lane],46+lane,24*lane);
    f.route([[5440+d,-192],[5440+d,1920-d],[4160+d,1920-d],[4160+d,3168+d],[5568-d,3168+d],[5568-d,4224-d],[8064,4224-d]],bus[(lane+3)%8],44+lane,60*lane);
  }
  // Broad, folded belt fans connect smelting and loading to the interior.
  for(let lane=0;lane<6;lane++) {
    const d=lane*32;
    f.route([[320,3008+d],[1696-d,3008+d],[1696-d,3168+d],[2496+d,3168+d],[2496+d,1856-d],[3776,1856-d]],lane%2?'copper':'iron',46,lane*40);
    f.route([[8000+d,2208],[8000+d,2304+d],[5440-d,2304+d],[5440-d,3712+d],[3520+d,3712+d],[3520+d,5184],[5248,5184]],bus[lane],40+lane);
    // Storage and the fan start east of the accumulator field, in the service
    // corridor. No belt or loading point occupies a power-storage tile.
    f.route([[3072,5632+d],[3456-d,5632+d],[3456-d,6144+d],[7136-d,6144+d],[7136-d,6944+d],[10112,6944+d]],bus[(lane+1)%8],43);
  }
  // Short branches join the arterial routes to each local supply/return manifold.
  const branches: [Point[],AssetName|AssetName[]][] = [
    [[[2272,1632],[2272,1888],[2464,1888]],['iron','copper']],
    [[[4320,2016],[4320,1920],[4544,1920]],['circuit','plastic']],
    [[[2560,2880],[2560,2816],[2336,2816]],['iron','gear']],
    [[[3584,3200],[3584,3104],[4000,3104]],['circuit','gear']],
    [[[5824,608],[5824,576],[5536,576]],['circuit','plastic']],
    [[[5632,1472],[5632,1408],[6144,1408]],['advanced','circuit']],
    [[[2752,3936],[2656,3936],[2656,3840],[3488,3840]],['advanced','steel']],
    [[[4160,3840],[4160,3776],[5312,3776]],['processor','battery']],
    [[[5760,5088],[5760,5440],[7040,5440],[7040,6048],[5600,6048]],['processor','steel']],
    [[[736,4736],[736,4640],[1632,4640]],['sulfur','plastic']],
    [[[7424,4192],[7424,4128],[7808,4128]],['plastic','sulfur']],
  ];
  for(const [points,item] of branches)f.route(points,item,44);

  // Visible balancers, splitters, logistics hubs, and wires provide close-up detail.
  for(let lane=0;lane<4;lane++) {
    f.splitter(2336-lane*64,1760+lane*64,true);
    f.splitter(5344+lane*64,3360+lane*96);
    f.splitter(4096+lane*32,3104+lane*64,true);
  }
  const hubs: Point[]=[[1840,1344],[3968,2112],[5440,2720],[1728,4416],[5504,4704],[8320,3744],[3328,6816],[7424,6592]];
  for(const [x,y] of hubs) {
    f.machine('roboport',x,y);
    for(let i=0;i<4;i++) { f.entity('chest',x-64+i*32,y+96); f.entity('lamp',x-96+i*64,y-96); }
  }
  f.robotsBetween(hubs[1],hubs[2],8); f.robotsBetween(hubs[4],hubs[5],7); f.robotsBetween(hubs[6],hubs[7],6);
  f.poles([[1920,2048],[1920,2688],[1920,3328],[1920,3968],[1920,4608]]);
  f.poles([[5440,5440],[6080,5440],[6720,5440],[7360,5440]]);
  // A small mixed-item loop in the core is deliberately more intricate than the
  // main arteries; it is a useful future home for an automation project scene.
  for(let lane=0;lane<3;lane++) {
    const d=lane*32;
    f.route([[3840+d,2272],[4032+d,2272],[4032+d,2496+d],[3840+d,2496+d],[3840+d,2752+d],[4256-d,2752+d],[4256-d,2016-d],[3840+d,2016-d],[3840+d,2272]],ingredients,36+lane*4,lane*11);
  }
}
