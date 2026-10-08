// 第 2 步：固定节距的脊柱链
// 本文件是完整的 p5.js global-mode sketch，可独立复制到 p5.js 编辑器运行。
// 把一个点扩展成二十个关节。每个关节只追前一个关节，并保持固定距离，鱼的身体就从点变成了可弯曲的链。
// @koi-fixed-segment: 把点拉回距离 anchor 正好一个节距的位置。 相邻关节长度稳定，身体不会被拉长。
// @koi-head-heading: 头部朝向目标。 整条链被头部带着转向。
// @koi-follow-loop: 从第二节开始逐个跟随。 脊柱像一串珠子被拖着走。

const count = 20,
  segment = 10.5,
  dt = 1 / 60;

let joints = [],
  head,
  heading = 0,
  time = 0,
  acc = 0;

function setup() {
  createCanvas(600, 360);
  randomSeed(8);
  noiseSeed(8);
  head = createVector(300, 180);
  resetSpine();
}

function draw() {
  background(13, 69, 64);
  acc += Math.min(0.05, deltaTime / 1000);
  while (acc >= dt) {
    stepSim();
    acc -= dt;
  } // @koi-fixed-step
  stroke(176, 236, 214);
  strokeWeight(2);
  noFill();
  beginShape();
  for (const joint of joints) vertex(joint.x, joint.y);
  endShape();
  noStroke();
  for (let i = 0; i < joints.length; i += 1) {
    fill(i === 0 ? "#ffb27d" : "#a8ecd8");
    circle(joints[i].x, joints[i].y, i === 0 ? 13 : 9);
  }
}

function constrainDistance(pointValue, anchor, lengthValue) {
  const dx = pointValue.x - anchor.x,
    dy = pointValue.y - anchor.y;
  const d = Math.hypot(dx, dy) || 1;
  return createVector(
    anchor.x + (dx / d) * lengthValue,
    anchor.y + (dy / d) * lengthValue,
  ); // @koi-fixed-segment
}

function resetSpine() {
  joints = [];
  for (let i = 0; i < count; i += 1)
    joints.push(
      createVector(
        head.x - Math.cos(heading) * segment * i,
        head.y - Math.sin(heading) * segment * i,
      ),
    );
}

function stepSim() {
  time += dt;
  const target = createVector(
    120 + noise(time * 0.18) * 360,
    70 + noise(time * 0.18 + 12) * 230,
  );
  const dx = target.x - joints[0].x,
    dy = target.y - joints[0].y;
  const distanceValue = Math.hypot(dx, dy);
  if (distanceValue > 0.000001) {
    heading = Math.atan2(dy, dx); // @koi-head-heading
    const travel = Math.min(132 * dt, distanceValue);
    joints[0].x += Math.cos(heading) * travel;
    joints[0].y += Math.sin(heading) * travel;
  }
  for (let i = 1; i < count; i += 1)
    joints[i] = constrainDistance(joints[i], joints[i - 1], segment); // @koi-follow-loop
}
