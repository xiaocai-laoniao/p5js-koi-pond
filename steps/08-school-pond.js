// 第 8 步：八条锦鲤组成一池鱼
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 最终把单鱼复制成八条。分离、对齐、聚合、游荡和边界回避合在一起，再加池水、荷叶、阴影和不同花色，形成完整池塘作品。
// @koi-separation: 距离过近时累积分离向量。 鱼群不会挤成一团。
// @koi-align: 把邻居朝向加入当前方向。 鱼群的游向会逐渐协调。
// @koi-cohesion: 朝邻居中心轻微靠拢。 鱼群保持松散聚集。
// @koi-boundary-vector: 接近边界时得到回避向量。 鱼会绕回池塘中间。
// @koi-render-wave: 行波只用于本帧绘制点。 群游时身体摆动仍不破坏约束。
// @koi-school-fixed-step: 整池鱼使用固定步长更新。 多鱼模拟在不同帧率下保持稳定。

const NJ = 20,
  dt = 1 / 60,
  HP = Math.PI / 2,
  TAUValue = Math.PI * 2;

const BW = [
  52, 58, 60, 60, 58, 55, 51, 47, 42, 37, 32, 27, 22, 18, 14, 11, 9, 8, 7, 6,
];

const PAL = {
  kohaku: {
    base: "#f6efe6",
    layers: [{ c: "#d5321c", thr: 0.5, off: 0 }],
    fin: "rgba(255,246,238,0.42)",
  },
  sanke: {
    base: "#f6efe6",
    layers: [
      { c: "#d63a1f", thr: 0.52, off: 0 },
      { c: "#1d1b1e", thr: 0.64, off: 7, r: 0.6 },
    ],
    fin: "rgba(255,246,238,0.42)",
  },
  showa: {
    base: "#1c1a1d",
    layers: [
      { c: "#f3ece2", thr: 0.5, off: 3 },
      { c: "#d0331d", thr: 0.55, off: 11 },
    ],
    fin: "rgba(235,232,228,0.36)",
  },
  ogon: {
    base: "#e6ad38",
    layers: [{ c: "#f8d97c", thr: 0.58, off: 5 }],
    fin: "rgba(255,224,140,0.45)",
  },
  shiro: {
    base: "#f2ede4",
    layers: [{ c: "#1c1b1f", thr: 0.53, off: 9 }],
    fin: "rgba(240,238,232,0.4)",
  },
  hi: {
    base: "#e2552b",
    layers: [{ c: "#f7b23e", thr: 0.6, off: 4 }],
    fin: "rgba(255,190,150,0.42)",
  },
};

const separationDistance = 140,
  neighborDistance = 320;

let fish = [],
  pads = [],
  petals = [],
  pebbles = [],
  acc = 0,
  time = 0,
  caustic,
  causticData,
  causticStamp = -1;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

const mixValue = (a, b, k) => a + (b - a) * k;

const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

class Fish {
  constructor(o) {
    Object.assign(
      this,
      {
        x: 0,
        y: 0,
        sc: 1,
        pal: "kohaku",
        seed: 1,
        maxBend: 0.38,
        ang: 0,
        v: 80,
        phase: 0,
        turnS: 0,
        ampK: 1,
        omega: 4,
      },
      o,
    );
    this.base = this.v;
    this.L = 15 * this.sc;
    this.j = [];
    this.tailA = this.ang;
    this.cache = {};
    for (let i = 0; i < NJ; i += 1)
      this.j.push({
        x: this.x - Math.cos(this.ang) * i * this.L,
        y: this.y - Math.sin(this.ang) * i * this.L,
      });
  }
  follow() {
    const J = this.j;
    for (let i = 1; i < NJ; i += 1) {
      const a = J[i - 1],
        b = J[i];
      let cur = Math.atan2(a.y - b.y, a.x - b.x);
      const prev =
        i === 1 ? this.ang : Math.atan2(J[i - 2].y - a.y, J[i - 2].x - a.x);
      let d = wrapAngle(cur - prev);
      d = Math.max(-this.maxBend, Math.min(this.maxBend, d));
      cur = prev + d;
      b.x = a.x - Math.cos(cur) * this.L;
      b.y = a.y - Math.sin(cur) * this.L;
    }
  }
  wo(i) {
    const e = 0.15 + Math.pow(i / NJ, 1.5);
    return 7 * this.sc * this.ampK * e * Math.sin(i * 0.55 - this.phase);
  }
  post(stepValue) {
    this.omega = 2.6 + this.v * 0.03;
    this.ampK = 0.6 + this.v * 0.006;
    this.phase += this.omega * stepValue;
    const n = NJ,
      J = this.j;
    let tg = Math.atan2(J[n - 2].y - J[n - 1].y, J[n - 2].x - J[n - 1].x);
    tg += Math.atan2(this.wo(n - 2) - this.wo(n - 1), this.L);
    this.tailA += wrapAngle(tg - this.tailA) * Math.min(1, stepValue * 6);
    const h8 = Math.atan2(J[7].y - J[8].y, J[7].x - J[8].x);
    this.turnS +=
      (wrapAngle(this.ang - h8) - this.turnS) * Math.min(1, stepValue * 4);
  }
  update(stepValue2, des, goal, rate) {
    let d = wrapAngle(des - this.ang);
    const m = rate * stepValue2;
    d = Math.max(-m, Math.min(m, d));
    this.ang += d; // @koi-school-turn
    this.v += (goal - this.v) * Math.min(1, stepValue2 * 1.2);
    const h = this.j[0];
    h.x += Math.cos(this.ang) * this.v * stepValue2;
    h.y += Math.sin(this.ang) * this.v * stepValue2;
    this.follow();
    this.post(stepValue2);
  }
}

function setup() {
  createCanvas(600, 360);
  randomSeed(14);
  noiseSeed(14);
  initDecor();
  const keys = [
    "kohaku",
    "sanke",
    "showa",
    "ogon",
    "shiro",
    "kohaku",
    "hi",
    "sanke",
  ];
  fish = Array.from(
    { length: 8 },
    (_, i) =>
      new Fish({
        x: 300 + hash(i + 1) * 1320,
        y: 230 + hash(i + 2) * 620,
        ang: hash(i + 3) * TAUValue,
        sc: 0.78 + hash(i + 4) * 0.28,
        pal: keys[i],
        seed: 10 + i,
        v: 70,
      }),
  );
}

function draw() {
  background(0);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  } // @koi-school-fixed-step
  push();
  scale(600 / 1920, 360 / 1080);
  drawPool();
  for (const f of fish) drawFish(f);
  drawSurface(time, 1920);
  pop();
}

function geo(f) {
  const P = [],
    H = [],
    W = [],
    Hr = [];
  for (let i = 0; i < NJ; i += 1)
    Hr[i] =
      i === 0
        ? f.ang
        : Math.atan2(f.j[i - 1].y - f.j[i].y, f.j[i - 1].x - f.j[i].x);
  for (let i = 0; i < NJ; i += 1) {
    const o = f.wo(i),
      a = Hr[i] + HP;
    P.push({ x: f.j[i].x + Math.cos(a) * o, y: f.j[i].y + Math.sin(a) * o });
    W.push(BW[i] * 0.5 * f.sc);
  } // @koi-render-wave
  for (let i = 0; i < NJ; i += 1)
    H[i] =
      i === 0
        ? Math.atan2(P[0].y - P[1].y, P[0].x - P[1].x)
        : Math.atan2(P[i - 1].y - P[i].y, P[i - 1].x - P[i].x);
  return { P, H, W, Hr };
}

function outline(g, snout = true) {
  const { P, H, W } = g,
    out = [];
  for (let i = 0; i < NJ; i += 1) {
    const a = H[i] + HP;
    out.push({
      x: P[i].x + Math.cos(a) * W[i],
      y: P[i].y + Math.sin(a) * W[i],
    });
  }
  out.push({
    x: P[NJ - 1].x - Math.cos(H[NJ - 1]) * W[NJ - 1] * 0.9,
    y: P[NJ - 1].y - Math.sin(H[NJ - 1]) * W[NJ - 1] * 0.9,
  });
  for (let i = NJ - 1; i >= 0; i -= 1) {
    const a = H[i] - HP;
    out.push({
      x: P[i].x + Math.cos(a) * W[i],
      y: P[i].y + Math.sin(a) * W[i],
    });
  }
  if (snout)
    for (let k = -2; k <= 2; k += 1) {
      const a = H[0] + (k * Math.PI) / 5,
        r = W[0] * (k === 0 ? 1.25 : 1.06);
      out.push({ x: P[0].x + Math.cos(a) * r, y: P[0].y + Math.sin(a) * r });
    }
  return out;
}

function crPath(points) {
  const path = new Path2D();
  path.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length; i += 1) {
    const a = points[(i - 1 + points.length) % points.length],
      b = points[i],
      c = points[(i + 1) % points.length],
      d = points[(i + 2) % points.length];
    path.bezierCurveTo(
      b.x + (c.x - a.x) / 6,
      b.y + (c.y - a.y) / 6,
      c.x - (d.x - b.x) / 6,
      c.y - (d.y - b.y) / 6,
      c.x,
      c.y,
    );
  }
  path.closePath();
  return path;
}

function fillPath(path, colorValue) {
  drawingContext.fillStyle = colorValue;
  drawingContext.fill(path);
}

function finShapes(f, g) {
  const res = [],
    tr = f.turnS;
  for (const [i, len0, sp, k, wr] of [
    [3, 42, 0.95, 1.6, 0.46],
    [10, 25, 0.75, 0.6, 0.42],
  ])
    for (const side of [1, -1]) {
      const len = len0 * f.sc,
        a = g.H[i] + side * HP;
      const spread = Math.max(
        0.25,
        Math.min(
          1.5,
          sp - side * tr * k + Math.sin(f.phase * 0.5 + side) * 0.05,
        ),
      );
      res.push({
        bx: g.P[i].x + Math.cos(a) * g.W[i] * 0.85,
        by: g.P[i].y + Math.sin(a) * g.W[i] * 0.85,
        ang: g.H[i] + Math.PI - side * spread,
        len,
        ry: len * wr * 0.5,
      });
    }
  return res;
}

function drawFin(fs, colorValue2) {
  push();
  translate(fs.bx, fs.by);
  rotate(fs.ang);
  fill(colorValue2);
  noStroke();
  ellipse(fs.len * 0.5, 0, fs.len, fs.ry * 2);
  stroke(255, 255, 255, 70);
  for (let k = -4; k <= 4; k += 1)
    line(
      fs.len * 0.04,
      0,
      fs.len * 0.5 + fs.len * 0.46 * Math.cos((k / 4) * 1.25),
      fs.ry * 0.95 * Math.sin((k / 4) * 1.25),
    );
  pop(); // @koi-fin-outer
}

function drawTail(f, g) {
  const b = g.P[NJ - 1],
    d = f.tailA + Math.PI,
    len = 78 * f.sc,
    ft = Math.sin(f.phase * 1.1) * 0.1;
  const at = (da, r) => [
    b.x + Math.cos(d + da + ft) * r,
    b.y + Math.sin(d + da + ft) * r,
  ];
  const path = new Path2D();
  path.moveTo(b.x, b.y);
  path.bezierCurveTo(
    ...at(0.35, len * 0.45),
    ...at(0.52, len * 0.85),
    ...at(0.47, len),
  );
  path.quadraticCurveTo(...at(0, len * 0.55), ...at(-0.47, len));
  path.bezierCurveTo(
    ...at(-0.52, len * 0.85),
    ...at(-0.35, len * 0.45),
    b.x,
    b.y,
  );
  path.closePath();
  fillPath(path, PAL[f.pal].fin); // @koi-tail-draw
}

function blobs(f, keyValue) {
  if (f.cache[keyValue]) return f.cache[keyValue];
  const pal = PAL[keyValue];
  const out = pal.layers.map((L) => {
    const arr = [];
    for (let s = 0; s <= NJ - 2; s += 0.55)
      for (let u = -1.1; u <= 1.1; u += 0.3) {
        const nv = noise(
          s * 0.21 + f.seed * 3.1 + L.off,
          u * 0.55 + L.off * 1.7 + f.seed,
        );
        if (nv > L.thr)
          arr.push([s, u, (L.r || 1) * (0.6 + (nv - L.thr) * 2.2)]); // @koi-cache-on-fish
      }
    return arr;
  });
  f.cache[keyValue] = out;
  return out;
}

function drawBlobs(f, g, keyValue2) {
  const pal = PAL[keyValue2],
    B = blobs(f, keyValue2);
  pal.layers.forEach((L, li) => {
    fill(L.c);
    noStroke();
    for (const b of B[li]) {
      const i = Math.min(Math.floor(b[0]), NJ - 2),
        fr = b[0] - i,
        w = mixValue(g.W[i], g.W[i + 1], fr),
        a = g.H[i] + HP;
      const x = mixValue(g.P[i].x, g.P[i + 1].x, fr) + Math.cos(a) * b[1] * w;
      const y = mixValue(g.P[i].y, g.P[i + 1].y, fr) + Math.sin(a) * b[1] * w;
      circle(x, y, (w * 0.6 + g.W[0] * 0.14) * b[2]);
    }
  });
}

function drawDorsal(f, g) {
  const pts = [];
  for (let i = 3; i <= 12; i += 1) pts.push({ x: g.P[i].x, y: g.P[i].y });
  for (let i = 12; i >= 3; i -= 1) {
    const t = (i - 3) / 9,
      wd = 8 * f.sc * Math.sin(Math.PI * Math.pow(t, 0.8)) + 0.5,
      a = g.H[i] + HP;
    pts.push({
      x: g.P[i].x + Math.cos(a) * wd * 0.6,
      y: g.P[i].y + Math.sin(a) * wd * 0.6,
    });
  }
  fillPath(crPath(pts), PAL[f.pal].fin);
}

function drawFish(f) {
  const g = geo(f),
    pal = PAL[f.pal],
    body = outline(g, true),
    bodyPath = crPath(body),
    c = drawingContext;
  push();
  translate(14 + 10 * f.sc, 20 + 12 * f.sc);
  fillPath(bodyPath, "rgba(0,12,9,0.28)");
  pop();
  for (const fs of finShapes(f, g).reverse()) drawFin(fs, pal.fin);
  drawTail(f, g);
  c.fillStyle = pal.base;
  c.fill(bodyPath);
  c.save();
  c.clip(bodyPath);
  drawBlobs(f, g, f.pal);
  c.lineJoin = "round";
  c.strokeStyle = "rgba(0,0,0,0.17)";
  c.lineWidth = g.W[0] * 0.55;
  c.stroke(bodyPath);
  const hi = new Path2D();
  hi.moveTo(g.P[0].x - 2 * f.sc, g.P[0].y - 3 * f.sc);
  for (let i = 1; i < 14; i += 1)
    hi.lineTo(g.P[i].x - 2 * f.sc, g.P[i].y - 3 * f.sc);
  c.lineCap = "round";
  c.strokeStyle = "rgba(255,255,255,0.13)";
  c.lineWidth = g.W[3] * 0.55;
  c.stroke(hi);
  c.strokeStyle = "rgba(255,255,255,0.15)";
  c.lineWidth = g.W[3] * 0.18;
  c.stroke(hi);
  c.restore();
  c.strokeStyle = "rgba(0,0,0,0.22)";
  c.lineWidth = 1;
  c.stroke(bodyPath);
  drawDorsal(f, g);
  noStroke();
  fill(18, 16, 20);
  for (const side of [1, -1]) {
    const ex =
        g.P[0].x +
        Math.cos(g.H[0]) * g.W[0] * 0.45 +
        Math.cos(g.H[0] + side * HP) * g.W[0] * 0.62,
      ey =
        g.P[0].y +
        Math.sin(g.H[0]) * g.W[0] * 0.45 +
        Math.sin(g.H[0] + side * HP) * g.W[0] * 0.62;
    circle(ex, ey, g.W[0] * 0.16);
    fill(255, 255, 255, 220);
    circle(ex - 1, ey - 1, g.W[0] * 0.06);
    fill(18, 16, 20);
  }
}

function boundary(head) {
  const b = { x0: 140, x1: 1780, y0: 160, y1: 920 },
    m = 170;
  let x = 0,
    y = 0;
  if (head.x < b.x0 + m) x += (b.x0 + m - head.x) / m;
  if (head.x > b.x1 - m) x -= (head.x - b.x1 + m) / m;
  if (head.y < b.y0 + m) y += (b.y0 + m - head.y) / m;
  if (head.y > b.y1 - m) y -= (head.y - b.y1 + m) / m;
  return { x, y }; // @koi-boundary-vector
}

function flock(f) {
  let sx = 0,
    sy = 0,
    ax = 0,
    ay = 0,
    cx = 0,
    cy = 0,
    n = 0,
    h = f.j[0];
  for (const o of fish) {
    if (o === f) continue;
    const dx = h.x - o.j[0].x,
      dy = h.y - o.j[0].y,
      d = Math.hypot(dx, dy) || 1;
    if (d > neighborDistance) continue;
    if (d < separationDistance) {
      sx += ((dx / d) * (separationDistance - d)) / separationDistance;
      sy += ((dy / d) * (separationDistance - d)) / separationDistance;
    } // @koi-separation
    ax += Math.cos(o.ang);
    ay += Math.sin(o.ang);
    cx += o.j[0].x;
    cy += o.j[0].y;
    n += 1;
  }
  const wa = f.ang + (noise(f.seed * 9.7, time * 0.22) - 0.5) * 2.2;
  let vx = Math.cos(wa),
    vy = Math.sin(wa);
  if (n) {
    vx += (ax / n) * 0.5;
    vy += (ay / n) * 0.5;
    const tx = cx / n - h.x,
      ty = cy / n - h.y,
      td = Math.hypot(tx, ty) || 1;
    vx += (tx / td) * 0.35;
    vy += (ty / td) * 0.35;
  } // @koi-align @koi-cohesion
  const bv = boundary(h);
  vx += sx * 2.2 + bv.x * 4;
  vy += sy * 2.2 + bv.y * 4;
  return Math.atan2(vy, vx);
}

function stepSim() {
  time += dt;
  for (const f of fish)
    f.update(dt, flock(f), 60 + 40 * noise(f.seed * 3, time * 0.15), 1.0);
}

function initDecor() {
  pebbles = [];
  for (let i = 0; i < 110; i += 1)
    pebbles.push({
      x: hash(i) * 1920,
      y: hash(i + 0.4) * 1080,
      rx: 8 + hash(i + 1) * 28,
      ry: 6 + hash(i + 2) * 18,
      r: hash(i + 3) * TAUValue,
      a: 0.1 + hash(i + 4) * 0.18,
    });
  pads = [
    [110, 170, 90, 1],
    [1010, 110, 70, 0],
    [70, 930, 95, 0],
    [1090, 980, 80, 1],
    [560, 1040, 60, 0],
    [1480, 180, 85, 1],
    [1780, 830, 100, 0],
    [1350, 640, 70, 1],
    [1840, 400, 65, 0],
  ].map((pad, i) => ({
    x: pad[0],
    y: pad[1],
    r: pad[2],
    flower: Boolean(pad[3]),
    rot: hash(i + 60) * TAUValue,
    ph: hash(i + 70) * TAUValue,
  }));
  petals = Array.from({ length: 16 }, (_, i) => ({
    x: hash(i + 20) * 1920,
    y: hash(i + 21) * 1080,
    vx: 4 + hash(i + 22) * 8,
    vy: -4 + hash(i + 23) * 8,
    s: 5 + hash(i + 24) * 4,
    rot: hash(i + 25) * TAUValue,
    sp: hash(i + 26) * 0.8 - 0.4,
  }));
  caustic = createGraphics(160, 90);
  caustic.pixelDensity(1);
  causticData = caustic.drawingContext.createImageData(160, 90);
}

function updateCaustic() {
  const stamp = Math.floor(time * 15);
  if (stamp === causticStamp) return;
  causticStamp = stamp;
  const pixelsValue = causticData.data;
  for (let y = 0; y < 90; y += 1)
    for (let x = 0; x < 160; x += 1) {
      const a = Math.sin(
        x * 0.21 + time * 0.7 + Math.sin(y * 0.13 + time * 0.3) * 2,
      );
      const b = Math.sin(
        y * 0.25 - time * 0.5 + Math.sin(x * 0.11 - time * 0.4) * 2.2,
      );
      const c = Math.sin((x + y) * 0.12 + time * 0.9);
      const glow = Math.pow(1 - Math.abs(a + b + c) / 3, 7),
        i = (y * 160 + x) * 4;
      pixelsValue[i] = 190;
      pixelsValue[i + 1] = 255;
      pixelsValue[i + 2] = 230;
      pixelsValue[i + 3] = glow * 110;
    }
  caustic.drawingContext.putImageData(causticData, 0, 0);
}

function drawPool() {
  const c = drawingContext,
    g = c.createLinearGradient(0, 0, 760, 1080);
  g.addColorStop(0, "#2a8f84");
  g.addColorStop(0.5, "#1f7a6c");
  g.addColorStop(1, "#16604f");
  c.fillStyle = g;
  c.fillRect(0, 0, 1920, 1080);
  noStroke();
  for (const peb of pebbles) {
    push();
    translate(peb.x, peb.y);
    rotate(peb.r);
    fill(45, 80, 65, peb.a * 255);
    ellipse(0, 0, peb.rx * 2, peb.ry * 2);
    pop();
  }
  updateCaustic();
  c.save();
  c.globalCompositeOperation = "lighter";
  c.imageSmoothingEnabled = true;
  c.drawImage(caustic.elt, 0, 0, 1920, 1080);
  c.restore();
}

function drawLotus(c, s) {
  const L = [
    [10, 1.0, "#f2bccb", 0],
    [8, 0.74, "#f7d3dd", 0.3],
    [6, 0.5, "#fde9ee", 0.1],
  ];
  for (const [n, k, col, o] of L) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAUValue + o;
      const len = s * k;
      c.save();
      c.rotate(a);
      c.beginPath();
      c.ellipse(len * 0.5, 0, len * 0.5, len * 0.22, 0, 0, TAUValue);
      c.fillStyle = col;
      c.fill();
      c.strokeStyle = "rgba(214,130,155,0.5)";
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }
  }
  c.fillStyle = "#f0c445";
  c.beginPath();
  c.arc(0, 0, s * 0.17, 0, TAUValue);
  c.fill();
  c.fillStyle = "#d99a2a";
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAUValue;
    c.beginPath();
    c.arc(
      Math.cos(a) * s * 0.09,
      Math.sin(a) * s * 0.09,
      s * 0.025,
      0,
      TAUValue,
    );
    c.fill();
  }
}

function drawPad(c, p, t) {
  const x = p.x + Math.sin(t * 0.031 + p.ph) * 28,
    y = p.y + Math.cos(t * 0.027 + p.ph) * 18,
    rot = p.rot + Math.sin(t * 0.04 + p.ph) * 0.25,
    r = p.r;
  c.save();
  c.translate(x, y);
  c.rotate(rot);
  c.fillStyle = "rgba(0,12,8,0.33)";
  c.beginPath();
  c.moveTo(16, 22);
  c.arc(16, 22, r, 0.22, TAUValue - 0.22);
  c.closePath();
  c.fill();
  const g = c.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#6aa356");
  g.addColorStop(1, "#2d6036");
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(0, 0);
  c.arc(0, 0, r, 0.22, TAUValue - 0.22);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(170,215,140,0.35)";
  c.lineWidth = 2;
  c.stroke();
  c.strokeStyle = "rgba(180,225,150,0.17)";
  c.lineWidth = 1.2;
  c.beginPath();
  for (let k = 1; k < 12; k++) {
    const a = 0.22 + ((TAUValue - 0.44) * k) / 12;
    c.moveTo(0, 0);
    c.lineTo(Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92);
  }
  c.stroke();
  c.fillStyle = "rgba(255,255,255,0.08)";
  c.beginPath();
  c.ellipse(-r * 0.3, -r * 0.35, r * 0.35, r * 0.13, -0.6, 0, TAUValue);
  c.fill();
  if (p.flower) {
    c.save();
    c.translate(r * 0.25, -r * 0.15);
    c.fillStyle = "rgba(0,10,6,0.25)";
    c.beginPath();
    c.arc(8, 10, r * 0.42, 0, TAUValue);
    c.fill();
    drawLotus(c, r * 0.45);
    c.restore();
  }
  c.restore();
}

function drawSurface(t, VW) {
  const c = drawingContext;
  c.save();
  c.globalCompositeOperation = "lighter";
  for (let i = 0; i < 3; i++) {
    const x = 300 + i * 600 + Math.sin(t * 0.05 + i * 2) * 160,
      y = 260 + i * 230 + Math.cos(t * 0.04 + i) * 90,
      r = 260 + i * 40;
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "rgba(200,240,255,0.07)");
    g.addColorStop(1, "rgba(200,240,255,0)");
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(x, y, r, r * 0.6, 0.4, 0, TAUValue);
    c.fill();
  }
  c.restore();
  // ripples
  const P = 2.4,
    k0 = Math.floor(t / P);
  for (let k = k0 - 2; k <= k0; k++) {
    if (k < 0) continue;
    const age = t - k * P;
    if (age < 0 || age > 4) continue;
    const x = 40 + hash(k) * (Math.min(VW, 1920) - 80),
      y = 90 + hash(k + 0.37) * 900;
    const a = (1 - age / 4) * 0.4;
    c.strokeStyle = `rgba(220,250,245,${a})`;
    c.lineWidth = 2;
    for (const m of [1, 0.68, 0.4]) {
      const r = age * 58 * m;
      if (r < 2) continue;
      c.beginPath();
      c.ellipse(x, y, r, r * 0.92, 0, 0, TAUValue);
      c.stroke();
    }
  }
  for (const p of pads) drawPad(c, p, t);
  for (const p of petals) {
    const x = ((((p.x + t * p.vx) % 2000) + 2000) % 2000) - 40,
      y =
        ((((p.y + t * p.vy + Math.sin(t * 0.3 + p.rot) * 10) % 1120) + 1120) %
          1120) -
        20;
    c.save();
    c.translate(x, y);
    c.rotate(p.rot + t * p.sp);
    c.fillStyle = "rgba(0,10,8,0.2)";
    c.beginPath();
    c.ellipse(4, 6, p.s, p.s * 0.5, 0, 0, TAUValue);
    c.fill();
    c.fillStyle = "rgba(246,190,204,0.9)";
    c.beginPath();
    c.ellipse(0, 0, p.s, p.s * 0.5, 0, 0, TAUValue);
    c.fill();
    c.restore();
  }
  const g = c.createRadialGradient(
    VW / 2,
    540,
    300,
    VW / 2,
    540,
    Math.max(VW, 1080) * 0.78,
  );
  g.addColorStop(0, "rgba(0,10,8,0)");
  g.addColorStop(1, "rgba(0,10,8,0.55)");
  c.fillStyle = g;
  c.fillRect(0, 0, VW, 1080);
}
