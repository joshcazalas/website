import { Container, Graphics } from 'pixi.js';

// Tile adaptation of the NixOS contributors' logomark (CC BY 4.0).
// https://nixos.org/branding/ — geometry is sampled onto a square tile grid;
// gradients are replaced with two brighter blues for the concrete surface.
export function pixelNix(parent: Container, x: number, y: number, size = 10) {
  const arm = [[-304,-304.84094],[-176,-526.54345],[384,443.40501],[128,443.40501],[0,221.70250],[-128,443.40501],[-256,443.40501],[-320,332.55376],[-128,0]];
  const arms = Array.from({length:6},(_,i) => arm.map(([px,py]) => {
    const a = i*Math.PI/3, dx=px-320, dy=py+554.25626;
    return [dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a)];
  }));
  const inside = (px: number, py: number, points: number[][]) => {
    let hit=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++) {
      const [ax,ay]=points[i], [bx,by]=points[j];
      if((ay>py)!==(by>py) && px<(bx-ax)*(py-ay)/(by-ay)+ax)hit=!hit;
    }
    return hit;
  };
  const tiles = new Graphics(); tiles.position.set(x,y);
  for(let row=0;row<42;row++) for(let col=0;col<48;col++) {
    const index=arms.findIndex(points=>inside((col+.5-24)*48,(row+.5-21)*48,points));
    if(index<0)continue;
    const color=index%2 ? 0x9ad7ef : 0x5d8fce;
    tiles.rect(col*size+1.5,row*size+2.5,size-.5,size-.5).fill({color:0x1c2f37,alpha:.7});
    tiles.rect(col*size,row*size,size-.8,size-.8).fill(color);
  }
  parent.addChild(tiles);
  return tiles;
}
