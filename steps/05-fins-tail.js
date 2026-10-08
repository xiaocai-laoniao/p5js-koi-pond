// 第 5 步：鳍和尾巴慢半拍跟随
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 胸鳍、腹鳍和尾鳍都依附在脊柱上。尾鳍每帧只追上目标角度的一部分，画面会有柔软的滞后感。
// @koi-fin-spread: 按身体方向旋转鳍片。 鳍会贴着鱼身边缘向后展开。
// @koi-tail-lag: 尾鳍按 tailFollowRate 追随尾部方向。 尾巴慢半拍，看起来更柔软。
// @koi-tail-shape: 用贝塞尔和二次曲线画叉形尾鳍。 尾部从简单线段变成半透明鱼尾。
// @koi-fin-outer: 外侧胸鳍随转弯张开。 转向时左右鳍有不同姿态。

const count = 20,
  segment = 10.5,
  maxBend = 0.38,
  dt = 1 / 60;

const widths = [
  26, 29, 30, 30, 29, 27, 25, 23, 21, 18, 16, 13, 11, 9, 7, 5, 4, 4, 3, 3,
];

const tailFollowRate = 7.2;

let joints = [],
  heading = 0.1,
  time = 0,
  tailAngle = 0,
  turnSignal = 0,
  acc = 0;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function setup() {
  createCanvas(600, 360);
  randomSeed(11);
  noiseSeed(11);
  joints = Array.from({ length: count }, (_, i) =>
    createVector(250 - segment * i, 180),
  );
}

function draw() {
  noStroke();
  background(18, 82, 72);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  } // @koi-fixed-step
  const h = headings();
  drawTail(h);
  drawFin(3, 1, 44, 0.95 - turnSignal * 1.6, h); // @koi-fin-outer
  drawFin(3, -1, 44, 0.95 + turnSignal * 1.6, h);
  drawFin(10, 1, 25, 0.75, h);
  drawFin(10, -1, 25, 0.75, h);
  drawBody(h);
  drawEyes(h);
}

function headings() {
  return joints.map((joint, i) =>
    i === 0
      ? heading
      : Math.atan2(joints[i - 1].y - joint.y, joints[i - 1].x - joint.x),
  );
}

function follow(head) {
  joints[0] = head.copy();
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

function drawFin(i, side, len, spread, h) {
  const a = h[i] + side * HALF_PI;
  const bx = joints[i].x + Math.cos(a) * widths[i] * 0.86,
    by = joints[i].y + Math.sin(a) * widths[i] * 0.86;
  push();
  translate(bx, by);
  rotate(h[i] + Math.PI - side * spread); // @koi-fin-spread
  fill(255, 240, 230, 105);
  ellipse(len / 2, 0, len, len * 0.43);
  pop();
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

function bodyPath(h, list = joints) {
  const pts = [];
  for (let i = 0; i < count; i += 1)
    pts.push({
      x: list[i].x + Math.cos(h[i] + HALF_PI) * widths[i],
      y: list[i].y + Math.sin(h[i] + HALF_PI) * widths[i],
    });
  for (let i = count - 1; i >= 0; i -= 1)
    pts.push({
      x: list[i].x + Math.cos(h[i] - HALF_PI) * widths[i],
      y: list[i].y + Math.sin(h[i] - HALF_PI) * widths[i],
    });
  // 头前补圆弧，眼睛落在吻部轮廓内部。
  pts.push(...snoutPoints(list[0], h[0]));
  return smoothPath(pts);
}

function drawBody(h) {
  fill("#f6efe6");
  drawingContext.fill(bodyPath(h));
}

function tailPath(base, d, len, fork) {
  const path = new Path2D();
  const at = (a, r) => [
    base.x + Math.cos(d + a) * r,
    base.y + Math.sin(d + a) * r,
  ];
  path.moveTo(base.x, base.y);
  path.bezierCurveTo(
    ...at(0.35, len * 0.42),
    ...at(0.52, len * 0.86),
    ...at(fork, len),
  );
  path.quadraticCurveTo(...at(0, len * 0.48), ...at(-fork, len));
  path.bezierCurveTo(
    ...at(-0.52, len * 0.86),
    ...at(-0.35, len * 0.42),
    base.x,
    base.y,
  );
  path.closePath();
  return path;
}

function drawTail(h) {
  const base = joints[count - 1];
  fill("rgba(255,236,220,0.45)");
  drawingContext.fill(tailPath(base, tailAngle + Math.PI, 72, 0.47)); // @koi-tail-shape
}

function stepSim() {
  time += dt;
  // 沿用第 4 步的有界目标，保持鳍尾演示在画面内。
  const target = createVector(
    160 + noise(time * 0.18) * 300,
    110 + noise(time * 0.18 + 4) * 140,
  );
  const dx = target.x - joints[0].x,
    dy = target.y - joints[0].y;
  const distanceToTarget = Math.hypot(dx, dy);
  if (distanceToTarget > 0.000001) {
    const desired = Math.atan2(dy, dx);
    heading += wrapAngle(desired - heading) * Math.min(1, dt * 2.1);
    const travel = Math.min(90 * dt, distanceToTarget);
    follow(
      createVector(
        joints[0].x + (dx / distanceToTarget) * travel,
        joints[0].y + (dy / distanceToTarget) * travel,
      ),
    );
  }
  const h = headings();
  tailAngle +=
    wrapAngle(h[count - 1] - tailAngle) * Math.min(1, dt * tailFollowRate); // @koi-tail-lag
  turnSignal +=
    (wrapAngle(heading - h[8]) - turnSignal) * Math.min(1, dt * 3.6);
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

// 保留第 4 步的眼睛，让鳍尾步骤继续是一条完整的鱼。
function drawEyes(h) {
  const head = joints[0];
  for (const side of [-1, 1]) {
    const ex =
      head.x + Math.cos(h[0]) * 11 + Math.cos(h[0] + side * HALF_PI) * 17;
    const ey =
      head.y + Math.sin(h[0]) * 11 + Math.sin(h[0] + side * HALF_PI) * 17;
    fill(18, 16, 20);
    circle(ex, ey, 7);
    fill(255, 255, 255, 220);
    circle(ex + Math.cos(h[0]) * 1.5 - 1, ey + Math.sin(h[0]) * 1.5 - 1, 2.6);
  }
}
