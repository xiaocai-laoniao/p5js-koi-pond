// 第 4 步：沿法线长出身体和眼睛
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 给每个关节一组半宽，再沿局部法线向两侧取点。左右两排点合起来形成身体轮廓，头部加眼睛后就有了锦鲤的方向感。
// @koi-normal-right: 沿法线右侧取身体边缘点。 身体右边界跟随脊柱弯曲。
// @koi-normal-left: 沿法线左侧取身体边缘点。 身体左边界与右侧围成封闭形。
// @koi-body-shape: 左右边界用曲线闭合。 链条变成温润的鱼身。
// @koi-eye-dot: 眼睛挂在头部两侧。 鱼的朝向一眼能看出来。
// @koi-arrive-target: 每次前进距离最多等于离目标的距离。 追上目标后保持朝向，避免越过目标后反复掉头。
// @koi-smooth-heading: 朝向每次只追上角度差的一小部分。 目标换向时，鱼身会平滑转过来。

const count = 20,
  segment = 10.5,
  maxBend = 0.38,
  dt = 1 / 60;

const widths = [
  26, 29, 30, 30, 29, 27, 25, 23, 21, 18, 16, 13, 11, 9, 7, 5, 4, 4, 3, 3,
];

let joints = [],
  heading = 0,
  time = 0,
  acc = 0;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function setup() {
  createCanvas(600, 360);
  randomSeed(10);
  noiseSeed(10);
  joints = Array.from({ length: count }, (_, i) =>
    createVector(250 - segment * i, 180),
  );
}

function draw() {
  noStroke();
  background(17, 78, 69);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  } // @koi-fixed-step
  const body = outline();
  const bodyPath = smoothPath([
    ...body.right,
    ...body.left.slice().reverse(),
    ...snoutPoints(joints[0], body.h[0]),
  ]);
  fill("#f6efe6");
  drawingContext.fill(bodyPath); // @koi-body-shape
  const head = joints[0],
    h = body.h[0];
  for (const side of [-1, 1]) {
    const ex = head.x + Math.cos(h) * 11 + Math.cos(h + side * HALF_PI) * 17;
    const ey = head.y + Math.sin(h) * 11 + Math.sin(h + side * HALF_PI) * 17;
    fill(18, 16, 20);
    circle(ex, ey, 7); // @koi-eye-dot
    fill(255, 255, 255, 220);
    circle(ex + Math.cos(h) * 1.5 - 1, ey + Math.sin(h) * 1.5 - 1, 2.6);
  }
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

function outline() {
  const h = headings(),
    right = [],
    left = [];
  for (let i = 0; i < count; i += 1) {
    const a = h[i] + HALF_PI;
    right.push(
      createVector(
        joints[i].x + Math.cos(a) * widths[i],
        joints[i].y + Math.sin(a) * widths[i],
      ),
    ); // @koi-normal-right
    left.push(
      createVector(
        joints[i].x - Math.cos(a) * widths[i],
        joints[i].y - Math.sin(a) * widths[i],
      ),
    ); // @koi-normal-left
  }
  return { right, left, h };
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

function stepSim() {
  time += dt;
  const target = createVector(
    120 + noise(time * 0.18) * 360,
    80 + noise(time * 0.18 + 4) * 210,
  );
  const dx = target.x - joints[0].x,
    dy = target.y - joints[0].y;
  const distanceValue = Math.hypot(dx, dy);
  if (distanceValue > 0.000001) {
    const desired = Math.atan2(dy, dx);
    heading += wrapAngle(desired - heading) * Math.min(1, dt * 2.1); // @koi-smooth-heading
    const travel = Math.min(108 * dt, distanceValue); // @koi-arrive-target
    follow(
      createVector(
        joints[0].x + (dx / distanceValue) * travel,
        joints[0].y + (dy / distanceValue) * travel,
      ),
    );
  }
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
