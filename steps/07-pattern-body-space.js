// 第 7 步：用身体坐标生成花纹
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 花纹不能只画在屏幕坐标里，它要绑定在身体坐标上。先缓存一组 s 和 u，再每帧转换到当前鱼身上。
// @koi-pattern-cache: 生成并缓存花纹点。 花纹不会每帧闪烁。
// @koi-body-coordinate: 把 s 和 u 转成画布点。 花纹跟着身体弯曲。
// @koi-body-clip: 把后续绘制裁剪在鱼身内。 红色斑块不会溢出身体。
// @koi-pattern-dot: 按缓存半径画斑块。 形成连片的锦鲤花纹。

const count = 20,
  segment = 10.5,
  maxBend = 0.38,
  dt = 1 / 60;

const widths = [
  26, 29, 30, 30, 29, 27, 25, 23, 21, 18, 16, 13, 11, 9, 7, 5, 4, 4, 3, 3,
];

const tailFollowRate = 7.2,
  patternThreshold = 0.56;

let joints = [],
  heading = 0.1,
  speed = 58,
  phase = 0,
  acc = 0,
  time = 0,
  cache = null,
  tailAngle = 0,
  turnSignal = 0;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function setup() {
  createCanvas(600, 360);
  randomSeed(13);
  noiseSeed(13);
  joints = Array.from({ length: count }, (_, i) =>
    createVector(260 - segment * i, 180),
  );
  cache = makePattern();
}

function draw() {
  noStroke();
  background(16, 78, 69);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  }
  drawKoi(wavePoints());
}

function headings(list = joints) {
  return list.map((joint, i) =>
    i === 0
      ? heading
      : Math.atan2(list[i - 1].y - joint.y, list[i - 1].x - joint.x),
  );
}

function follow(head) {
  joints[0] = head;
  for (let i = 1; i < count; i += 1) {
    const anchor = joints[i - 1],
      prev =
        i === 1
          ? heading
          : Math.atan2(joints[i - 2].y - anchor.y, joints[i - 2].x - anchor.x);
    let current = Math.atan2(anchor.y - joints[i].y, anchor.x - joints[i].x);
    current = prev + constrain(wrapAngle(current - prev), -maxBend, maxBend);
    joints[i] = createVector(
      anchor.x - Math.cos(current) * segment,
      anchor.y - Math.sin(current) * segment,
    );
  }
}

function makePattern() {
  const dots = [];
  for (let s = 0; s <= count - 2; s += 0.55)
    for (let u = -1.1; u <= 1.1; u += 0.3) {
      const n = noise(s * 0.21 + 3.1, u * 0.55 + 7.2, 4);
      if (n > patternThreshold)
        dots.push([s, u, 0.6 + (n - patternThreshold) * 2.2]); // @koi-pattern-cache
    }
  return dots;
}

function bodyPoint(points, h, s, u) {
  const i = constrain(Math.floor(s), 0, count - 2),
    f = s - i;
  const x = lerp(points[i].x, points[i + 1].x, f),
    y = lerp(points[i].y, points[i + 1].y, f);
  const w = lerp(widths[i], widths[i + 1], f),
    a = h[i] + HALF_PI;
  return createVector(x + Math.cos(a) * u * w, y + Math.sin(a) * u * w); // @koi-body-coordinate
}

function stepSim() {
  time += dt;
  const target = createVector(
    120 + noise(time * 0.12) * 360,
    75 + noise(time * 0.12 + 8) * 210,
  );
  heading += constrain(
    wrapAngle(
      Math.atan2(target.y - joints[0].y, target.x - joints[0].x) - heading,
    ),
    -0.9 * dt,
    0.9 * dt,
  );
  follow(
    createVector(
      joints[0].x + Math.cos(heading) * speed * dt,
      joints[0].y + Math.sin(heading) * speed * dt,
    ),
  );
  phase += (2.6 + speed * 0.03) * dt;
  const h = headings();
  tailAngle +=
    wrapAngle(h[count - 1] - tailAngle) * Math.min(1, dt * tailFollowRate);
  turnSignal +=
    (wrapAngle(heading - h[8]) - turnSignal) * Math.min(1, dt * 3.6);
}

function wavePoints() {
  const h = headings();
  return joints.map((joint, i) => {
    const w =
      7 *
      (0.6 + speed * 0.006) *
      (0.15 + Math.pow(i / count, 1.5)) *
      Math.sin(i * 0.55 - phase);
    const a = h[i] + HALF_PI;
    return createVector(joint.x + Math.cos(a) * w, joint.y + Math.sin(a) * w);
  });
}

function smoothPath(points) {
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

function bodyPath(points, h) {
  const pts = [];
  for (let i = 0; i < count; i += 1)
    pts.push({
      x: points[i].x + Math.cos(h[i] + HALF_PI) * widths[i],
      y: points[i].y + Math.sin(h[i] + HALF_PI) * widths[i],
    });
  for (let i = count - 1; i >= 0; i -= 1)
    pts.push({
      x: points[i].x + Math.cos(h[i] - HALF_PI) * widths[i],
      y: points[i].y + Math.sin(h[i] - HALF_PI) * widths[i],
    });
  // 头前补圆弧，眼睛落在吻部轮廓内部。
  pts.push(...snoutPoints(points[0], h[0]));
  return smoothPath(pts);
}

function drawTail(points) {
  const tailBase = points[count - 1],
    tailDir = tailAngle + Math.PI;
  const at = (a, r) => [
    tailBase.x + Math.cos(tailDir + a) * r,
    tailBase.y + Math.sin(tailDir + a) * r,
  ];
  const path = new Path2D();
  path.moveTo(tailBase.x, tailBase.y);
  path.bezierCurveTo(...at(0.35, 30), ...at(0.52, 58), ...at(0.47, 72));
  path.quadraticCurveTo(...at(0, 42), ...at(-0.47, 72));
  path.bezierCurveTo(
    ...at(-0.52, 58),
    ...at(-0.35, 30),
    tailBase.x,
    tailBase.y,
  );
  path.closePath();
  fill("rgba(255,236,220,0.45)");
  drawingContext.fill(path);
}

function drawFin(points, h, i, side, len, spread) {
  const a = h[i] + side * HALF_PI;
  push();
  translate(
    points[i].x + Math.cos(a) * widths[i] * 0.86,
    points[i].y + Math.sin(a) * widths[i] * 0.86,
  );
  rotate(h[i] + Math.PI - side * spread);
  fill(255, 240, 230, 105);
  ellipse(len / 2, 0, len, len * 0.43);
  pop();
}

function drawKoi(points) {
  const h = headings(points);
  drawTail(points);
  drawFin(points, h, 3, 1, 44, 0.95 - turnSignal * 1.6);
  drawFin(points, h, 3, -1, 44, 0.95 + turnSignal * 1.6);
  drawFin(points, h, 10, 1, 25, 0.75);
  drawFin(points, h, 10, -1, 25, 0.75);
  const path = bodyPath(points, h);
  fill("#f6efe6");
  drawingContext.fill(path);
  drawingContext.save();
  drawingContext.clip(path); // @koi-body-clip
  fill("#d5321c");
  for (const dotValue of cache) {
    const b = bodyPoint(points, h, dotValue[0], dotValue[1]);
    circle(b.x, b.y, (widths[0] * 0.18 + 8) * dotValue[2]); // @koi-pattern-dot
  }
  drawingContext.restore();
  fill(20);
  for (const side of [-1, 1])
    circle(
      points[0].x + Math.cos(h[0]) * 12 + Math.cos(h[0] + side * HALF_PI) * 16,
      points[0].y + Math.sin(h[0]) * 12 + Math.sin(h[0] + side * HALF_PI) * 16,
      7,
    );
}

// 沿头部前方的半圆取点，连接左右边缘。
function snoutPoints(head, direction) {
  const points = [];
  for (let k = -2; k <= 2; k++) {
    const angle = direction + (k * Math.PI) / 5;
    const radius = widths[0] * (k === 0 ? 1.25 : 1.1);
    points.push({
      x: head.x + Math.cos(angle) * radius,
      y: head.y + Math.sin(angle) * radius,
    });
  }
  return points;
}
