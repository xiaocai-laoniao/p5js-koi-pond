// 第 1 步：让头部追随平滑目标
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 先把锦鲤缩成一个头部点。目标由 noise 生成，速度用 lerp 慢慢靠近期望方向，画面会出现连续的游动意图。
// @koi-target-noise: 用 noise 生成目标坐标。 十字目标不会乱跳，会在池子里缓慢漂移。
// @koi-desired-vector: 把目标减去当前位置，得到期望方向。 鱼头知道该往哪里游。
// @koi-velocity-lerp: 速度只追上期望速度的一小部分。 转向有弧线感，头部不会突然折返。
// @koi-position-add: 当前位置叠加速度。 橙色点沿着平滑轨迹前进。

const dt = 1 / 60;

let pos,
  vel,
  target,
  t = 0,
  acc = 0;

function setup() {
  createCanvas(600, 360);
  randomSeed(7);
  noiseSeed(7);
  pos = createVector(300, 180);
  vel = createVector(0, 0);
  target = pos.copy();
}

function draw() {
  background(15, 72, 66);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  } // @koi-fixed-step
  noFill();
  stroke(195, 245, 228, 150);
  circle(target.x, target.y, 34);
  line(target.x - 24, target.y, target.x + 24, target.y);
  line(target.x, target.y - 24, target.x, target.y + 24);
  noStroke();
  fill(255, 178, 125);
  circle(pos.x, pos.y, 18);
  fill(255, 210, 172);
  text("head", pos.x + 15, pos.y - 10);
}

function stepSim() {
  t += dt;
  target = createVector(
    90 + noise(t * 0.22) * 420,
    70 + noise(t * 0.22 + 9) * 220,
  ); // @koi-target-noise
  const desired = p5.Vector.sub(target, pos).setMag(144 * dt); // @koi-desired-vector
  vel.lerp(desired, 0.045); // @koi-velocity-lerp
  pos.add(vel); // @koi-position-add
}
