// 第 6 步：行波推进和固定步长
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 运动状态由脊柱约束决定，行波只在渲染时沿法线偏移每个关节。速度还会驱动摆尾频率和振幅，让快游时更有力量。
// @koi-dt-turn: 最大转向率乘以 dt。 低帧率和高帧率下转向速度一致。
// @koi-speed-goal: 距离目标越远，目标速度越高。 鱼会在远离目标时加速。
// @koi-phase-dt: 相位按时间推进。 摆动频率和真实时间绑定。
// @koi-wave-offset: 每个关节得到不同相位的法线偏移。 身体出现从头到尾传递的波。
// @koi-fixed-step: 用累计时间消化固定模拟步。 动画在不同设备上保持相近速度。

const count = 20,
  segment = 10.5,
  maxBend = 0.38,
  dt = 1 / 60;

const widths = [
  26, 29, 30, 30, 29, 27, 25, 23, 21, 18, 16, 13, 11, 9, 7, 5, 4, 4, 3, 3,
];

const minSpeed = 45,
  maxSpeed = 175,
  tailFollowRate = 7.2;

let joints = [],
  heading = 0.15,
  speed = 72,
  phase = 0,
  acc = 0,
  time = 0,
  tailAngle = 0,
  turnSignal = 0;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function setup() {
  createCanvas(600, 360);
  randomSeed(12);
  noiseSeed(12);
  joints = Array.from({ length: count }, (_, i) =>
    createVector(260 - segment * i, 180),
  );
}

function draw() {
  noStroke();
  background(14, 73, 67);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  } // @koi-fixed-step
  drawFish(wavePoints());
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

function stepSim() {
  time += dt;
  const target = createVector(
    110 + noise(time * 0.11) * 380,
    80 + noise(time * 0.11 + 12) * 210,
  );
  const desired = Math.atan2(target.y - joints[0].y, target.x - joints[0].x);
  heading += constrain(wrapAngle(desired - heading), -1.15 * dt, 1.15 * dt); // @koi-dt-turn
  const d = dist(joints[0].x, joints[0].y, target.x, target.y);
  speed +=
    (minSpeed + constrain(d / 320, 0, 1) * (maxSpeed - minSpeed) - speed) *
    Math.min(1, dt * 1.2); // @koi-speed-goal
  follow(
    createVector(
      joints[0].x + Math.cos(heading) * speed * dt,
      joints[0].y + Math.sin(heading) * speed * dt,
    ),
  );
  phase += (2.6 + speed * 0.03) * dt; // @koi-phase-dt
  const h = headings();
  tailAngle +=
    wrapAngle(h[count - 1] - tailAngle) * Math.min(1, dt * tailFollowRate);
  turnSignal +=
    (wrapAngle(heading - h[8]) - turnSignal) * Math.min(1, dt * 3.6);
}

function wavePoints() {
  const h = headings();
  return joints.map((joint, i) => {
    const env = 0.15 + Math.pow(i / count, 1.5);
    const w = 7 * (0.6 + speed * 0.006) * env * Math.sin(i * 0.55 - phase); // @koi-wave-offset
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

function drawTail(points, h) {
  const base = points[count - 1],
    d = tailAngle + Math.PI,
    len = 72,
    fork = 0.47;
  const at = (a, r) => [
    base.x + Math.cos(d + a) * r,
    base.y + Math.sin(d + a) * r,
  ];
  const path = new Path2D();
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
  fill("rgba(255,236,220,0.45)");
  drawingContext.fill(path);
}

function drawFish(points) {
  const h = headings(points);
  drawTail(points, h);
  drawFin(points, h, 3, 1, 44, 0.95 - turnSignal * 1.6);
  drawFin(points, h, 3, -1, 44, 0.95 + turnSignal * 1.6);
  drawFin(points, h, 10, 1, 25, 0.75);
  drawFin(points, h, 10, -1, 25, 0.75);
  const body = bodyPath(points, h);
  fill("#f6efe6");
  drawingContext.fill(body);
  stroke(255, 224, 138, 170);
  noFill();
  beginShape();
  for (const pointValue of points) vertex(pointValue.x, pointValue.y);
  endShape();
  fill(18, 16, 20);
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
