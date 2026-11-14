// Fireworks and fireflies, made for a wall: a night sky over hills. Touch the sky and a rocket climbs from
// behind the hills and bursts right there: balls, rings, hearts, stars, golden willows, little smiles.
// Keep a hand still and the fireflies come to it (the shared animal behaviour). A slap sets off a finale.
// With nobody playing, a firework goes up now and then so the sky is never empty.
// Sounds are soft on purpose: a muffled "boom", never a bang.
export default function fireworks(api) {
  const { rand, pick, glowSprite, sounds: { bloop, bell, PENTA, audio } } = api;
  const TAU = Math.PI * 2;

  // ---------- Fireflies: a small glowing bug ----------
  class Firefly extends api.Critter {
    constructor(look) { super(look); this.sizeMul = 0.5; this.blinkRate = rand(0.6, 1.2); }
    glow() { return 0.55 + 0.45 * Math.max(0, Math.sin(this.phase * this.blinkRate * 0.35)) + this.excite * 0.3; }
    draw(c) {
      const L = this.L, g = this.glow(), col = this.look.glow;
      c.save(); c.globalCompositeOperation = 'lighter';
      const R = L * (0.5 + 0.35 * g);
      c.globalAlpha = Math.min(1, g); c.drawImage(glowSprite(col), this.x - R, this.y - R, R * 2, R * 2);
      c.restore();
      // the bug itself: a dark body and two fluttering wings
      c.save(); c.translate(this.x, this.y); c.rotate(this.heading);
      const flap = Math.abs(Math.sin(this.phase * 9)) * 0.6 + 0.2;
      c.fillStyle = 'rgba(220,235,255,0.35)';
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(L * 0.02, s * L * 0.06, L * 0.08, L * 0.035 * flap + L * 0.01, s * 0.5, 0, TAU); c.fill(); }
      c.fillStyle = '#1b1b14'; c.beginPath(); c.ellipse(L * 0.02, 0, L * 0.07, L * 0.03, 0, 0, TAU); c.fill();
      c.fillStyle = this.look.core; c.beginPath(); c.ellipse(-L * 0.06, 0, L * 0.05 * (0.7 + 0.3 * g), L * 0.035, 0, 0, TAU); c.fill();
      c.restore();
    }
  }

  // ---------- Burst shapes: a list of launch directions (unit-ish vectors) ----------
  const SHAPES = {
    peony(n) {   // a full ball: points on a sphere, seen from the front
      return Array.from({ length: n }, () => {
        const z = rand(-1, 1), a = rand(0, TAU), r = Math.sqrt(1 - z * z);
        return [Math.cos(a) * r, Math.sin(a) * r];
      });
    },
    ring(n) {
      const tilt = rand(0, TAU), sq = rand(0.45, 1);
      return Array.from({ length: n }, (_, i) => {
        const a = i / n * TAU, x = Math.cos(a), y = Math.sin(a) * sq;
        return [x * Math.cos(tilt) - y * Math.sin(tilt), x * Math.sin(tilt) + y * Math.cos(tilt)];
      });
    },
    heart(n) {
      return Array.from({ length: n }, (_, i) => {
        const t = i / n * TAU;
        return [16 * Math.sin(t) ** 3 / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17];
      });
    },
    star(n) {
      const out = [], rot = -Math.PI / 2;
      for (let i = 0; i < n; i++) {
        const u = i / n * 10, k = Math.floor(u), f = u - k;
        const p = j => { const a = rot + j / 10 * TAU, r = j % 2 ? 0.42 : 1; return [Math.cos(a) * r, Math.sin(a) * r]; };
        const [x0, y0] = p(k), [x1, y1] = p(k + 1);
        out.push([x0 + (x1 - x0) * f, y0 + (y1 - y0) * f]);
      }
      return out;
    },
    smile(n) {   // a round face with two eyes and a smile
      const out = [];
      for (let i = 0; i < n * 0.6; i++) { const a = i / (n * 0.6) * TAU; out.push([Math.cos(a), Math.sin(a)]); }
      for (const ex of [-0.35, 0.35]) for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; out.push([ex + Math.cos(a) * 0.08, -0.3 + Math.sin(a) * 0.08]); }
      for (let i = 0; i < n * 0.25; i++) { const a = 0.15 * Math.PI + i / (n * 0.25) * 0.7 * Math.PI; out.push([Math.cos(a) * 0.55, 0.05 + Math.sin(a) * 0.45]); }
      return out;
    },
  };

  // ---------- Sound ----------
  let boomBuf = null, tickBuf = null;
  function bufs(a) {
    if (!boomBuf) {
      const mk = (sec, pow) => {
        const b = a.createBuffer(1, Math.floor(a.sampleRate * sec), a.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** pow;
        return b;
      };
      boomBuf = mk(0.9, 3); tickBuf = mk(0.02, 2);
    }
  }
  function noise(buf, type, freq, gain, delay = 0) {
    const a = audio?.(); if (!a || api.S.volume <= 0) return;
    bufs(a);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf === 'boom' ? boomBuf : tickBuf; f.type = type; f.frequency.value = freq;
    g.gain.value = gain * api.S.volume;
    src.connect(f).connect(g).connect(a.destination); src.start(a.currentTime + delay);
  }
  function boomSound(size, crackle) {
    const v = api.LOOK.boom ?? 1;
    noise('boom', 'lowpass', 380, 0.55 * v * size);
    bloop(130, 48, 0.55, 0.22 * v * size);
    if (crackle) for (let i = 0; i < 14; i++) noise('tick', 'bandpass', rand(3000, 6000), 0.12 * v, rand(0.35, 1.3));
    if (api.LOOK.notes) { const s = Math.floor(rand(0, 5)); bell(PENTA[s], 1.2, 0.04, 0.05); bell(PENTA[s + 2], 1.2, 0.035, 0.09); }
  }

  // ---------- Rockets and sparks ----------
  const rockets = [], sparks = [];
  let flashes = [], idle = 0, nextAuto = 3;
  const MAX_SPARKS = 2200;

  function launch(tx, ty, opts = {}) {
    const W = api.W, H = api.H, LK = api.LOOK;
    ty = Math.min(ty, H * 0.82);   // bursts happen above the hills
    const x0 = Math.max(W * 0.05, Math.min(W * 0.95, tx + rand(-0.08, 0.08) * W));
    const T = 0.7 + (H - ty) / H * 0.7;
    rockets.push({ x0, x: x0, y: H + 10, tx, ty, t: 0, T, shape: opts.shape || pick(LK.shapes), colors: opts.colors || pickColors(),
      size: (opts.size || 1) * (LK.burst || 1) * rand(0.85, 1.15) });
    bloop(260, 900, T, 0.035 * (LK.boom ?? 1));   // the soft whistle on the way up
  }
  function pickColors() {
    const P = api.LOOK.palette;
    if (Math.random() < (api.LOOK.multi || 0)) return [pick(P), pick(P)];   // two-colour bursts
    return [pick(P)];
  }
  function explode(r) {
    const LK = api.LOOK, U = api.UNIT, sz = r.size;
    const kind = r.shape, willow = kind === 'willow', cross = kind === 'crossette';
    const dirs = SHAPES[willow || cross ? 'peony' : kind](Math.round((willow ? 90 : cross ? 26 : kind === 'smile' ? 110 : 120) * (LK.density || 1)));
    const speed = U * 0.42 * sz * (kind === 'peony' || willow || cross ? 1 : 0.85);
    const room = MAX_SPARKS - sparks.length;
    dirs.slice(0, Math.max(0, room)).forEach(([dx, dy], i) => {
      const s = speed * (kind === 'peony' || willow || cross ? rand(0.85, 1.05) : rand(0.97, 1.03));
      const col = willow ? pick(['#ffd27a', '#ffbf47', '#fff0c0']) : r.colors[i % r.colors.length];
      sparks.push({ x: r.tx, y: r.ty, vx: dx * s, vy: dy * s, age: 0, life: willow ? rand(2.4, 3.2) : rand(1.3, 1.8),
        col, size: U * 0.0045 * sz * (willow ? 0.8 : 1), drag: willow ? 1.0 : 1.7, grav: willow ? 0.22 : 0.12,
        trail: [], tlen: willow ? 12 : 6, flicker: Math.random() < 0.5, split: cross ? rand(0.45, 0.6) : 0 });
    });
    // a little bright core
    for (let i = 0; i < 5 && sparks.length < MAX_SPARKS; i++) {
      const a = rand(0, TAU), s = rand(0.02, 0.12) * U;
      sparks.push({ x: r.tx, y: r.ty, vx: Math.cos(a) * s, vy: Math.sin(a) * s, age: 0, life: rand(0.3, 0.6), col: '#ffffff',
        size: U * 0.003, drag: 3, grav: 0.05, trail: [], tlen: 2, flicker: true, split: 0 });
    }
    flashes.push({ x: r.tx, y: r.ty, age: 0, col: r.colors[0], size: sz });
    boomSound(Math.min(1.3, sz), willow || cross);
  }

  function updateSky(dt) {
    const U = api.UNIT;
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i];
      r.t += dt;
      const k = Math.min(1, r.t / r.T), e = 1 - (1 - k) ** 2;   // slows down as it nears the top
      r.x = r.x0 + (r.tx - r.x0) * k + Math.sin(r.t * 14) * U * 0.002;
      r.y = api.H + 10 + (r.ty - api.H - 10) * e;
      if (sparks.length < MAX_SPARKS) sparks.push({ x: r.x + rand(-1, 1), y: r.y + rand(0, 4), vx: rand(-0.02, 0.02) * U, vy: rand(0.02, 0.06) * U,
        age: 0, life: rand(0.25, 0.5), col: '#ffcf7a', size: U * 0.0028, drag: 2, grav: 0.1, trail: [], tlen: 2, flicker: true, split: 0 });
      if (k >= 1) { rockets.splice(i, 1); explode(r); }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.age += dt;
      if (p.age > p.life) { sparks.splice(i, 1); continue; }
      // crossettes: each spark splits into four smaller ones halfway
      if (p.split && p.age > p.life * p.split) {
        p.split = 0;
        for (let k = 0; k < 4 && sparks.length < MAX_SPARKS; k++) {
          const a = k / 4 * TAU + rand(-0.2, 0.2), s = U * 0.1;
          sparks.push({ x: p.x, y: p.y, vx: p.vx * 0.3 + Math.cos(a) * s, vy: p.vy * 0.3 + Math.sin(a) * s, age: 0, life: 0.6, col: p.col,
            size: p.size * 0.8, drag: 1.8, grav: 0.12, trail: [], tlen: 4, flicker: true, split: 0 });
        }
        p.age = p.life;   // the parent is used up
      }
      p.trail.push(p.x, p.y);
      if (p.trail.length > p.tlen * 2) p.trail.splice(0, 2);
      p.vx *= 1 - dt * p.drag; p.vy = p.vy * (1 - dt * p.drag) + U * p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    flashes = flashes.filter(f => (f.age += dt) < 0.5);
  }
  function drawSky(c) {
    c.save(); c.globalCompositeOperation = 'lighter';
    // the whole sky lights up for a moment
    for (const f of flashes) {
      const k = 1 - f.age / 0.5, R = api.UNIT * 0.4 * f.size;
      const g = c.createRadialGradient(f.x, f.y, 0, f.x, f.y, R);
      g.addColorStop(0, `rgba(255,245,230,${0.05 * k * k})`); g.addColorStop(1, 'rgba(255,245,230,0)');
      c.fillStyle = g; c.fillRect(f.x - R, f.y - R, R * 2, R * 2);
    }
    c.lineCap = 'round';
    for (const p of sparks) {
      const k = p.age / p.life;
      let a = (1 - k * k) * 0.8;
      if (p.flicker && k > 0.6 && Math.random() < 0.35) a *= 0.2;   // twinkle as they burn out
      const col = p.col;
      const tr = p.trail;
      if (tr.length >= 4) {
        c.strokeStyle = col; c.globalAlpha = a * 0.5; c.lineWidth = p.size;
        c.beginPath(); c.moveTo(tr[0], tr[1]);
        for (let i = 2; i < tr.length; i += 2) c.lineTo(tr[i], tr[i + 1]);
        c.lineTo(p.x, p.y); c.stroke();
      }
      const R = p.size * 2.6;
      c.globalAlpha = a; c.drawImage(glowSprite(col), p.x - R, p.y - R, R * 2, R * 2);
    }
    for (const r of rockets) {
      const R = api.UNIT * 0.012;
      c.globalAlpha = 1; c.drawImage(glowSprite('#ffe2a0'), r.x - R, r.y - R, R * 2, R * 2);
    }
    c.restore();
  }

  // ---------- Hills and trees in front, so rockets climb from behind them ----------
  let hills = [];
  function makeHills() {
    const W = api.W, H = api.H, U = api.UNIT;
    hills = [0.86, 0.92].map((base, layer) => {
      const p = new Path2D(), step = W / 60, ph = rand(0, 10);
      p.moveTo(0, H);
      for (let i = 0; i <= 60; i++) {
        const x = i * step, y = H * base - (Math.sin(i * 0.11 + ph) * 0.5 + Math.sin(i * 0.27 + ph * 2) * 0.25) * U * 0.05;
        p.lineTo(x, y);
        if (layer === 0 && Math.random() < 0.3) {   // little pine trees on the far hill
          const h = U * rand(0.025, 0.05), w = h * 0.4;
          p.lineTo(x - w, y); p.lineTo(x, y - h); p.lineTo(x + w, y); p.lineTo(x, y);
        }
      }
      p.lineTo(W, H); p.closePath();
      return p;
    });
  }
  const shade = (rgb, m) => `rgb(${rgb.map(v => Math.round(v * m)).join(',')})`;

  // stars for the background without the GPU
  let stars = [];

  const NIGHT = ['#ff3b4e', '#ff9f1c', '#ffd23f', '#3cff7e', '#2fc8ff', '#a77bff', '#ff5fd2', '#ffffff'];
  return {
    id: 'fireworks', order: 6, icon: '🎆', name: { en: 'Fireworks', es: 'Fuegos artificiales' },
    hint: {
      en: 'Touch the sky: a firework goes up and bursts right there. Hand still → fireflies come. Slap → two rockets.',
      es: 'Toca el cielo: sube un cohete y explota justo ahí. Mano quieta → llegan las luciérnagas. Golpe → dos cohetes.',
    },
    Critter: Firefly, size: 0.09, speed: 0.6, wander: 2.5, waves: false,
    particle: 'spark', particleColors: () => api.LOOK.palette, splashParticles: 6,

    // palette: burst colours · shapes · burst: size · density: sparks per burst · multi: share of two-colour bursts
    // boom: sound strength · every: seconds between rockets from one hand
    stages: [
      { bg: [4, 4, 8], light: [255, 255, 255], hill: [18, 18, 22], palette: ['#ffffff', '#ff2020'], shapes: ['peony', 'ring'],
        burst: 1.3, density: 0.6, multi: 0.5, boom: 0.5, every: 2, notes: false,
        looks: [{ glow: '#ffffff', core: '#ffffff' }] },
      { bg: [6, 10, 34], light: [180, 200, 255], hill: [8, 12, 30], palette: ['#ff2a2a', '#ffd200', '#2f8bff', '#ffffff'], shapes: ['peony', 'ring', 'heart'],
        burst: 1.2, density: 0.65, multi: 0.3, boom: 0.7, every: 1.8, notes: true,
        looks: [{ glow: '#ffe14d', core: '#fff3a0' }] },
      { bg: [8, 12, 40], light: [200, 210, 255], hill: [6, 10, 28], palette: NIGHT, shapes: ['peony', 'ring', 'heart', 'star', 'willow', 'crossette'],
        burst: 1, density: 0.7, multi: 0.35, boom: 0.9, every: 1.5, notes: true,
        looks: [{ glow: '#c8ff5a', core: '#f0ffb0' }, { glow: '#ffe14d', core: '#fff3a0' }] },
      { bg: [12, 10, 44], light: [220, 200, 255], hill: [8, 8, 30], palette: NIGHT, shapes: ['peony', 'ring', 'heart', 'star', 'willow', 'crossette', 'smile'],
        burst: 1, density: 0.75, multi: 0.6, boom: 1, every: 1.2, notes: true,
        looks: [{ glow: '#c8ff5a', core: '#f0ffb0' }, { glow: '#ffe14d', core: '#fff3a0' }, { glow: '#7af0ff', core: '#d8fbff' }, { glow: '#ff9ad8', core: '#ffe0f2' }] },
    ],
    spawn(n) { return Array.from({ length: Math.max(3, Math.round(n * 0.6)) }, () => new Firefly(pick(api.LOOK.looks))); },

    sound: { nibble() { bell(pick(PENTA.slice(5)), 0.3, 0.025); } },

    // a slap: two rockets side by side (a small finale, not a flood of light)
    onSplash(x, y) {
      for (let i = 0; i < 2; i++) setTimeout(() => launch(x + (i ? 0.12 : -0.12) * api.W, y + rand(-0.1, 0.05) * api.H, { size: rand(0.8, 1) }), i * 300);
    },

    decor: {
      init() { rockets.length = 0; sparks.length = 0; flashes = []; idle = 0; this.layout(); },
      layout() {
        makeHills();
        stars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.85, r: rand(0.4, 1.6), p: rand(0, 10) }));
      },
      draw(c, t, dt, hands) {
        // each hand sends up a rocket when it arrives somewhere new (or every few seconds if it stays)
        for (const h of hands) {
          h._fw = Math.max(0, (h._fw ?? 0) - dt);
          const moved = h._fwx == null || Math.hypot(h.x - h._fwx, h.y - h._fwy) > api.UNIT * 0.08;
          if (h._fw <= 0 && (moved || h._fwWait > 3)) { launch(h.x, h.y); h._fw = api.LOOK.every; h._fwx = h.x; h._fwy = h.y; h._fwWait = 0; }
          h._fwWait = (h._fwWait || 0) + dt;
        }
        idle = hands.length ? 0 : idle + dt;
        if (idle > 6 && (nextAuto -= dt) <= 0) { launch(rand(0.15, 0.85) * api.W, rand(0.2, 0.5) * api.H); nextAuto = rand(6, 10); }
        updateSky(dt);
        drawSky(c);
        const hill = api.LOOK.hill, k = 0.5 + 0.5 * api.S.bgGlow;
        c.fillStyle = shade(hill, k * 1.6); c.fill(hills[0]);
        c.fillStyle = shade(hill, k * 0.8); c.fill(hills[1]);
      },
    },

    draw2D(c, t) {
      const W = api.W, H = api.H, k = 0.35 + 0.65 * api.S.bgGlow, bg = api.LOOK.bg;
      const g = c.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, shade(bg, k * 0.7)); g.addColorStop(1, shade(bg, k * 2.2));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (const s of stars) {
        c.fillStyle = `rgba(255,255,255,${(0.35 + 0.35 * Math.sin(t * 1.5 + s.p)) * api.S.bgGlow})`;
        c.beginPath(); c.arc(s.x * W, s.y * H, s.r, 0, TAU); c.fill();
      }
    },
    // GPU background: a night sky, lighter near the horizon, with twinkling stars
    shader: {
      background: `
        col = mix(base * 2.2, base * 0.6, smoothstep(0.0, 1.0, vUv.y));
        // (names start with st so they don't clash with the engine's own variables)
        vec2 stG = p * 70.0, stId = floor(stG), stF = fract(stG) - 0.5;
        float stOn = step(0.965, hash(stId));
        vec2 stO = (vec2(hash(stId + 1.3), hash(stId + 7.7)) - 0.5) * 0.6;
        float stTw = 0.5 + 0.5 * sin(uT * (1.0 + 2.0 * hash(stId + 3.1)) + hash(stId) * 6.28);
        col += light * stOn * smoothstep(0.12, 0.0, length(stF - stO)) * (0.35 + 0.65 * stTw) * (0.4 + 0.6 * uGlow) * smoothstep(0.1, 0.4, vUv.y);`,
    },
  };
}
