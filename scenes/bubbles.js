// Soap bubbles, made for a wall: iridescent bubbles float up from the bottom; touch one and it pops.
// A hand held still blows a new bubble that grows on it and floats away. A slap pops everything nearby,
// in a ripple outwards. From 6 months some bubbles are giants that burst into little ones.
//
// Each bubble is three layers: a thin-film colour swirl (turning slowly, two copies turning opposite ways
// so the colours seem to flow), and on top a fixed layer with the rim and the reflections of a window,
// so the light always comes from the same side. Layers are drawn once per look into sprites and reused.
// Bubbles don't use the shared animal behaviour: update() is their own (they rise, drift and pop).
export default function bubbles(api) {
  const { rand, pick, sounds: { bloop, bell, PENTA, audio } } = api;
  const TAU = Math.PI * 2;
  const SPR = 256, SR = 120;            // sprite size, and the bubble's radius inside it

  // ---------- Sprites ----------
  const sprites = new Map();
  const spritesFor = look => {
    if (!sprites.has(look)) sprites.set(look, { film: makeFilm(look), rim: makeRim(look) });
    return sprites.get(look);
  };
  const canvas = () => { const cv = document.createElement('canvas'); cv.width = cv.height = SPR; return [cv, cv.getContext('2d')]; };

  // The thin film: bands of colour that are strongest towards the edge, as in a real bubble
  function makeFilm(look) {
    const [cv, g] = canvas(), C = SPR / 2, cols = look.film;
    const stops = [...cols, ...cols, cols[0]];
    let grad;
    if (g.createConicGradient) grad = g.createConicGradient(rand(0, TAU), C, C);
    else grad = g.createLinearGradient(0, 0, SPR, SPR);
    stops.forEach((col, i) => grad.addColorStop(i / (stops.length - 1), col));
    g.fillStyle = grad; g.beginPath(); g.arc(C, C, SR, 0, TAU); g.fill();
    // marbling: soft streaks of colour that follow the curve of the bubble
    g.filter = 'blur(9px)';
    for (let i = 0; i < 16; i++) {
      const a = rand(0, TAU), d = rand(0.55, 1) * SR;
      g.globalAlpha = rand(0.35, 0.8); g.fillStyle = pick(cols);
      g.beginPath(); g.ellipse(C + Math.cos(a) * d, C + Math.sin(a) * d, rand(16, 44), rand(5, 14), a + Math.PI / 2, 0, TAU); g.fill();
    }
    g.filter = 'none'; g.globalAlpha = 1;
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(C, C, 0, C, C, SR);
    m.addColorStop(0, 'rgba(0,0,0,0.04)'); m.addColorStop(0.5, 'rgba(0,0,0,0.1)'); m.addColorStop(0.78, 'rgba(0,0,0,0.45)');
    m.addColorStop(0.93, 'rgba(0,0,0,0.95)'); m.addColorStop(0.985, 'rgba(0,0,0,0.7)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, SPR, SPR);
    return cv;
  }

  // Rim and reflections: a faint sphere, a crisp edge, a window pane top-left and a soft glint bottom-right
  function makeRim(look) {
    const [cv, g] = canvas(), C = SPR / 2, rc = look.rim || '255,255,255', k = look.rimK || 1, hi = look.hi ?? 1;
    const body = g.createRadialGradient(C - SR * 0.2, C - SR * 0.25, SR * 0.1, C, C, SR);
    body.addColorStop(0, `rgba(${rc},0)`); body.addColorStop(0.7, `rgba(${rc},0.03)`);
    body.addColorStop(0.9, `rgba(${rc},${0.12 * k})`); body.addColorStop(0.985, `rgba(${rc},${Math.min(1, 0.5 * k)})`);
    body.addColorStop(1, `rgba(${rc},0)`);
    g.fillStyle = body; g.beginPath(); g.arc(C, C, SR, 0, TAU); g.fill();
    g.strokeStyle = `rgba(${rc},${Math.min(1, 0.45 * k)})`; g.lineWidth = look.edge || 2;
    g.beginPath(); g.arc(C, C, SR - (look.edge || 2) / 2 - 0.5, 0, TAU); g.stroke();
    // a curved band between two radii, like a window reflected in the curve
    const band = (a0, a1, r0, r1, alpha) => {
      g.fillStyle = `rgba(255,255,255,${alpha})`; g.beginPath();
      g.arc(C, C, r1, a0, a1); g.arc(C, C, r0, a1, a0, true); g.closePath(); g.fill();
    };
    g.filter = 'blur(1.6px)';
    band(-2.5, -1.78, SR * 0.64, SR * 0.83, 0.78 * hi);     // the big pane
    band(-2.92, -2.6, SR * 0.64, SR * 0.83, 0.5 * hi);      // the narrow pane next to it
    band(0.35, 1.3, SR * 0.8, SR * 0.88, 0.26 * hi);        // light bouncing off the far side
    g.filter = 'blur(4px)';
    band(-2.95, -1.7, SR * 0.88, SR * 0.95, 0.22 * hi);     // sky glow along the top rim
    g.filter = 'none';
    // light from the floor, caught in the lower half of the sphere
    const low = g.createRadialGradient(C, C + SR * 0.55, 0, C, C + SR * 0.55, SR * 0.7);
    low.addColorStop(0, `rgba(${rc},${0.07 * k})`); low.addColorStop(1, `rgba(${rc},0)`);
    g.save(); g.beginPath(); g.arc(C, C, SR * 0.97, 0, TAU); g.clip(); g.fillStyle = low; g.fillRect(0, 0, SPR, SPR); g.restore();
    const sx = C - SR * 0.36, sy = C - SR * 0.6, dot = g.createRadialGradient(sx, sy, 0, sx, sy, SR * 0.1);
    dot.addColorStop(0, `rgba(255,255,255,${0.95 * hi})`); dot.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = dot; g.fillRect(0, 0, SPR, SPR);
    return cv;
  }

  // ---------- Sound: a click of noise plus a short "plip", and a note for each pop (big = low) ----------
  let noise = null;
  function popSound(R, quiet) {
    const sz = Math.max(0.5, Math.min(2.5, R / (api.UNIT * 0.06))), v = quiet ? 0.3 : 1;
    const a = audio?.();
    if (a && api.S.volume > 0) {
      if (!noise) {
        noise = a.createBuffer(1, Math.floor(a.sampleRate * 0.05), a.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 4;
      }
      const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
      src.buffer = noise; f.type = 'bandpass'; f.frequency.value = 3400 / sz; f.Q.value = 0.8;
      g.gain.value = 0.8 * v * api.S.volume;
      src.connect(f).connect(g).connect(a.destination); src.start();
    }
    bloop(950 / sz + rand(-60, 60), 2000 / sz, 0.07, 0.16 * v);
    if (!quiet && api.LOOK.notes) {
      const i = Math.round((2.5 - sz) / 2 * (PENTA.length - 1));
      bell(PENTA[Math.max(0, Math.min(PENTA.length - 1, i))], 0.8, 0.07, 0.01);
    }
  }

  // ---------- The bubble ----------
  let pool = [], target = 0, clock = 0;
  const recruit = () => pool.find(b => b.state === 'wait');

  class Bubble extends api.Critter {
    constructor(look) {
      super(look);
      this.state = 'wait'; this.wait = rand(0.5, 3); this.grow = 1;
      this.spin = rand(0, TAU); this.spinV = rand(0.12, 0.35) * (Math.random() < 0.5 ? -1 : 1);
      this.wobA = rand(0, TAU); this.jiggle = 0; this.immune = 0; this.popDelay = -1;
      this.shards = []; this.drops = [];
    }
    get R() { return this.L * 0.5 * this.grow; }
    setKind(look, kind) {
      this.look = look; this.giant = kind > 1.5;
      this.sizeMul = (api.LOOK.size || 1) * kind; this.z = this.len * kind;
    }
    // a new bubble coming up from below the screen
    respawn() {
      const LK = api.LOOK;
      this.len = rand(0.65, 1.3);
      this.setKind(pick(LK.looks), Math.random() < (LK.giant || 0) ? 2.1 : 1);
      if (this.giant) this.len = rand(0.95, 1.1);
      this.x = rand(0.08, 0.92) * api.W; this.y = api.H + this.R + rand(0, api.H * 0.15);
      this.vx = 0; this.vy = -this.base * 0.5;
      this.state = 'rise'; this.grow = 1; this.age = 0; this.life = rand(18, 34);
      this.immune = 0; this.popDelay = -1; this.jiggle = 0.6; this.hand = null;
    }
    // a little bubble thrown out of a giant one
    launch(x, y, look, vx, vy) {
      this.respawn(); this.len = rand(0.75, 1.1); this.setKind(look, 0.5);
      Object.assign(this, { x, y, vx, vy, immune: 0.5, jiggle: 1 });
    }
    // grows on a still hand, then floats off
    blowFrom(h) {
      this.respawn(); this.len = rand(0.85, 1.15); this.setKind(this.look, 1);
      Object.assign(this, { state: 'blow', hand: h, grow: 0.05, x: h.x, y: h.y });
    }
    release() {
      Object.assign(this, { state: 'rise', vy: -this.base * 1.3, vx: rand(-0.4, 0.4) * this.base, immune: 1.5, jiggle: 1, hand: null });
      bloop(500, 900, 0.1, 0.06);
    }
    wobble() {
      return 0.025 * Math.sin(this.phase * 2.1) + 0.015 * Math.sin(this.phase * 3.3 + 1) + 0.09 * this.jiggle * Math.sin(this.phase * 11);
    }

    update(dt, hands, all) {
      this.phase += dt; this.spin += this.spinV * dt; this.wobA += dt * 0.2;
      this.jiggle = Math.max(0, this.jiggle - dt * 1.4); this.immune -= dt;
      const UNIT = api.UNIT, W = api.W, H = api.H, LK = api.LOOK, base = this.base;

      if (this.state === 'wait') {
        if ((this.wait -= dt) <= 0 && pool.filter(b => b.state !== 'wait').length < target) this.respawn();
        return;
      }
      if (this.state === 'pop') { this.updatePop(dt); return; }
      if (this.state === 'blow') {
        const h = this.hand;
        if (!h || !hands.includes(h)) { this.release(); return; }
        this.grow = Math.min(1, this.grow + dt / 1.4); this.jiggle = 0.5;
        const R = this.R, k = Math.min(1, dt * 10);
        this.x += (h.x - this.x) * k; this.y += (h.y - h.r * 0.5 - R * 0.85 - this.y) * k;
        if (this.grow >= 1 || h.speed > UNIT * 1.5) this.release();
        return;
      }

      // --- rising ---
      if (this.popDelay >= 0 && (this.popDelay -= dt) < 0) { this.pop(...this.popFrom); return; }
      this.age += dt;
      if (this.age > this.life && this.y < H * 0.85) { this.pop(this.x, this.y - this.R, true); return; }   // bubbles don't last forever
      const R = this.R, rise = base * (LK.rise || 1) * (this.giant ? 0.7 : 1);
      // buoyancy, a slow breeze that changes over time, and a little sway of its own
      let ax = (Math.sin(clock * 0.13 + this.cruise * 5) * 0.35 + Math.sin(this.phase * 0.9 + this.wobA) * 0.5) * base - this.vx * 0.8;
      let ay = (-rise - this.vy) * 0.9;
      // a child or their shadow on the wall (Advanced settings → Wall: body & shadow)
      const touch = this.immune <= 0 && this.state === 'rise' ? api.body?.hit(this.x, this.y, R * (LK.pad || 1)) : null;
      if (touch) { this.pop(...touch); return; }
      const reach = api.S.reach * UNIT;
      for (const h of hands) {
        const dx = h.x - this.x, dy = h.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (this.immune <= 0 && d < R * (LK.pad || 1) + h.r * 0.6) { this.pop(h.x, h.y); return; }
        // drift towards a reaching hand: strongly for the little ones, so they get to pop plenty
        if (this.immune <= 0 && d < reach) { const f = (LK.attract || 0.2) * base * 3 * (1 - d / reach); ax += dx / d * f; ay += dy / d * f; }
      }
      for (const o of all) {
        if (o === this || o.state !== 'rise') continue;
        const dx = this.x - o.x, dy = this.y - o.y, d = Math.hypot(dx, dy), min = (R + o.R) * 0.85;
        if (d < min && d > 0.01) { const f = (min - d) / min * base * 4; ax += dx / d * f; ay += dy / d * f; this.jiggle = Math.max(this.jiggle, 0.3); }
      }
      if (this.x < R) ax += (R - this.x) * 2; if (this.x > W - R) ax -= (this.x - (W - R)) * 2;
      this.vx += ax * dt; this.vy += ay * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.y < -R * 1.2) { this.state = 'wait'; this.wait = rand(0.2, 1.5); }
    }

    // Burst: a hole opens where it was touched, the film tears into curling shards and droplets spray out and fall
    pop(fx, fy, quiet = false) {
      const R = this.R, x = this.x, y = this.y, ca = Math.atan2(fy - y, fx - x);
      Object.assign(this, { state: 'pop', popAge: 0, popR: R, ca, shards: [], drops: [] });
      const cols = this.look.film, n = 14;
      for (let i = 0; i < n; i++) {
        const a = ca + (i / n) * TAU, far = Math.abs(Math.atan2(Math.sin(a - ca), Math.cos(a - ca))) / Math.PI;
        this.shards.push({ a, len: rand(0.25, 0.45), vr: R * rand(1.2, 2.6), delay: far * 0.06, color: pick(cols) });
      }
      for (let i = 0; i < (quiet ? 6 : 18); i++) {
        const a = rand(0, TAU), s = R * rand(1.5, 5);
        this.drops.push({ x: x + Math.cos(a) * R, y: y + Math.sin(a) * R, vx: Math.cos(a) * s - Math.cos(ca) * R * 1.5,
          vy: Math.sin(a) * s - Math.sin(ca) * R * 1.5, r: Math.max(1.5, R * rand(0.03, 0.07)), life: rand(0.4, 0.9), age: 0, color: pick(cols) });
      }
      popSound(R, quiet);
      if (!quiet) api.spawnParticles(x, y, 4, 0.4);
      if (this.giant && !quiet) {
        bloop(260, 120, 0.3, 0.2);
        for (let i = 0; i < 5; i++) {
          const b = recruit(); if (!b) break;
          const a = rand(0, TAU), s = this.base * rand(1.5, 3);
          b.launch(x + Math.cos(a) * R * 0.4, y + Math.sin(a) * R * 0.4, this.look, Math.cos(a) * s, Math.sin(a) * s - this.base);
        }
      }
    }
    updatePop(dt) {
      this.popAge += dt;
      const g = api.UNIT * 1.4;
      for (const d of this.drops) { d.age += dt; d.vx *= 1 - dt * 1.5; d.vy = d.vy * (1 - dt * 1.5) + g * dt; d.x += d.vx * dt; d.y += d.vy * dt; }
      if (this.popAge > 1) { this.state = 'wait'; this.wait = rand(0.3, 2.5); }
    }
    // relaxed ones stay in the pool and react to a slap with a short delay, so the pops ripple outwards
    scare(x, y, radius) {
      if (this.state !== 'rise' && this.state !== 'blow') return;
      const d = Math.hypot(this.x - x, this.y - y);
      if (d > radius) return;
      if (this.state === 'blow') { this.pop(x, y); return; }
      this.popDelay = d / radius * 0.35; this.popFrom = [x, y];
    }

    drawBody(c, x, y, R, alpha) {
      const sp = spritesFor(this.look), s = R / SR, half = SPR / 2 * s, w = this.wobble(), fa = this.look.filmA ?? 0.9;
      c.save(); c.translate(x, y);
      c.rotate(this.wobA); c.scale(1 + w, 1 - w); c.rotate(-this.wobA);   // squash and stretch along a turning axis
      c.globalAlpha = alpha * fa;
      c.save(); c.rotate(this.spin); c.drawImage(sp.film, -half, -half, half * 2, half * 2); c.restore();
      c.globalAlpha = alpha * fa * 0.55;
      c.save(); c.rotate(-this.spin * 1.6 + 1.3); c.scale(-1, 1); c.drawImage(sp.film, -half, -half, half * 2, half * 2); c.restore();
      c.globalAlpha = alpha; c.drawImage(sp.rim, -half, -half, half * 2, half * 2);
      c.restore();
    }
    draw(c) {
      if (this.state === 'wait') return;
      if (this.state !== 'pop') { this.drawBody(c, this.x, this.y, this.R, 1); return; }
      const a = this.popAge, R = this.popR, x = this.x, y = this.y;
      // 1. the hole opens from the touched side and sweeps across (in a few hundredths of a second)
      if (a < 0.09) {
        const k = a / 0.09, hr = R * 2.2 * k, hx = x + Math.cos(this.ca) * R, hy = y + Math.sin(this.ca) * R;
        const clip = new Path2D(); clip.rect(x - R * 2, y - R * 2, R * 4, R * 4); clip.moveTo(hx + hr, hy); clip.arc(hx, hy, hr, 0, TAU);
        c.save(); c.clip(clip, 'evenodd'); this.drawBody(c, x, y, R * (1 + 0.06 * k), 1); c.restore();
      }
      // a soft burst of light at the moment it breaks
      if (a < 0.18) {
        const k = a / 0.18, gr = c.createRadialGradient(x, y, 0, x, y, R * (1 + 0.3 * k));
        gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.75, `rgba(255,255,255,${0.12 * (1 - k)})`);
        gr.addColorStop(0.95, `rgba(255,255,255,${0.35 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = gr; c.beginPath(); c.arc(x, y, R * 1.3, 0, TAU); c.fill();
      }
      // 2. a flash ring where the film was
      const e = Math.min(1, a / 0.3);
      if (e < 1) {
        c.strokeStyle = `rgba(255,255,255,${0.7 * (1 - e)})`; c.lineWidth = Math.max(1, R * 0.045 * (1 - e));
        c.beginPath(); c.arc(x, y, R * (1 + 0.35 * (1 - (1 - e) ** 3)), 0, TAU); c.stroke();
      }
      // 3. torn film curling outwards and falling
      c.lineCap = 'round';
      for (const s of this.shards) {
        const t = a - s.delay, k = t / 0.5;
        if (t < 0 || k >= 1) continue;
        const r = R + s.vr * t * (1 - k * 0.5), fall = 0.5 * api.UNIT * 0.8 * t * t, len = s.len * (1 - k);
        const w = Math.max(1.5, R * 0.09 * (1 - k * 0.7));
        c.beginPath(); c.arc(x, y + fall, r, s.a - len / 2, s.a + len / 2);
        c.globalAlpha = 0.45 * (1 - k); c.strokeStyle = s.color; c.lineWidth = w * 2.2; c.stroke();   // coloured film
        c.globalAlpha = 0.9 * (1 - k); c.strokeStyle = '#fff'; c.lineWidth = w * 0.45; c.stroke();     // bright edge
      }
      // 4. droplets
      for (const d of this.drops) {
        const k = d.age / d.life;
        if (k >= 1) continue;
        c.globalAlpha = 0.9 * (1 - k);
        c.fillStyle = d.color; c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(d.x - d.r * 0.3, d.y - d.r * 0.3, d.r * 0.4, 0, TAU); c.fill();
      }
      c.globalAlpha = 1;
    }
  }

  // ---------- Looks per age ----------
  const look = (film, more = {}) => ({ film, filmA: 0.9, rimK: 1, hi: 1, edge: 2, ...more });
  const NATURAL = [
    look(['#ff5fd2', '#ffd25f', '#5fe8ff', '#8cff8a', '#a98bff']),
    look(['#ffd25f', '#ff7ab8', '#7a8cff', '#5fffd0']),
    look(['#5fe8ff', '#c38bff', '#ffcf6b', '#ff6fa8', '#8cff8a']),
  ];
  const RAINBOW = [
    look(['#ff3b3b', '#ffb52e', '#ffee3b', '#3bff6e', '#3bc8ff', '#7a5bff', '#ff4fd8'], { filmA: 1, rimK: 1.1 }),
    look(['#ff4fd8', '#3bc8ff', '#ffee3b'], { filmA: 1, rimK: 1.1 }),
    look(['#3bff6e', '#ffb52e', '#7a5bff'], { filmA: 1, rimK: 1.1 }),
    look(['#ff3b3b', '#3bc8ff', '#ffffff'], { filmA: 1, rimK: 1.1 }),
  ];

  // bokeh lights for the background without the GPU (the GPU version is in the shader)
  let bokeh = [];
  const rgb = (col, m) => `rgb(${col.map(v => Math.round(Math.min(255, v * m))).join(',')})`;

  return {
    id: 'bubbles', order: 4, icon: '🫧', name: { en: 'Bubbles', es: 'Burbujas' },
    hint: {
      en: 'Touch a bubble to pop it. Hold a hand still → a bubble grows on it. Slap → everything nearby pops.',
      es: 'Toca una burbuja para reventarla. Mano quieta → le sale una burbuja. Golpe → revienta todo lo cercano.',
    },
    Critter: Bubble, size: 0.13, speed: 0.6, wander: 0, waves: false, particle: 'bubble',

    // size: bubble size · count: how many (× the "How many" setting) · rise: speed upwards
    // attract: how much they drift to a hand · pad: how easy they are to hit · giant: share of giant bubbles
    stages: [
      { bg: [6, 6, 9], light: [255, 255, 255], size: 1.5, count: 0.5, rise: 0.7, attract: 0.7, pad: 1.35, giant: 0, notes: false,
        looks: [look(['#ffffff', '#e01010'], { filmA: 1, rimK: 1.8, edge: 5 }), look(['#ffffff', '#ffffff', '#e01010'], { filmA: 1, rimK: 1.8, edge: 5 })] },
      { bg: [10, 22, 64], light: [120, 170, 255], size: 1.35, count: 0.7, rise: 0.8, attract: 0.55, pad: 1.3, giant: 0, notes: true,
        looks: [look(['#ff2a2a', '#ffd200', '#2f6bff'], { filmA: 1, rimK: 1.4, edge: 3 }), look(['#ffd200', '#ff2a2a'], { filmA: 1, rimK: 1.4, edge: 3 }),
          look(['#2f6bff', '#ffd200'], { filmA: 1, rimK: 1.4, edge: 3 })] },
      { bg: [18, 26, 58], light: [255, 200, 240], size: 1.1, count: 1, rise: 1, attract: 0.35, pad: 1.15, giant: 0.06, notes: true, looks: NATURAL },
      { bg: [22, 16, 50], light: [200, 160, 255], size: 1, count: 1.4, rise: 1.15, attract: 0.15, pad: 1, giant: 0.12, notes: true, looks: [...NATURAL, ...RAINBOW] },
    ],

    spawn(n) {
      const LK = api.LOOK;
      target = Math.max(2, Math.round(n * (LK.count || 1)));
      pool = Array.from({ length: target + 8 }, (_, i) => {
        const b = new Bubble(pick(LK.looks));
        if (i < target) { b.respawn(); b.y = rand(0.15, 1.05) * api.H; }
        return b;
      });
      return pool;
    },

    sound: { splash() { bloop(320, 120, 0.3, 0.12); } },

    decor: {
      init() { this.layout(); },
      layout() {
        bokeh = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), r: rand(0.02, 0.07), a: rand(0.03, 0.08), sp: rand(0.006, 0.02), p: rand(0, 10) }));
      },
      // a hand held still for a moment blows a bubble
      draw(c, t, dt, hands) {
        clock = t;
        for (const h of hands) {
          h._bs = h.speed < api.UNIT * 0.25 ? (h._bs || 0) + dt : 0;
          h._bcd = Math.max(0, (h._bcd || 0) - dt);
          if (h._bs > 0.9 && h._bcd <= 0 && !pool.some(b => b.state === 'blow' && b.hand === h)) {
            const b = recruit();
            if (b) { b.blowFrom(h); h._bcd = 2.2; }
          }
        }
      },
    },

    draw2D(c, t) {
      const W = api.W, H = api.H, k = 0.35 + 0.65 * api.S.bgGlow, bg = api.LOOK.bg, L = api.LOOK.light;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgb(bg, k * 0.45)); g.addColorStop(1, rgb(bg, k * 1.25));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const b of bokeh) {
        const y = ((b.y - t * b.sp) % 1 + 1) % 1 * H, x = (b.x + Math.sin(t * 0.1 + b.p) * 0.02) * W, r = b.r * api.UNIT;
        c.fillStyle = `rgba(${L.join(',')},${b.a * api.S.bgGlow * (0.6 + 0.4 * Math.sin(t * 0.5 + b.p))})`;
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      }
    },
    // GPU background: dusk light from below, and out-of-focus lights drifting up behind the bubbles
    shader: {
      background: `
        col = mix(base * 1.25 + light * 0.03, base * 0.45, smoothstep(0.0, 1.0, vUv.y));
        col *= mix(1.0, 0.7, clamp(r, 0.0, 1.0));
        for (int i = 0; i < 3; i++) {
          float fi = float(i), sc = 3.0 + fi * 2.5;
          vec2 g = p * sc + vec2(uT * 0.012 * (fi + 1.0), -uT * 0.03 * (fi + 1.0));
          vec2 id = floor(g), f = fract(g) - 0.5;
          float on = step(0.55, hash(id + fi * 13.1));
          vec2 o = (vec2(hash(id + 3.7), hash(id + 9.2)) - 0.5) * 0.5;
          float rad = 0.12 + 0.18 * hash(id + 5.5), d = length(f - o);
          float disc = smoothstep(rad, rad - 0.03, d) * (0.6 + 0.4 * smoothstep(rad - 0.05, rad, d));
          float tw = 0.6 + 0.4 * sin(uT * 0.5 + hash(id) * 6.28);
          col += light * disc * on * tw * (0.05 - fi * 0.012) * uGlow;
        }`,
    },
  };
}
