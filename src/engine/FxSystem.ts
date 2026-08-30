/** מערכת אפקטים צפים: כסף, אימוג'י, עשן, ניצוצות */

export type FxKind =
  | "money"
  | "emoji"
  | "smoke"
  | "sparkle"
  | "wrench"
  | "stock";

export interface FxParticle {
  id: number;
  kind: FxKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  text?: string;
  scale: number;
}

let fxId = 1;

export class FxSystem {
  particles: FxParticle[] = [];

  spawnMoney(worldX: number, worldY: number, amount: number): void {
    this.particles.push({
      id: fxId++,
      kind: "money",
      x: worldX,
      y: worldY,
      vx: (Math.random() - 0.5) * 18,
      vy: -42 - Math.random() * 22,
      life: 1.35,
      maxLife: 1.35,
      text: `+₪${Math.round(amount)}`,
      scale: 1,
    });
    // coin sparkles
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        id: fxId++,
        kind: "sparkle",
        x: worldX + (Math.random() - 0.5) * 16,
        y: worldY + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 40,
        vy: -30 - Math.random() * 40,
        life: 0.7,
        maxLife: 0.7,
        text: "✨",
        scale: 0.7,
      });
    }
  }

  spawnEmoji(worldX: number, worldY: number, emoji: string): void {
    this.particles.push({
      id: fxId++,
      kind: "emoji",
      x: worldX,
      y: worldY - 28,
      vx: (Math.random() - 0.5) * 8,
      vy: -18,
      life: 1.8,
      maxLife: 1.8,
      text: emoji,
      scale: 1.15,
    });
  }

  spawnSmoke(worldX: number, worldY: number): void {
    this.particles.push({
      id: fxId++,
      kind: "smoke",
      x: worldX + (Math.random() - 0.5) * 10,
      y: worldY - 20,
      vx: (Math.random() - 0.5) * 12,
      vy: -22 - Math.random() * 10,
      life: 1.1,
      maxLife: 1.1,
      scale: 0.8 + Math.random() * 0.6,
    });
  }

  spawnSparkle(worldX: number, worldY: number): void {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        id: fxId++,
        kind: "sparkle",
        x: worldX,
        y: worldY,
        vx: (Math.random() - 0.5) * 50,
        vy: -20 - Math.random() * 50,
        life: 0.85,
        maxLife: 0.85,
        text: i % 2 ? "✨" : "💫",
        scale: 0.8,
      });
    }
  }

  update(dt: number): void {
    const remain: FxParticle[] = [];
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === "money" || p.kind === "emoji") {
        p.vy += 8 * dt;
      } else if (p.kind === "smoke") {
        p.vx *= 0.98;
        p.scale += dt * 0.35;
      }
      remain.push(p);
    }
    this.particles = remain;
    if (this.particles.length > 220) {
      this.particles = this.particles.slice(-180);
    }
  }

  drawMapped(
    ctx: CanvasRenderingContext2D,
    toScreen: (x: number, y: number) => { x: number; y: number },
  ): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      const s = toScreen(p.x, p.y);
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, t));
      ctx.translate(s.x, s.y - (1 - t) * 12);

      if (p.kind === "money") {
        ctx.fillStyle = "rgba(16, 185, 129, 0.95)";
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 3;
        ctx.font = `bold ${15 * p.scale}px Fredoka, Heebo, sans-serif`;
        ctx.textAlign = "center";
        ctx.strokeText(p.text ?? "", 0, 0);
        ctx.fillText(p.text ?? "", 0, 0);
      } else if (p.kind === "emoji" || p.kind === "sparkle") {
        const bounce = 1 + Math.sin((1 - t) * Math.PI * 4) * 0.1;
        ctx.font = `${20 * p.scale * bounce}px serif`;
        ctx.textAlign = "center";
        // speech bubble backplate
        if (p.kind === "emoji") {
          ctx.fillStyle = "rgba(255,255,255,0.92)";
          ctx.beginPath();
          ctx.roundRect(-14, -18, 28, 24, 8);
          ctx.fill();
        }
        ctx.fillText(p.text ?? "✨", 0, 0);
      } else if (p.kind === "smoke") {
        const r = 10 * p.scale;
        const g = ctx.createRadialGradient(0, 0, 1, 0, 0, r);
        g.addColorStop(0, "rgba(100,100,100,0.5)");
        g.addColorStop(1, "rgba(100,100,100,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }
}

export const fxSystem = new FxSystem();
