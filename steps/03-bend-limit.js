// 第 3 步：用角度限幅控制弯曲
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 固定距离还不够，急转时链条会绕成锐角。给相邻两节的夹角加上 maxBend，身体只能形成自然的弧线。
// @koi-wrap-angle: 用 atan2(sin, cos) 处理跨界角度。 方向接近 PI 和 -PI 时不会突然反向。
// @koi-bend-clamp: 把每节角度差夹在固定范围内。 右侧链条会保持连续的弧线。
// @koi-angle-joint: 用受限角度重算关节位置。 关节距离和弯曲角度同时稳定。

const count = 20,
  segment = 10.5,
  maxBend = 0.38,
  dt = 1 / 60;

let left = [],
  right = [],
  head,
  heading = 0,
  time = 0,
  acc = 0;

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a)); // @koi-wrap-angle

function setup() {
  createCanvas(600, 360);
  randomSeed(9);
  noiseSeed(9);
  left = seedSpine(170);
  right = seedSpine(430);
  head = createVector(0, 0);
}

function draw() {
  background(11, 58, 56);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  } // @koi-fixed-step
  fill(255, 154, 136);
  drawChain(left, "自由弯曲", 115);
  fill(148, 232, 184);
  drawChain(right, "角度限幅", 375);
}

function seedSpine(cx) {
  return Array.from({ length: count }, (_, i) =>
    createVector(cx - segment * i, 180),
  );
}

function follow(joints, limited) {
  joints[0] = head.copy();
  for (let i = 1; i < count; i += 1) {
    const anchor = joints[i - 1];
    const prev =
      i === 1
        ? heading
        : Math.atan2(joints[i - 2].y - anchor.y, joints[i - 2].x - anchor.x);
    let current = Math.atan2(anchor.y - joints[i].y, anchor.x - joints[i].x);
    if (limited)
      current = prev + constrain(wrapAngle(current - prev), -maxBend, maxBend); // @koi-bend-clamp
    joints[i] = createVector(
      anchor.x - Math.cos(current) * segment,
      anchor.y - Math.sin(current) * segment,
    ); // @koi-angle-joint
  }
}

function drawChain(joints, label, x) {
  stroke(190, 240, 220, 190);
  noFill();
  beginShape();
  for (const joint of joints) vertex(joint.x, joint.y);
  endShape();
  noStroke();
  for (const joint of joints) circle(joint.x, joint.y, 7);
  fill(235);
  text(label, x, 42);
}

function stepSim() {
  time += dt;
  const dx = 65 * Math.sin(time * 1.3),
    dy = 90 * Math.sin(time * 2.1 + 1);
  heading = Math.atan2(dy, dx);
  head = createVector(170 + dx, 180 + dy);
  follow(left, false);
  head = createVector(430 + dx, 180 + dy);
  follow(right, true);
}
