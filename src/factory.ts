import { Graphics } from 'pixi.js';
import { FactoryCore } from './factory-core';
import { buildLandscape } from './layout';
import { pixelText, pixelWidth } from './pixel-font';
import { FOUNDATION_SITE, AUXIDE_SITE, CAZ_SITE } from './outpost-location';
export type { View } from './factory-core';

export const WORLD = { width: 10496, height: 7424 };
export const PLAZA = { x: 2464, y: 608, width: 2752, height: 928 };
export const destinations = {
  home: { x: 3840, y: 1600, zoom: 0.40 },
  factory: { x: 3968, y: 2624, zoom: 0.65 },
  power: { x: 1440, y: 5984, zoom: 0.50 },
  research: { x: 6624, y: 3488, zoom: 0.60 },
  overview: { x: WORLD.width / 2, y: WORLD.height / 2, zoom: 0.15 },
  'aws-foundation': { x: FOUNDATION_SITE.x + FOUNDATION_SITE.width / 2, y: FOUNDATION_SITE.y + FOUNDATION_SITE.height / 2, zoom: 0.3 },
  'caz-nix': { x: CAZ_SITE.x + CAZ_SITE.width / 2, y: CAZ_SITE.y + CAZ_SITE.height / 2, zoom: 0.3 },
  auxide: { x: AUXIDE_SITE.x + AUXIDE_SITE.width / 2, y: AUXIDE_SITE.y + AUXIDE_SITE.height / 2, zoom: 0.3 }
};
export type Destination = keyof typeof destinations;

export class Factory extends FactoryCore {
  private plaza() {
    const { x, y, width: w, height: h } = PLAZA;
    const group = this.group(x, y, w, h);
    this.ground(group, 'refined', -24, -24, w + 48, h + 48, 0x56594d);
    this.ground(group, 'concrete', 0, 0, w, h, 0xd7d5c0);
    const border = new Graphics();
    border.rect(24, 24, w - 48, h - 48).stroke({ color: 0x393c31, width: 4, alpha: 0.6 });
    border.rect(80, 98, 20, 20).fill(0x648449);
    border.moveTo(96, 570).lineTo(w - 96, 570).stroke({ color: 0x3e4235, width: 3, alpha: 0.65 });
    group.addChild(border);
    pixelText(group, 'JOSHCAZALAS.COM', 130, 94, 4, 0xc5c6aa);
    pixelText(group, 'AUSTIN / TEXAS', w - 110 - pixelWidth('AUSTIN / TEXAS', 4), 94, 4, 0xc5c6aa);
    pixelText(group, 'JOSH CAZALAS', w / 2 + 4, 227, 32, 0x262b22, true);
    pixelText(group, 'JOSH CAZALAS', w / 2, 222, 32, 0xe4dec3, true);
    pixelText(group, 'PLATFORM ENGINEER + SYSTEMS BUILDER', w / 2, 494, 6, 0xe2d9b5, true);
    const email = 'JOSHUACAZALAS@GMAIL.COM';
    const github = 'GITHUB.COM/JOSHCAZALAS';
    const linkedin = 'LINKEDIN.COM/IN/JOSHCAZALAS';
    const links = [
      { label: email, href: 'mailto:joshuacazalas@gmail.com', x: 112, y: 654, title: 'EMAIL', size: 5 },
      { label: github, href: 'https://github.com/joshcazalas', x: 1056, y: 654, title: 'GITHUB', size: 5 },
      { label: linkedin, href: 'https://www.linkedin.com/in/joshcazalas/', x: 1880, y: 654, title: 'LINKEDIN', size: 4.5 }
    ];
    for (const link of links) {
      pixelText(group, link.title, link.x, link.y - 42, 3.5, 0xc0c79f);
      pixelText(group, link.label, link.x, link.y, link.size, 0xf1e7be);
      this.contacts.push({ label: link.title === 'EMAIL' ? 'Email Josh at joshuacazalas@gmail.com' : `${link.title}: joshcazalas`, href: link.href,
        x: x + link.x - 18, y: y + link.y - 56, width: pixelWidth(link.label, link.size) + 36, height: 118 });
    }
    pixelText(group, 'I BUILD SYSTEMS THAT HELP PEOPLE BUILD THINGS.', w / 2, 826, 4.5, 0xc6cdb0, true);
    for (let lx = 80; lx <= w - 80; lx += 432) {
      this.sprite(group, 'lamp', lx, 16);
      this.sprite(group, 'lamp', lx, h - 16);
    }
    for (const rx of [-140, w + 140]) {
      this.sprite(group, 'radarShadow', rx, h / 2, true, 6);
      this.sprite(group, 'radar', rx, h / 2, true, 6);
    }
  }

  protected build() {
    this.terrain();
    buildLandscape(this);
    this.plaza();
  }
}
