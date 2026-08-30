export type TickHandler = (dt: number, gameTime: number) => void;

/** Fixed-step game ticker with speed multiplier */
export class Engine {
  private handlers = new Set<TickHandler>();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private running = false;
  gameTime = 0;
  speed: 1 | 2 | 3 = 1;
  paused = false;
  readonly step = 1 / 30;

  on(fn: TickHandler): () => void {
    this.handlers.add(fn);
    return () => this.handlers.delete(fn);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const raw = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      if (this.paused) return;
      this.acc += raw * this.speed;
      while (this.acc >= this.step) {
        this.acc -= this.step;
        this.gameTime += this.step;
        for (const h of this.handlers) h(this.step, this.gameTime);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  setSpeed(s: 1 | 2 | 3): void {
    this.speed = s;
  }

  setPaused(p: boolean): void {
    this.paused = p;
  }
}
