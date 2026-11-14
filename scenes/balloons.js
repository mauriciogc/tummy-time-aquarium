// Surprise balloons, made for a wall: balloons float up on swaying strings. Pop one and out comes confetti,
// bits of rubber and (from 3 months) a little animal on a parachute that drifts down and away (out the bottom or a side).
// Touch an animal and it giggles and bounces. A hand held still blows up a new balloon; a slap pops everything near.
//
// Like bubbles.js this scene has its own update() instead of the shared animal behaviour. Each item in the pool
// lives several lives: balloon → pop → parachute → gone, then back as a new balloon.
export default function balloons(api) {
  const { rand, pick, sounds: { bloop, bell, PENTA, audio } } = api;
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- Balloon sprite: drawn once per colour ----------
  const SPR = 256, SR = 96;   // sprite size, balloon half-width inside it
  const BALLOON_ALPHA = 0.85;  // a little see-through: softer light on the wall
  function balloonPath(R) {
    const p = new Path2D();
    p.moveTo(0, -1.15 * R);
    p.bezierCurveTo(0.62 * R, -1.15 * R, R, -0.7 * R, R, -0.15 * R);
    p.bezierCurveTo(R, 0.45 * R, 0.45 * R, 0.95 * R, 0.08 * R, 1.07 * R);
    p.lineTo(-0.08 * R, 1.07 * R);
    p.bezierCurveTo(-0.45 * R, 0.95 * R, -R, 0.45 * R, -R, -0.15 * R);
    p.bezierCurveTo(-R, -0.7 * R, -0.62 * R, -1.15 * R, 0, -1.15 * R);
    p.closePath();
    return p;
  }
  const sprites = new Map();
  function spriteFor(look) {
    if (sprites.has(look)) return sprites.get(look);
    const cv = document.createElement('canvas'); cv.width = cv.height = SPR;
    const g = cv.getContext('2d'), R = SR;
    g.translate(SPR / 2, SPR / 2);
    const path = balloonPath(R);
    g.fillStyle = look.color; g.fill(path);
    g.save(); g.clip(path);
    // round shading: lit from the top left, darker towards the lower right
    let gr = g.createRadialGradient(-0.35 * R, -0.5 * R, R * 0.05, -0.1 * R, -0.1 * R, R * 1.45);
    gr.addColorStop(0, 'rgba(255,255,255,0.45)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    gr.addColorStop(0.7, 'rgba(0,0,0,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = gr; g.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);
    // light shining through the rubber, glowing near the bottom
    gr = g.createRadialGradient(0.25 * R, 0.55 * R, 0, 0.25 * R, 0.55 * R, R * 0.65);
    gr.addColorStop(0, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);
    // soft reflected light along the right edge
    g.filter = 'blur(4px)'; g.lineWidth = R * 0.08; g.strokeStyle = 'rgba(255,255,255,0.14)';
    g.translate(-R * 0.05, -R * 0.03); g.stroke(path);
    g.restore();
    // shiny highlights
    g.filter = 'blur(2px)';
    g.save(); g.translate(-0.42 * R, -0.5 * R); g.rotate(-0.6);
    g.fillStyle = 'rgba(255,255,255,0.78)'; g.beginPath(); g.ellipse(0, 0, 0.12 * R, 0.27 * R, 0, 0, TAU); g.fill(); g.restore();
    g.filter = 'none';
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.arc(-0.17 * R, -0.83 * R, 0.045 * R, 0, TAU); g.fill();
    // the knot
    const knot = new Path2D();
    knot.moveTo(-0.07 * R, 1.05 * R); knot.lineTo(0.07 * R, 1.05 * R); knot.lineTo(0.11 * R, 1.2 * R);
    knot.quadraticCurveTo(0, 1.14 * R, -0.11 * R, 1.2 * R); knot.closePath();
    g.fillStyle = look.color; g.fill(knot); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fill(knot);
    if (look.outline) { g.strokeStyle = look.outline; g.lineWidth = 5; g.stroke(path); g.lineWidth = 3; g.stroke(knot); }
    sprites.set(look, cv);
    return cv;
  }

  // ---------- Animals (seen from the front). A = head radius ----------
  const ANIMALS = {
    chick: { head: '#ffd84a', body: '#ffcf33', belly: '#fff0a8' },
    bear: { head: '#a8714a', body: '#9c6842', belly: '#e9c39b', ear: '#e2b48c' },
    bunny: { head: '#f5f1ea', body: '#efe9df', belly: '#ffffff', ear: '#f7b6c8' },
    cat: { head: '#f29a3a', body: '#ea8f30', belly: '#ffe2c2', ear: '#ffd0a8' },
    frog: { head: '#6ccf5a', body: '#5fc24e', belly: '#d6f5b0' },
    panda: { head: '#f6f6f2', body: '#151515', belly: '#f6f6f2', ear: '#151515', line: 'rgba(255,255,255,0.55)' },   // light outline: black fur on a dark wall
  };
  function shade(c, x, y, r) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r * 1.1);
    g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.2)');
    return g;
  }
  const blob = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, TAU); };
  // armsUp: holding the parachute lines; blink 0..1; joy 0..1 (a big open smile while giggling)
  function drawAnimal(c, kind, A, armsUp, blink, joy) {
    const k = ANIMALS[kind], line = k.line || 'rgba(0,0,0,0.22)';
    c.lineWidth = A * 0.05; c.strokeStyle = line;
    // feet and body
    c.fillStyle = k.body;
    for (const s of [-1, 1]) { blob(c, s * A * 0.32, A * 1.62, A * 0.22, A * 0.14); c.fill(); c.stroke(); }
    blob(c, 0, A * 1.05, A * 0.72, A * 0.62); c.fill(); c.stroke();
    c.fillStyle = k.belly; blob(c, 0, A * 1.15, A * 0.45, A * 0.4); c.fill();
    c.fillStyle = shade(c, 0, A * 1.05, A * 0.72); blob(c, 0, A * 1.05, A * 0.72, A * 0.62); c.fill();
    // arms: up holding the lines, or resting
    c.fillStyle = kind === 'panda' ? '#151515' : k.body;
    for (const s of [-1, 1]) {
      if (armsUp) blob(c, s * A * 0.62, A * 0.35, A * 0.15, A * 0.36, s * -0.5);
      else blob(c, s * A * 0.66, A * 1.05, A * 0.16, A * 0.3, s * 0.4);
      c.fill(); c.stroke();
    }
    // ears (behind the head)
    if (kind === 'bear' || kind === 'panda') for (const s of [-1, 1]) {
      c.fillStyle = kind === 'panda' ? k.ear : k.head; blob(c, s * A * 0.68, -A * 0.7, A * 0.3, A * 0.3); c.fill(); c.stroke();
      if (kind === 'bear') { c.fillStyle = k.ear; blob(c, s * A * 0.68, -A * 0.7, A * 0.16, A * 0.16); c.fill(); }
    }
    if (kind === 'bunny') for (const s of [-1, 1]) {
      c.fillStyle = k.head; blob(c, s * A * 0.36, -A * 1.35, A * 0.22, A * 0.62, s * 0.15); c.fill(); c.stroke();
      c.fillStyle = k.ear; blob(c, s * A * 0.36, -A * 1.3, A * 0.1, A * 0.45, s * 0.15); c.fill();
    }
    if (kind === 'cat') for (const s of [-1, 1]) {
      c.fillStyle = k.head; c.beginPath(); c.moveTo(s * A * 0.25, -A * 0.75); c.lineTo(s * A * 0.85, -A * 1.05); c.lineTo(s * A * 0.85, -A * 0.3); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = k.ear; c.beginPath(); c.moveTo(s * A * 0.42, -A * 0.68); c.lineTo(s * A * 0.75, -A * 0.88); c.lineTo(s * A * 0.75, -A * 0.45); c.closePath(); c.fill();
    }
    // head
    c.fillStyle = k.head; blob(c, 0, 0, A, A * 0.92); c.fill(); c.stroke();
    if (kind === 'chick') {   // a little tuft
      c.strokeStyle = '#f2b81f'; c.lineWidth = A * 0.09; c.lineCap = 'round';
      for (const a of [-0.35, 0, 0.35]) { c.beginPath(); c.moveTo(0, -A * 0.88); c.quadraticCurveTo(Math.sin(a) * A * 0.5, -A * 1.2, Math.sin(a) * A * 0.3, -A * 1.3); c.stroke(); }
      c.lineWidth = A * 0.05; c.strokeStyle = line;
    }
    if (kind === 'cat') { c.fillStyle = 'rgba(160,70,10,0.45)'; for (const x of [-0.18, 0, 0.18]) { blob(c, x * A, -A * 0.7, A * 0.05, A * 0.16); c.fill(); } }
    if (kind === 'panda') { c.fillStyle = '#151515'; for (const s of [-1, 1]) { blob(c, s * A * 0.36, -A * 0.02, A * 0.22, A * 0.28, s * -0.5); c.fill(); } }
    c.fillStyle = shade(c, 0, 0, A); blob(c, 0, 0, A, A * 0.92); c.fill();
    // eyes (frog: on top of the head)
    const eyeY = kind === 'frog' ? -A * 0.62 : -A * 0.02, eyeX = kind === 'frog' ? A * 0.5 : A * 0.36;
    if (kind === 'frog') for (const s of [-1, 1]) { c.fillStyle = k.head; blob(c, s * eyeX, eyeY, A * 0.3, A * 0.3); c.fill(); c.stroke(); c.fillStyle = '#fff'; blob(c, s * eyeX, eyeY, A * 0.21, A * 0.21); c.fill(); }
    for (const s of [-1, 1]) {
      const ex = s * eyeX, er = A * 0.13;
      if (blink > 0.5 || joy > 0.5) {   // closed (or squeezed shut with joy)
        c.strokeStyle = kind === 'panda' ? '#fff' : '#1a1a1a'; c.lineWidth = A * 0.07; c.lineCap = 'round';
        c.beginPath(); c.arc(ex, eyeY + er * 0.3, er * 0.9, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
      } else {
        c.fillStyle = '#1a1a1a'; blob(c, ex, eyeY, er, er * 1.1); c.fill();
        c.fillStyle = '#fff'; blob(c, ex - er * 0.3, eyeY - er * 0.4, er * 0.4, er * 0.4); c.fill();
      }
    }
    c.strokeStyle = line; c.lineWidth = A * 0.05;
    // cheeks
    c.fillStyle = 'rgba(255,110,140,0.4)';
    for (const s of [-1, 1]) { blob(c, s * A * 0.62, A * 0.28, A * 0.17, A * 0.11); c.fill(); }
    // snout / beak / nose and mouth
    const mouthY = A * 0.36;
    if (kind === 'chick') { c.fillStyle = '#ff8a1a'; c.beginPath(); c.moveTo(-A * 0.17, A * 0.18); c.lineTo(A * 0.17, A * 0.18); c.lineTo(0, A * (0.42 + joy * 0.1)); c.closePath(); c.fill(); return; }
    if (kind === 'bear') { c.fillStyle = k.belly; blob(c, 0, A * 0.3, A * 0.36, A * 0.27); c.fill(); }
    if (kind !== 'frog') { c.fillStyle = kind === 'bunny' || kind === 'cat' ? '#f27a98' : '#2a1a12'; blob(c, 0, A * 0.2, A * 0.1, A * 0.07); c.fill(); }
    c.strokeStyle = '#2a1a12'; c.lineWidth = A * 0.055; c.lineCap = 'round';
    if (joy > 0.3) { c.fillStyle = '#c0394f'; c.beginPath(); c.arc(0, mouthY, A * (kind === 'frog' ? 0.32 : 0.16), 0, Math.PI); c.closePath(); c.fill(); }
    else if (kind === 'frog') { c.beginPath(); c.arc(0, A * 0.05, A * 0.45, 0.25 * Math.PI, 0.75 * Math.PI); c.stroke(); }
    else { for (const s of [-1, 1]) { c.beginPath(); c.arc(s * A * 0.09, mouthY - A * 0.04, A * 0.09, 0.1 * Math.PI, 0.9 * Math.PI); c.stroke(); } }
    if (kind === 'cat') {   // whiskers
      c.strokeStyle = 'rgba(60,30,10,0.5)'; c.lineWidth = A * 0.03;
      for (const s of [-1, 1]) for (const d of [-0.08, 0.08]) { c.beginPath(); c.moveTo(s * A * 0.4, A * (0.25 + d)); c.lineTo(s * A * 0.95, A * (0.2 + d * 2)); c.stroke(); }
    }
  }
  // Parachute canopy: a dome with scalloped edge and coloured panels. Its bottom edge sits at y = 0
  function drawCanopy(c, Wd, Hc, color, alpha, outline) {
    const p = new Path2D(), half = Wd / 2;
    p.moveTo(-half, 0); p.bezierCurveTo(-half, -Hc * 1.35, half, -Hc * 1.35, half, 0);
    for (let i = 4; i > 0; i--) { const x0 = -half + (i / 4) * Wd, x1 = -half + ((i - 1) / 4) * Wd; p.quadraticCurveTo((x0 + x1) / 2, Hc * 0.2, x1, 0); }
    p.closePath();
    c.globalAlpha = alpha;
    c.fillStyle = color; c.fill(p);
    c.save(); c.clip(p);
    c.fillStyle = 'rgba(255,255,255,0.45)';
    for (const i of [1, 3]) { c.beginPath(); c.moveTo(0, -Hc * 1.1); c.lineTo(-half + (i / 4) * Wd, Hc * 0.3); c.lineTo(-half + ((i + 1) / 4) * Wd, Hc * 0.3); c.closePath(); c.fill(); }
    const g = c.createRadialGradient(-Wd * 0.2, -Hc * 0.8, Hc * 0.1, 0, -Hc * 0.3, Wd * 0.7);
    g.addColorStop(0, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    c.fillStyle = g; c.fillRect(-half, -Hc * 1.2, Wd, Hc * 1.5);
    c.restore();
    c.strokeStyle = outline || 'rgba(0,0,0,0.25)'; c.lineWidth = Math.max(1, Wd * (outline ? 0.02 : 0.012)); c.stroke(p);
    c.globalAlpha = 1;
  }

  // ---------- Sound ----------
  let noise = null;
  function noiseBuf(a) {
    if (!noise) {
      noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.12), a.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
    }
    return noise;
  }
  // a soft "poomf" rather than a bang, so it never startles
  function popSound() {
    const a = audio?.();
    if (a && api.S.volume > 0) {
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = noiseBuf(a); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 0.7;
      g.gain.value = 0.7 * api.S.volume;
      src.connect(f).connect(g).connect(a.destination); src.start();
    }
    bloop(320, 90, 0.18, 0.22);
    if (api.LOOK.notes) { const s = Math.floor(rand(0, 4)); for (let i = 0; i < 3; i++) bell(PENTA[s + i * 2], 0.6, 0.06, 0.08 + i * 0.07); }
  }
  const giggle = () => { const s = Math.floor(rand(4, 6)); for (let i = 0; i < 4; i++) bell(PENTA[s + (i % 2) * 2], 0.25, 0.05, i * 0.07); };

  // ---------- Pool ----------
  let pool = [], target = 0;
  const recruit = () => pool.find(b => b.state === 'wait' && !b.debris.length);

  class Balloon extends api.Critter {
    constructor(look) {
      super(look);
      Object.assign(this, { state: 'wait', wait: rand(0.5, 3), grow: 1, tilt: 0, rope: [], debris: [], jiggle: 0, immune: 0, popDelay: -1 });
    }
    get R() { return this.L * 0.5 * this.grow; }
    get A() { return api.UNIT * 0.042 * (api.LOOK.size || 1) * api.S.fishSize; }
    knot() { const d = this.R * 1.2; return [this.x - Math.sin(this.tilt) * d, this.y + Math.cos(this.tilt) * d]; }
    resetRope() {
      const [kx, ky] = this.knot(), seg = this.R * 0.24;
      this.rope = Array.from({ length: 10 }, (_, i) => ({ x: kx, y: ky + i * seg, px: kx, py: ky + i * seg }));
    }
    respawn() {
      const LK = api.LOOK;
      this.look = pick(LK.looks); this.len = rand(0.85, 1.15); this.sizeMul = LK.size || 1; this.z = rand(0, 1);
      this.x = rand(0.08, 0.92) * api.W; this.y = api.H + this.R * 1.3 + rand(0, api.H * 0.1);
      Object.assign(this, { vx: 0, vy: -this.base * 0.5, state: 'rise', grow: 1, tilt: 0, immune: 0, popDelay: -1, hand: null, jiggle: 0 });
      this.resetRope();
    }
    blowFrom(h) {
      this.respawn();
      Object.assign(this, { state: 'blow', hand: h, grow: 0.08, x: h.x, y: h.y - h.r });
      this.resetRope();
      bloop(180, 420, 1.2, 0.05);   // being blown up
    }
    release() {
      Object.assign(this, { state: 'rise', vy: -this.base * 1.2, vx: rand(-0.3, 0.3) * this.base, immune: 1.5, jiggle: 1, hand: null });
    }

    update(dt, hands, all) {
      this.phase += dt; this.immune -= dt; this.jiggle = Math.max(0, this.jiggle - dt * 1.5);
      this.updateDebris(dt);
      const UNIT = api.UNIT, W = api.W, H = api.H, LK = api.LOOK, base = this.base;
      switch (this.state) {
        case 'wait':
          if (!this.debris.length && (this.wait -= dt) <= 0 && pool.filter(b => b.state === 'rise' || b.state === 'blow').length < target) this.respawn();
          return;
        case 'pop': if (!this.debris.length) { this.state = 'wait'; this.wait = rand(0.5, 2); } return;
        case 'chute': this.updateAnimal(dt, hands); return;
        case 'blow': {
          const h = this.hand;
          if (!h || !hands.includes(h)) { this.release(); break; }
          this.grow = Math.min(1, this.grow + dt / 1.6);
          const R = this.R, k = Math.min(1, dt * 10);
          this.x += (h.x - this.x) * k; this.y += (h.y - h.r * 0.4 - R * 1.3 - this.y) * k;
          this.tilt = Math.sin(this.phase * 3) * 0.06;
          if (this.grow >= 1 || h.speed > UNIT * 1.5) this.release();
          this.updateRope(dt);
          return;
        }
      }
      // --- floating up ---
      if (this.popDelay >= 0 && (this.popDelay -= dt) < 0) { this.pop(); return; }
      const R = this.R, rise = base * (LK.rise || 1);
      let ax = (Math.sin(this.phase * 0.5 + this.cruise * 4) * 0.5 + Math.sin(this.phase * 0.23) * 0.3) * base - this.vx * 0.8;
      let ay = (-rise - this.vy) * 0.8 + Math.sin(this.phase * 1.3) * base * 0.3;   // a gentle bob
      const touch = this.immune <= 0 ? api.body?.hit(this.x, this.y, R * (LK.pad || 1)) : null;
      if (touch) { this.pop(); return; }
      const reach = api.S.reach * UNIT;
      for (const h of hands) {
        const dx = h.x - this.x, dy = h.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (this.immune <= 0 && d < R * (LK.pad || 1) + h.r * 0.6) { this.pop(); return; }
        if (this.immune <= 0 && d < reach) { const f = (LK.attract || 0.2) * base * 3 * (1 - d / reach); ax += dx / d * f; ay += dy / d * f; }
      }
      for (const o of all) {
        if (o === this || o.state !== 'rise') continue;
        const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy), min = (R + o.R) * 0.95;
        if (d < min && d > 0.01) { const f = (min - d) / min * base * 4; ax += dx / d * f; ay += dy / d * f; this.jiggle = Math.max(this.jiggle, 0.25); }
      }
      if (this.x < R) ax += (R - this.x) * 2; if (this.x > W - R) ax -= (this.x - (W - R)) * 2;
      this.vx += ax * dt; this.vy += ay * dt; this.x += this.vx * dt; this.y += this.vy * dt;
      // leans into the way it drifts, and sways on its own
      const want = clamp(this.vx / Math.max(1, base) * 0.25, -0.35, 0.35) + Math.sin(this.phase * 0.9 + this.cruise * 3) * 0.07;
      this.tilt += (want - this.tilt) * Math.min(1, dt * 2);
      this.updateRope(dt);
      if (this.y < -R * 4) { this.state = 'wait'; this.wait = rand(0.2, 1.5); }
    }
    // the string: a chain of points pulled down by gravity and held together, hanging from the knot
    updateRope(dt) {
      const r = this.rope, seg = this.R * 0.24, g = api.UNIT * 0.8 * dt * dt, [kx, ky] = this.knot();
      r[0].x = kx; r[0].y = ky;
      for (let i = 1; i < r.length; i++) {
        const p = r[i], vx = (p.x - p.px) * 0.96, vy = (p.y - p.py) * 0.96;
        p.px = p.x; p.py = p.y; p.x += vx + Math.sin(this.phase * 1.7 + i * 0.6) * seg * 0.01; p.y += vy + g;
      }
      for (let it = 0; it < 3; it++) for (let i = 1; i < r.length; i++) {
        const a = r[i - 1], b = r[i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - seg) / d;
        if (i === 1) { b.x -= dx * f; b.y -= dy * f; } else { a.x += dx * f * 0.5; a.y += dy * f * 0.5; b.x -= dx * f * 0.5; b.y -= dy * f * 0.5; }
      }
    }

    pop() {
      const R = this.R, x = this.x, y = this.y, LK = api.LOOK, col = this.look.color;
      // rubber shreds
      for (let i = 0; i < 7; i++) {
        const a = rand(0, TAU), s = R * rand(2, 5), pts = [];
        for (let k = 0; k < 5; k++) pts.push([Math.cos(k / 5 * TAU) * rand(0.5, 1), Math.sin(k / 5 * TAU) * rand(0.3, 0.7)]);
        this.debris.push({ t: 'shred', x: x + Math.cos(a) * R * 0.6, y: y + Math.sin(a) * R * 0.6, vx: Math.cos(a) * s, vy: Math.sin(a) * s - R,
          s: R * rand(0.18, 0.32), rot: rand(0, TAU), spin: rand(-8, 8), pts, color: col, life: rand(0.9, 1.4), age: 0 });
      }
      // confetti
      for (let i = 0; i < (LK.confettiN || 16); i++) {
        const a = rand(-Math.PI, 0) + rand(-0.4, 0.4), s = R * rand(3, 9);
        this.debris.push({ t: 'confetti', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, w: R * rand(0.07, 0.11), h: R * rand(0.035, 0.05),
          rot: rand(0, TAU), spin: rand(-6, 6), flip: rand(0, TAU), flipV: rand(6, 14), color: pick(LK.confetti), life: rand(2, 3.2), age: 0 });
      }
      this.debris.push({ t: 'ring', x, y, r: R, age: 0, life: 0.3 });
      popSound();
      api.spawnParticles(x, y, 3, 0.5);
      // the surprise (not too many at once: when the sky is full of parachutes it's just confetti)
      if (LK.animals?.length && pool.filter(b => b.state === 'chute').length < Math.ceil((LK.maxChutes || 6) / 2)) {
        Object.assign(this, { state: 'chute', kind: pick(LK.animals), chuteColor: col, chuteLine: this.look.outline, x, y: y - R * 0.2, vx: 0, vy: -api.UNIT * 0.12,
          sway: 0, blink: 0, blinkCd: rand(1, 4), joy: 0, joyCd: 0, collapse: 0, fade: 1, bounce: 0, age: 0,
          // a third go straight down and out; the rest glide off through the nearest side
          drift: Math.random() < 0.34 ? 0 : (x < api.W / 2 ? -1 : 1) });
        bell(PENTA[7], 0.5, 0.05, 0.25); bell(PENTA[9], 0.7, 0.05, 0.38);
      } else this.state = 'pop';
    }
    updateDebris(dt) {
      const g = api.UNIT;
      for (let i = this.debris.length - 1; i >= 0; i--) {
        const d = this.debris[i];
        d.age += dt;
        if (d.age > d.life) { this.debris.splice(i, 1); continue; }
        if (d.t === 'shred') { d.vx *= 1 - dt * 1.2; d.vy = d.vy * (1 - dt * 1.2) + g * 1.2 * dt; d.rot += d.spin * dt; }
        else if (d.t === 'confetti') {   // flutters: strong air drag, slow fall, swinging side to side
          d.vx *= 1 - dt * 3; d.vy = d.vy * (1 - dt * 3) + g * 0.35 * dt; d.rot += d.spin * dt; d.flip += d.flipV * dt;
          d.x += Math.sin(d.flip * 0.5) * g * 0.03 * dt;
        }
        if (d.vx !== undefined) { d.x += d.vx * dt; d.y += d.vy * dt; }
      }
    }

    // --- the animal: drifts all the way down and out, or glides off through a side ---
    updateAnimal(dt, hands) {
      const A = this.A, UNIT = api.UNIT, W = api.W, H = api.H;
      this.blinkCd -= dt; if (this.blinkCd <= 0) { this.blink = 0.15; this.blinkCd = rand(2, 5); }
      this.blink = Math.max(0, this.blink - dt); this.joy = Math.max(0, this.joy - dt * 0.8); this.joyCd -= dt;
      this.bounce = Math.max(0, this.bounce - dt * 2); this.age += dt;
      // touched: giggles and bounces up a little
      const near = (px, py, pr) => Math.hypot(px - this.x, py - this.y) < pr;
      const touched = hands.some(h => near(h.x, h.y, A * 1.4 + h.r * 0.6)) || !!api.body?.hit(this.x, this.y + A * 0.5, A * 1.3);
      if (touched && this.joyCd <= 0) {
        this.joy = 1; this.joyCd = 1.2; this.bounce = 1; giggle();
        api.spawnParticles(this.x, this.y - A, 5, 0.3);
        this.vy = -UNIT * 0.2;
      }
      this.vy += (UNIT * 0.08 - this.vy) * Math.min(1, dt * 1.5);   // settles to a slow drift down
      // a breeze pushes the ones that leave by the side harder and harder
      const glide = this.drift * UNIT * 0.1 * Math.min(1, this.age / 3);
      this.vx = Math.sin(this.phase * 0.7 + this.cruise * 5) * UNIT * 0.04 + glide;
      this.x += this.vx * dt; this.y += this.vy * dt;
      this.sway = Math.sin(this.phase * 1.6) * 0.18 + this.vx / UNIT * 1.5;
      if (this.y > H + A * 4 || this.x < -A * 3 || this.x > W + A * 3) { this.state = 'wait'; this.wait = rand(0.5, 2); }
    }
    // a slap is handled by onSplash below (only the nearest few pop), except a balloon being blown up
    scare(x, y, radius) {
      if (this.state === 'blow' && Math.hypot(this.x - x, this.y - y) < radius) this.pop();
    }

    draw(c) {
      this.drawDebris(c);
      if (this.state === 'rise' || this.state === 'blow') this.drawBalloon(c);
      else if (this.state === 'chute') this.drawChute(c);
    }
    drawBalloon(c) {
      const r = this.rope, R = this.R;
      c.strokeStyle = this.look.string || 'rgba(235,235,250,0.6)'; c.lineWidth = Math.max(1, api.UNIT * 0.0022); c.lineCap = 'round';
      c.beginPath(); c.moveTo(r[0].x, r[0].y);
      for (let i = 1; i < r.length - 1; i++) c.quadraticCurveTo(r[i].x, r[i].y, (r[i].x + r[i + 1].x) / 2, (r[i].y + r[i + 1].y) / 2);
      c.lineTo(r[r.length - 1].x, r[r.length - 1].y); c.stroke();
      const s = R / SR, sq = 0.06 * this.jiggle * Math.sin(this.phase * 12);
      c.save(); c.translate(this.x, this.y); c.rotate(this.tilt); c.scale(1 + sq, 1 - sq);
      c.globalAlpha = BALLOON_ALPHA; c.drawImage(spriteFor(this.look), -SPR / 2 * s, -SPR / 2 * s, SPR * s, SPR * s); c.globalAlpha = 1;
      c.restore();
    }
    drawChute(c) {
      const A = this.A, b = this.bounce, hop = Math.sin(b * Math.PI) * A * 0.5;
      c.save(); c.globalAlpha = Math.max(0, this.fade);
      c.translate(this.x, this.y - hop);
      const sc = Math.max(0.01, this.fade);
      c.scale(sc * (1 + 0.12 * Math.sin(b * 12) * b), sc * (1 - 0.12 * Math.sin(b * 12) * b));
      c.rotate(this.sway);
      const top = -A * 3.4, Wd = A * 3.2, Hc = A * 1.5, col = this.collapse;
      if (col < 1) {
        // lines from the canopy edge to the paws
        c.strokeStyle = `rgba(255,255,255,${0.55 * (1 - col)})`; c.lineWidth = Math.max(1, A * 0.04);
        for (const f of [-0.5, -0.25, 0.25, 0.5]) { c.beginPath(); c.moveTo(f * Wd, top); c.lineTo(Math.sign(f) * A * 0.7, -A * 0.1); c.stroke(); }
        c.save(); c.translate(0, top + (A * 2.6) * col); c.scale(1 + col * 0.3, 1 - col);
        drawCanopy(c, Wd, Hc, this.chuteColor, (1 - col) * c.globalAlpha, this.chuteLine);
        c.restore();
      }
      drawAnimal(c, this.kind, A, this.state === 'chute', this.blink > 0 ? 1 : 0, this.joy);
      c.restore();
    }
    drawDebris(c) {
      for (const d of this.debris) {
        const k = d.age / d.life;
        if (d.t === 'ring') {
          c.strokeStyle = `rgba(255,255,255,${0.25 * (1 - k)})`; c.lineWidth = Math.max(1, d.r * 0.04 * (1 - k));
          c.beginPath(); c.arc(d.x, d.y, d.r * (1 + 0.5 * k), 0, TAU); c.stroke();
        } else if (d.t === 'shred') {
          c.save(); c.translate(d.x, d.y); c.rotate(d.rot); c.globalAlpha = Math.min(1, (1 - k) * 2);
          c.fillStyle = d.color; c.beginPath();
          d.pts.forEach(([px, py], i) => i ? c.lineTo(px * d.s, py * d.s) : c.moveTo(px * d.s, py * d.s));
          c.closePath(); c.fill(); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
          c.restore();
        } else {
          c.save(); c.translate(d.x, d.y); c.rotate(d.rot); c.scale(1, Math.cos(d.flip));   // turning over in the air
          c.globalAlpha = Math.min(1, (1 - k) * 3); c.fillStyle = d.color;
          c.fillRect(-d.w / 2, -d.h / 2, d.w, d.h);
          if (Math.cos(d.flip) < 0) { c.fillStyle = 'rgba(0,0,0,0.22)'; c.fillRect(-d.w / 2, -d.h / 2, d.w, d.h); }   // the back is darker
          c.restore();
        }
      }
      c.globalAlpha = 1;
    }
  }

  // ---------- Looks per age ----------
  const L = (color, more) => ({ color, ...more });
  const FULL = ['#ff3b4e', '#ff9f1c', '#ffd23f', '#3ccf6e', '#2fa8ff', '#7a5cff', '#ff5fa2'].map(c => L(c));
  const CONFETTI = ['#ff3b4e', '#ff9f1c', '#ffd23f', '#3ccf6e', '#2fa8ff', '#7a5cff', '#ff5fa2', '#ffffff'];

  // bits of cloud for the background without the GPU
  let clouds = [];

  return {
    id: 'balloons', order: 5, icon: '🎈', name: { en: 'Surprise balloons', es: 'Globos sorpresa' },
    hint: {
      en: 'Touch a balloon to pop it: confetti and an animal on a parachute. Touch the animals: they giggle. Hand still → a new balloon.',
      es: 'Toca un globo para reventarlo: sale confeti y un animalito en paracaídas. Toca a los animalitos: se ríen. Mano quieta → un globo nuevo.',
    },
    Critter: Balloon, size: 0.12, speed: 0.55, wander: 0, waves: false,
    particle: 'petal', particleColors: () => api.LOOK.confetti, splashParticles: 6,

    // size · count (× "How many") · rise speed · attract to a hand · pad (how easy to hit) · animals that come out
    stages: [
      { bg: [14, 14, 18], light: [255, 255, 255], size: 1.45, count: 0.5, rise: 0.7, attract: 0.7, pad: 1.3, notes: false, maxChutes: 4,
        animals: ['panda'], confetti: ['#ffffff', '#e01010'], confettiN: 14,
        looks: [L('#f4f4f4', { outline: '#111' }), L('#e01010', { outline: '#fff' }), L('#151515', { outline: '#fff', string: 'rgba(255,255,255,0.8)' })] },
      { bg: [12, 26, 66], light: [170, 195, 240], size: 1.3, count: 0.7, rise: 0.8, attract: 0.55, pad: 1.25, notes: true, maxChutes: 5,
        animals: ['chick', 'bear'], confetti: ['#ff2a2a', '#ffd200', '#2f6bff', '#ffffff'],
        looks: [L('#ff2a2a'), L('#ffd200'), L('#2f6bff')] },
      { bg: [16, 30, 64], light: [190, 200, 235], size: 1.1, count: 0.9, rise: 1, attract: 0.35, pad: 1.1, notes: true, maxChutes: 6,
        animals: ['chick', 'bear', 'bunny', 'cat', 'frog'], confetti: CONFETTI, looks: FULL },
      { bg: [20, 24, 60], light: [200, 190, 235], size: 1, count: 1, rise: 1.15, attract: 0.15, pad: 1, notes: true, maxChutes: 7,
        animals: ['chick', 'bear', 'bunny', 'cat', 'frog', 'panda'], confetti: CONFETTI, confettiN: 20,
        looks: [...FULL, L('#ffffff'), L('#20d5c4'), L('#b5179e')] },
    ],

    spawn(n) {
      const LK = api.LOOK;
      target = Math.max(2, Math.round(n * (LK.count || 1)));
      pool = Array.from({ length: target + 20 }, (_, i) => {
        const b = new Balloon(pick(LK.looks));
        if (i < target) { b.respawn(); b.y = rand(0.2, 1.1) * api.H; b.resetRope(); }
        return b;
      });
      return pool;
    },

    sound: { splash() { bloop(260, 110, 0.25, 0.12); } },
    // a slap pops the three nearest balloons, one after the other (not the whole sky at once)
    onSplash(x, y, radius) {
      pool.filter(b => b.state === 'rise' && Math.hypot(b.x - x, b.y - y) < radius)
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))
        .slice(0, 3).forEach((b, i) => { b.popDelay = 0.05 + i * 0.15; });
    },

    decor: {
      init() { this.layout(); },
      layout() {
        clouds = Array.from({ length: 7 }, () => ({ x: Math.random(), y: rand(0.08, 0.7), s: rand(0.6, 1.4), sp: rand(0.004, 0.012),
          puffs: Array.from({ length: 5 }, (_, i) => [(i - 2) * 0.09 + rand(-0.02, 0.02), rand(-0.03, 0.02), rand(0.05, 0.09)]) }));
      },
      // a hand held still blows up a balloon
      draw(c, t, dt, hands) {
        for (const h of hands) {
          h._bs = h.speed < api.UNIT * 0.25 ? (h._bs || 0) + dt : 0;
          h._bcd = Math.max(0, (h._bcd || 0) - dt);
          if (h._bs > 1 && h._bcd <= 0 && !pool.some(b => b.state === 'blow' && b.hand === h)) {
            const b = recruit();
            if (b) { b.blowFrom(h); h._bcd = 2.8; }
          }
        }
      },
    },

    draw2D(c, t) {
      const W = api.W, H = api.H, k = 0.35 + 0.65 * api.S.bgGlow, bg = api.LOOK.bg, Lt = api.LOOK.light;
      const rgb = m => `rgb(${bg.map(v => Math.round(Math.min(255, v * m * k))).join(',')})`;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgb(0.6)); g.addColorStop(1, rgb(1.2));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = `rgba(${Lt.join(',')},${0.07 * api.S.bgGlow})`;
      for (const cl of clouds) {
        const cx = (((cl.x + t * cl.sp) % 1.3 + 1.3) % 1.3 - 0.15) * W, cy = cl.y * H;
        c.beginPath();
        for (const [px, py, pr] of cl.puffs) { const r = pr * cl.s * api.UNIT; c.moveTo(cx + px * cl.s * api.UNIT + r, cy + py * cl.s * api.UNIT); c.arc(cx + px * cl.s * api.UNIT, cy + py * cl.s * api.UNIT, r, 0, TAU); }
        c.fill();
      }
    },
    // GPU background: a sky that's deeper at the top, with soft clouds drifting by
    shader: {
      background: `
        col = mix(base * 1.1, base * 0.55, smoothstep(0.0, 1.0, vUv.y));
        vec2 q = p * 1.4 + vec2(uT * 0.012, 0.0);
        float n = noise(q * 2.0) * 0.5 + noise(q * 4.0 + 3.1) * 0.25 + noise(q * 8.0 + 7.7) * 0.125 + noise(q * 16.0) * 0.0625;
        float cloud = smoothstep(0.5, 0.78, n) * smoothstep(0.0, 0.35, vUv.y);
        col = mix(col, light * (0.35 + 0.25 * uGlow), cloud * 0.12 * uGlow);
        col *= mix(1.0, 0.8, clamp(r, 0.0, 1.0));`,
    },
  };
}
