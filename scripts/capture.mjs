import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, writeFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import assert from "node:assert/strict";
import { createStaticServer } from "./serve.mjs";

// 使用隔离的 Chrome 配置，不连接用户已打开的浏览器。
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const steps = JSON.parse(await readFile(path.join(root, "steps.json"), "utf8"));
const chromePath =
  process.env.CHROME_PATH ||
  (process.platform === "darwin"
    ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    : process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : "chromium");
const profile = await mkdtemp(path.join(tmpdir(), "koi-capture-"));
const server = createStaticServer();
server.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--no-sandbox",
    "--remote-debugging-port=0",
    "--remote-debugging-address=127.0.0.1",
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "about:blank",
  ],
  { stdio: ["ignore", "ignore", "pipe"] },
);
let chromeLog = "";
let launchError;
chrome.stderr.on("data", (chunk) => {
  chromeLog += chunk;
});
chrome.on("error", (error) => {
  launchError = error;
});
let cdp;
const report = {
  p5Version: "2.3.4",
  capture: { simulationSeconds: 12, fps: 60, pngWidth: 1200, pngHeight: 720 },
  steps: [],
  interactions: [],
};

try {
  await mkdir(path.join(root, "assets/screenshots"), { recursive: true });
  await mkdir(path.join(root, "qa"), { recursive: true });
  await waitUntil(() => {
    if (launchError) throw launchError;
    if (chrome.exitCode !== null)
      throw new Error(`Chrome 启动失败：${chromeLog.slice(-1000)}`);
    return /DevTools listening on (ws:\/\/[^\s]+)/.exec(chromeLog)?.[1];
  });
  const endpoint = /DevTools listening on (ws:\/\/[^\s]+)/.exec(chromeLog)[1];
  const port = new URL(endpoint).port;
  const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((res) =>
    res.json(),
  );
  cdp = await connect(
    pages.find((page) => page.type === "page").webSocketDebuggerUrl,
  );
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
    window.__pageErrors = [];
    addEventListener('error', e => __pageErrors.push(e.message));
    addEventListener('unhandledrejection', e => __pageErrors.push(String(e.reason)));
  `,
  });

  for (const step of steps) {
    const url = `${base}/steps/${step.file.replace(/\.js$/, ".html")}?capture=1`;
    await navigate(url, "window.__koiReady");
    const first = await evaluate(
      "advanceKoi(12); document.querySelector('canvas').toDataURL('image/png')",
    );
    const image = Buffer.from(first.split(",")[1], "base64");
    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 720);
    await writeFile(
      path.join(root, "assets/screenshots", step.screenshot),
      image,
    );
    const signature60 = await stateSignature(step);
    const second = await evaluate(
      "advanceKoi(2); document.querySelector('canvas').toDataURL('image/png')",
    );
    assert(first !== second, `${step.id} 动画没有持续变化`);
    const geometry = await geometryCheck(step);
    // 相同固定种子与模拟时长，在 30 / 60 fps 下得到相同状态。
    await navigate(url, "window.__koiReady");
    await evaluate("advanceKoi(12, 30)");
    const signature30 = await stateSignature(step);
    const frameRateError = Math.max(
      ...signature60.map((value, i) => Math.abs(value - signature30[i])),
    );
    assert(
      frameRateError < 1e-6,
      `${step.id} 30/60 fps 状态偏差 ${frameRateError}`,
    );
    const errors = await evaluate("[...__koiErrors, ...__pageErrors]");
    assert.deepEqual(errors, []);
    const code = await readFile(path.join(root, "steps", step.file));
    report.steps.push({
      id: step.id,
      screenshot: `assets/screenshots/${step.screenshot}`,
      sourceSha256: createHash("sha256").update(code).digest("hex"),
      pngSha256: createHash("sha256").update(image).digest("hex"),
      animationChanges: true,
      frameRateError,
      geometry,
      errors,
    });
    console.log(
      `${step.number} ${step.title}：截图、持续变化与 30/60 fps 验证通过`,
    );
  }

  // 检查原来第 4 步的掉头问题：接近目标时不能越过目标、单帧不能急转。
  await navigate(
    `${base}/steps/04-body-outline.html?capture=1`,
    "window.__koiReady",
  );
  report.motion = await evaluate(`(() => {
    let overshoots = 0, maxTurn = 0;
    for (let i = 0; i < 3600; i++) {
      const before = {x: joints[0].x, y: joints[0].y, heading};
      advanceKoi(1/60);
      const target = {x: 120 + noise(time * 0.18) * 360, y: 80 + noise(time * 0.18 + 4) * 210};
      const dx = target.x-before.x, dy = target.y-before.y, d = Math.hypot(dx,dy);
      const projection = d > 1e-6 ? ((joints[0].x-before.x)*dx+(joints[0].y-before.y)*dy)/d : 0;
      if (projection > d + 1e-6) overshoots++;
      maxTurn = Math.max(maxTurn, Math.abs(wrapAngle(heading-before.heading))*180/Math.PI);
    }
    return {simulationSeconds: 60, overshoots, maxTurnDegrees: maxTurn};
  })()`);
  assert.equal(report.motion.overshoots, 0);
  assert(report.motion.maxTurnDegrees < 10);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await navigate(
    base,
    "document.querySelector('#sketch')?.contentWindow.__koiReady",
  );
  await delay(1200);
  await screenshot("qa/desktop.png");
  for (const step of steps) {
    await evaluate(
      `document.querySelector('[data-index="${Number(step.number) - 1}"]').click()`,
    );
    await waitUntil(async () =>
      evaluate(
        `location.hash === '#${step.number}' && document.querySelector('#sketch').contentWindow.__koiReady && document.querySelector('#sketch').contentWindow.location.pathname.endsWith('${step.file.replace(/\.js$/, ".html")}')`,
      ),
    );
    report.interactions.push({ step: step.number, navigation: true });
  }
  await evaluate("document.querySelector('#pause').click()");
  await delay(100);
  const pausedFrame = await evaluate(
    "document.querySelector('#sketch').contentWindow.frameCount",
  );
  await delay(400);
  assert.equal(
    await evaluate(
      "document.querySelector('#sketch').contentWindow.frameCount",
    ),
    pausedFrame,
  );
  await evaluate("document.querySelector('#pause').click()");
  await delay(300);
  assert(
    (await evaluate(
      "document.querySelector('#sketch').contentWindow.frameCount",
    )) > pausedFrame,
  );
  report.pauseResume = true;
  await evaluate(`new Promise(resolve => {
    document.querySelector('#sketch').addEventListener('load', resolve, {once:true});
    document.querySelector('#restart').click();
  })`);
  await waitUntil(async () =>
    evaluate("document.querySelector('#sketch').contentWindow.__koiReady"),
  );
  report.restart = true;

  // 保留一段真实时间运行证据，避免只验证逐帧模式。
  const liveStart = await evaluate(
    "document.querySelector('#sketch').contentWindow.frameCount",
  );
  console.log("完整鱼池开始连续运行 30 秒检查。");
  await delay(30000);
  const liveEnd = await evaluate(
    "document.querySelector('#sketch').contentWindow.frameCount",
  );
  report.livePond = {
    wallSeconds: 30,
    renderedFrames: liveEnd - liveStart,
    errors: await evaluate(
      "[...__pageErrors, ...document.querySelector('#sketch').contentWindow.__koiErrors]",
    ),
  };
  assert(
    report.livePond.renderedFrames > 60,
    `鱼池实际绘制帧数：${report.livePond.renderedFrames}`,
  );
  assert.deepEqual(report.livePond.errors, []);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 1320,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(300);
  const layout = await evaluate(
    "({width: innerWidth, documentWidth: document.documentElement.scrollWidth, canvasVisible: document.querySelector('#sketch').getBoundingClientRect().width > 0})",
  );
  assert(layout.documentWidth <= layout.width);
  assert(layout.canvasVisible);
  await screenshot("qa/mobile.png");
  report.mobile = layout;
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await navigate(
    base,
    "document.querySelector('#sketch')?.contentWindow.__koiReady",
  );
  await delay(200);
  assert.equal(
    await evaluate(
      "document.querySelector('#sketch').contentWindow.isLooping()",
    ),
    false,
  );
  assert.equal(
    await evaluate("document.querySelector('#pause').textContent"),
    "继续",
  );
  report.reducedMotion = true;
  report.passed = true;
  await writeFile(
    path.join(root, "qa/browser-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    "8 个步骤、运动、导航、暂停、重启、手机布局与减弱动态检查全部通过。",
  );
} finally {
  cdp?.close();
  chrome.kill("SIGTERM");
  server.close();
  if (chrome.exitCode === null && !launchError)
    await Promise.race([once(chrome, "close"), delay(2000)]);
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

async function geometryCheck(step) {
  if (step.number === "01")
    return evaluate(
      "({finite: [pos.x, pos.y, vel.x, vel.y].every(Number.isFinite)})",
    );
  const value = await evaluate(
    step.number === "08"
      ? `(() => {
    const points = fish.flatMap(f => f.j);
    return {fishCount: fish.length, finite: points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))};
  })()`
      : `(() => {
    const chains = ${step.number === "03" ? "[left, right]" : "[joints]"};
    let maxSegmentError = 0;
    for (const chain of chains) for (let i = 1; i < chain.length; i++) {
      maxSegmentError = Math.max(maxSegmentError, Math.abs(Math.hypot(chain[i].x-chain[i-1].x,chain[i].y-chain[i-1].y)-segment));
    }
    return {jointCount: chains[0].length, maxSegmentError, finite: chains.flat().every(p => Number.isFinite(p.x) && Number.isFinite(p.y))};
  })()`,
  );
  assert(value.finite);
  if (value.maxSegmentError !== undefined) assert(value.maxSegmentError < 1e-6);
  if (value.fishCount !== undefined) assert.equal(value.fishCount, 8);
  return value;
}

async function stateSignature(step) {
  return evaluate(
    step.number === "01"
      ? "[pos.x,pos.y,vel.x,vel.y]"
      : step.number === "03"
        ? "[...left,...right].flatMap(p=>[p.x,p.y])"
        : step.number === "08"
          ? "fish.flatMap(f=>[f.ang,f.phase,...f.j.flatMap(p=>[p.x,p.y])])"
          : "[heading,...joints.flatMap(p=>[p.x,p.y])]",
  );
}

async function navigate(url, ready) {
  await cdp.send("Page.navigate", { url });
  try {
    await waitUntil(async () => {
      try {
        return await evaluate(
          `location.href.startsWith(${JSON.stringify(url)}) && (${ready})`,
        );
      } catch {
        return false;
      }
    });
  } catch (error) {
    const state = await evaluate(
      "({url:location.href, errors:window.__pageErrors, koiErrors:window.__koiErrors, text:document.body?.innerText, setup:typeof setup, p5:typeof p5, ready:window.__koiReady})",
    );
    throw new Error(`${error.message}: ${JSON.stringify(state)}`);
  }
}

async function screenshot(file) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  await writeFile(path.join(root, file), Buffer.from(data, "base64"));
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails)
    throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}

async function waitUntil(check) {
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(80);
  }
  throw new Error("等待浏览器状态超时");
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timeout);
    if (message.error) item.reject(new Error(JSON.stringify(message.error)));
    else item.resolve(message.result);
  });
  return {
    send(method, params = {}) {
      return new Promise((resolve, reject) => {
        const id = ++sequence;
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`CDP 超时：${method}`));
        }, 30000);
        pending.set(id, { resolve, reject, timeout });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
