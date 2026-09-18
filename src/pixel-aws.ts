import { Container, Graphics } from 'pixi.js';

// A tile interpretation of the AWS wordmark and smile, drawn in world space.
// Reference: https://a0.awsstatic.com/libra-css/images/logos/aws_logo_smile_1200x630.png
export function pixelAws(parent: Container, x: number, y: number, size = 10) {
  const pixels = Array.from({length:28},()=>Array<number>(48).fill(0));
  const ivory = 0xede7ce, orange = 0xf5a137;
  const stamp = (rows: string[], ox: number, oy: number) => rows.forEach((row,iy)=>[...row].forEach((on,ix)=>{
    if(on==='1')pixels[oy+iy][ox+ix]=ivory;
  }));
  stamp([
    '001111111000','011111111100','011000001110','000000000110',
    '000000000110','000111111110','011111111110','111000000110',
    '110000000110','110000000110','110000001110','111000011110',
    '011111110111','001111100011'
  ],1,1);
  stamp([
    '110000011110000011','110000011110000011','110000111111000011','011000110011000110',
    '011000110011000110','011000110011000110','011001100001100110','001101100001101100',
    '001101100001101100','001111000000111100','001111000000111100','000111000000111000',
    '000110000000011000','000110000000011000'
  ],15,1);
  stamp([
    '001111111100','011111111110','111000000110','110000000000',
    '110000000000','111100000000','011111100000','000111111100',
    '000000011110','000000000110','110000000110','111000001110',
    '011111111100','001111110000'
  ],35,1);
  // The smile is a curved ribbon, with a separate hooked arrow at its tip.
  for(let px=0;px<44;px++) {
    const t=px/43,u=1-t;
    const center=u*u*18+2*u*t*32+t*t*20;
    const thickness=0.8+2.4*Math.sin(t*Math.PI);
    for(let py=16;py<28;py++)if(Math.abs(py+.5-center)<thickness/2)pixels[py][px]=orange;
  }
  const arrow = ['001111111','111111111','110000011','000000011','000000110','000001110','000011100','000011000'];
  arrow.forEach((row,iy)=>[...row].forEach((on,ix)=>{if(on==='1')pixels[16+iy][39+ix]=orange;}));
  const graphic=new Graphics();
  for(let row=0;row<pixels.length;row++)for(let col=0;col<48;col++)if(pixels[row][col]){
    graphic.rect(x+col*size+3,y+row*size+4,size-.65,size-.65).fill({color:0x1c2920,alpha:.45});
  }
  for(let row=0;row<pixels.length;row++)for(let col=0;col<48;col++)if(pixels[row][col]){
    graphic.rect(x+col*size,y+row*size,size-.65,size-.65).fill(pixels[row][col]);
  }
  parent.addChild(graphic);
  return graphic;
}
