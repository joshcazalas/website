import { Container, Graphics } from 'pixi.js';

// Tile interpretation of Karen Rustad Tölva's Ferris (CC0), https://rustacean.net/.
// Like the nameplate lettering, every square lives on the factory floor.
type Point = [number, number];
export function pixelFerris(parent: Container, x: number, y: number, size = 10) {
  const width = 48, height = 30;
  const pixels = Array.from({ length: height }, () => Array<number>(width).fill(0));
  const orange = 0xf47b35, shade = 0xd65a25, eye = 0x22231d, white = 0xfff0d6;
  const polygon = (points: Point[], color: number) => {
    for (let py=0;py<height;py++) for (let px=0;px<width;px++) {
      let inside = false;
      for (let i=0,j=points.length-1;i<points.length;j=i++) {
        const [ax,ay]=points[i], [bx,by]=points[j];
        if ((ay>py+.5)!==(by>py+.5) && px+.5<(bx-ax)*(py+.5-ay)/(by-ay)+ax) inside=!inside;
      }
      if (inside) pixels[py][px]=color;
    }
  };
  const ellipse = (cx: number, cy: number, rx: number, ry: number, color: number) => {
    for (let py=0;py<height;py++) for (let px=0;px<width;px++) {
      if (((px+.5-cx)/rx)**2+((py+.5-cy)/ry)**2<=1) pixels[py][px]=color;
    }
  };
  polygon([[7,13],[9,10],[8,8],[11,8],[11,5],[14,6],[15,3],[18,4],[20,1],[22,3],[24,0],[26,3],[28,1],[30,4],[33,3],[34,6],[37,5],[37,8],[40,8],[39,11],[42,12],[41,15],[43,19],[39,22],[36,25],[32,27],[29,29],[25,29],[24,27],[22,29],[18,29],[15,27],[11,25],[8,22],[5,19],[6,16],[4,14]],orange);
  polygon([[8,15],[1,19],[1,21],[8,29],[6,23],[4,20],[9,18]],orange);
  polygon([[40,15],[47,19],[47,21],[40,29],[42,23],[44,20],[39,18]],orange);
  polygon([[8,21],[11,26],[9,25],[6,20]],shade);
  polygon([[40,21],[37,26],[39,25],[42,20]],shade);
  polygon([[11,21],[16,23],[13,23]],shade);
  polygon([[37,21],[32,23],[35,23]],shade);
  // Two glossy eyes and the smile-shaped opening between the front claws.
  ellipse(20,17,2.7,3.5,eye); ellipse(28,17,2.7,3.5,eye);
  ellipse(19,15.5,1.15,1.55,white); ellipse(27,15.5,1.15,1.55,white);
  polygon([[17,25],[21,25],[24,26],[27,25],[31,25],[28,27],[25,28],[22,28],[19,27]],eye);
  polygon([[13,24],[16,22],[19,22],[22,24],[24,26],[22,25],[19,23],[16,23]],shade);
  polygon([[35,24],[32,22],[29,22],[26,24],[24,26],[26,25],[29,23],[32,23]],shade);

  const graphic = new Graphics();
  for (let row=0;row<height;row++) for (let col=0;col<width;col++) if (pixels[row][col]) {
    graphic.rect(x+col*size+3,y+row*size+4,size-.65,size-.65).fill({color:0x1c2920,alpha:.45});
  }
  for (let row=0;row<height;row++) for (let col=0;col<width;col++) if (pixels[row][col]) {
    graphic.rect(x+col*size,y+row*size,size-.65,size-.65).fill(pixels[row][col]);
  }
  parent.addChild(graphic);
  return graphic;
}
