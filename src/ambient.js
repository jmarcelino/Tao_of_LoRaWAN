export class RippleField {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ripples = [];
    this.active = false;
    this.frame = 0;
    this.lastAuto = 0;
    this.lastPointer = 0;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let seed = 0x6c6f7261;
    this.random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    this.resize = this.resize.bind(this);
    this.draw = this.draw.bind(this);
    this.onPointer = this.onPointer.bind(this);
    window.addEventListener("resize", this.resize);
    window.addEventListener("pointermove", this.onPointer, { passive: true });
    window.addEventListener("pointerdown", this.onPointer, { passive: true });
    this.resize();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.reducedMotion) this.drawStatic();
  }

  onPointer(event) {
    if (!this.active || this.reducedMotion) return;
    const now = performance.now();
    if (event.type === "pointermove" && now - this.lastPointer < 140) return;
    this.lastPointer = now;
    this.addRipple(event.clientX, event.clientY, event.type === "pointerdown" ? 1 : .48);
  }

  addRipple(x, y, strength = .6) {
    this.ripples.push({ x, y, born: performance.now(), strength, life: 3400 });
    if (this.ripples.length > 16) this.ripples.shift();
  }

  setActive(active) {
    this.active = active;
    this.canvas.style.visibility = active ? "visible" : "hidden";
    cancelAnimationFrame(this.frame);
    if (!active) return;
    if (this.reducedMotion) {
      this.drawStatic();
      return;
    }
    this.ripples = [];
    this.addRipple(this.width * .72, this.height * .43, .75);
    this.lastAuto = performance.now();
    this.frame = requestAnimationFrame(this.draw);
  }

  drawStatic() {
    const ctx = this.ctx;
    ctx.fillStyle = "#101b27";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.strokeStyle = "rgba(175,145,95,.16)";
    for (let radius = 80; radius < Math.max(this.width, this.height); radius += 120) {
      ctx.beginPath();
      ctx.arc(this.width * .72, this.height * .43, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  draw(now) {
    if (!this.active) return;
    const ctx = this.ctx;
    ctx.fillStyle = "#101b27";
    ctx.fillRect(0, 0, this.width, this.height);

    const glow = ctx.createRadialGradient(this.width * .72, this.height * .43, 0, this.width * .72, this.height * .43, this.width * .58);
    glow.addColorStop(0, "rgba(22,38,56,.72)");
    glow.addColorStop(1, "rgba(16,27,39,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, this.width, this.height);

    if (now - this.lastAuto > 2300) {
      this.addRipple(this.width * (.62 + this.random() * .22), this.height * (.27 + this.random() * .42), .34);
      this.lastAuto = now;
    }

    this.ripples = this.ripples.filter(ripple => now - ripple.born < ripple.life);
    for (const ripple of this.ripples) {
      const progress = (now - ripple.born) / ripple.life;
      const eased = 1 - Math.pow(1 - progress, 2);
      const radius = 10 + eased * Math.min(this.width, this.height) * .48;
      const alpha = (1 - progress) * ripple.strength;
      for (let ring = 0; ring < 3; ring++) {
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, Math.max(0, radius - ring * 22), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(252,225,182,${alpha * (.34 - ring * .075)})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    this.frame = requestAnimationFrame(this.draw);
  }
}
