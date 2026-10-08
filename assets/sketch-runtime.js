// 页面控制与截图辅助代码；steps/*.js 本身无需此文件即可运行。
window.__koiErrors = [];
window.addEventListener("error", (event) => {
  window.__koiErrors.push(event.message);
  document.getElementById("error").textContent =
    `画面未能运行：${event.message}`;
});
window.addEventListener("unhandledrejection", (event) => {
  window.__koiErrors.push(String(event.reason));
});

const captureMode = new URLSearchParams(location.search).has("capture");
const originalSetup = window.setup;
const originalDraw = window.draw;
window.setup = function () {
  originalSetup();
  pixelDensity(2);
  describe(document.title);
  if (captureMode || matchMedia("(prefers-reduced-motion: reduce)").matches)
    noLoop();
  window.__koiReady = true;
};
window.draw = function () {
  if (!captureMode) originalDraw();
};
let capturedFrames = 0;
window.advanceKoi = function (seconds, fps = 60) {
  if (!captureMode) throw new Error("用 ?capture=1 打开步骤页面才能逐帧截图。");
  const count = Math.round(seconds * fps);
  for (let i = 0; i < count; i += 1) {
    // p5 2 的全局 deltaTime 是 getter，直接设置实例的帧间隔。
    p5.instance.deltaTime = 1000 / fps;
    originalDraw();
    capturedFrames += 1;
  }
  return { frames: capturedFrames, errors: window.__koiErrors };
};
window.addEventListener("message", (event) => {
  if (event.source !== parent || !window.__koiReady) return;
  if (event.data?.type === "koi:pause") {
    if (event.data.paused) noLoop();
    else loop();
  }
  if (event.data?.type === "koi:save")
    saveCanvas(`koi-${document.body.dataset.step}`, "png");
});
