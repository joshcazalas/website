import { WORLD, destinations, type Destination, type View } from './factory';

export class Camera {
  x = 3840;
  y = 1600;
  zoom = 0.4;
  tx = this.x;
  ty = this.y;
  tz = this.zoom;
  width = innerWidth;
  height = innerHeight;
  keys = new Set<string>();
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private cleanup: (() => void)[] = [];
  onChange = () => {};

  constructor(private canvas: HTMLCanvasElement) {
    const listen = <K extends keyof HTMLElementEventMap>(type: K, fn: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
      canvas.addEventListener(type, fn, options);
      this.cleanup.push(() => canvas.removeEventListener(type, fn));
    };
    listen('pointerdown', (event) => {
      if (event.button !== 0 && event.button !== 1) return;
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.pinchDistance = this.distance();
      canvas.classList.add('dragging');
    });
    listen('pointermove', (event) => {
      const previous = this.pointers.get(event.pointerId);
      if (!previous) return;
      this.pan(-(event.clientX - previous.x) / this.zoom / this.pointers.size, -(event.clientY - previous.y) / this.zoom / this.pointers.size);
      this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const distance = this.distance();
      if (this.pointers.size === 2 && this.pinchDistance > 0) {
        const points = [...this.pointers.values()];
        this.zoomAt(distance / this.pinchDistance, (points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2, true);
      }
      this.pinchDistance = distance;
    });
    const release = (event: PointerEvent) => {
      this.pointers.delete(event.pointerId);
      this.pinchDistance = this.distance();
      if (!this.pointers.size) canvas.classList.remove('dragging');
    };
    listen('pointerup', release);
    listen('pointercancel', release);
    listen('lostpointercapture', release);
    listen('wheel', (event) => {
      event.preventDefault();
      this.zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX, event.clientY);
    }, { passive: false });
    const keyDown = (event: KeyboardEvent) => {
      if (document.querySelector('dialog[open]') || (event.target instanceof HTMLElement && event.target.closest('button,a,input'))) return;
      const key = event.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault();
        this.keys.add(key);
      }
      if (key === 'm') this.go('overview');
      if (key === 'h') this.go('home');
      if (key === '=' || key === '+') this.zoomAt(1.25);
      if (key === '-') this.zoomAt(0.8);
    };
    const keyUp = (event: KeyboardEvent) => this.keys.delete(event.key.toLowerCase());
    const blur = () => { this.keys.clear(); this.pointers.clear(); canvas.classList.remove('dragging'); };
    window.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);
    window.addEventListener('blur', blur);
    this.cleanup.push(() => { window.removeEventListener('keydown', keyDown); window.removeEventListener('keyup', keyUp); window.removeEventListener('blur', blur); });
    this.go('home', true);
  }
  private distance() {
    const points = [...this.pointers.values()];
    return points.length === 2 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
  }
  pan(dx: number, dy: number) {
    this.tx = this.x + dx;
    this.ty = this.y + dy;
    this.clamp();
    this.x = this.tx;
    this.y = this.ty;
    this.onChange();
  }
  zoomAt(factor: number, sx = this.width / 2, sy = this.height / 2, immediate = false) {
    const next = Math.max(0.09, Math.min(1.65, this.tz * factor));
    this.tx += (sx - this.width / 2) * (1 / this.tz - 1 / next);
    this.ty += (sy - this.height / 2) * (1 / this.tz - 1 / next);
    this.tz = next;
    this.clamp();
    if (immediate) { this.x = this.tx; this.y = this.ty; this.zoom = this.tz; }
    this.onChange();
  }
  go(destination: Destination, immediate = false) {
    const target = destinations[destination];
    this.tx = target.x;
    this.ty = target.y;
    if (destination === 'home') {
      if (this.width < 650) {
        this.tz = this.width / 3000;
        this.ty = 608 + (this.height / 2 - 90) / this.tz;
      } else {
        this.tz = Math.min(this.width / 5000, this.height / 2900, 0.65);
        this.ty = 1760;
      }
    } else if (destination === 'overview') this.tz = Math.min((this.width - 60) / WORLD.width, (this.height - 160) / WORLD.height);
    else this.tz = Math.min(target.zoom, this.width / 1700);
    this.tz = Math.max(0.09, this.tz);
    if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) { this.x = this.tx; this.y = this.ty; this.zoom = this.tz; }
    this.onChange();
  }
  private clamp() {
    this.tx = Math.max(0, Math.min(WORLD.width, this.tx));
    this.ty = Math.max(0, Math.min(WORLD.height, this.ty));
  }
  update(dt: number) {
    const k = this.keys, speed = dt * 620 / this.zoom;
    const dx = (Number(k.has('d') || k.has('arrowright')) - Number(k.has('a') || k.has('arrowleft'))) * speed;
    const dy = (Number(k.has('s') || k.has('arrowdown')) - Number(k.has('w') || k.has('arrowup'))) * speed;
    if (dx || dy) { this.tx += dx; this.ty += dy; this.clamp(); this.onChange(); }
    const ease = 1 - Math.exp(-dt * 12);
    this.x += (this.tx - this.x) * ease;
    this.y += (this.ty - this.y) * ease;
    this.zoom += (this.tz - this.zoom) * ease;
  }
  view(): View {
    return { left: this.x - this.width / this.zoom / 2, top: this.y - this.height / this.zoom / 2,
      right: this.x + this.width / this.zoom / 2, bottom: this.y + this.height / this.zoom / 2 };
  }
  destroy() { this.cleanup.forEach(fn => fn()); }
}
