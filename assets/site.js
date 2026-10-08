/* global KOI_STEPS */
const shortTitles = [
  "平滑目标",
  "脊柱链",
  "角度约束",
  "身体与眼睛",
  "鳍与尾巴",
  "行波与时间",
  "身体花纹",
  "一池锦鲤",
];
const subtitles = [
  "noise · lerp",
  "20 个关节 · 固定节距",
  "环形角度 · 弯曲限幅",
  "法线 · 平滑轮廓",
  "附着点 · 柔软滞后",
  "固定步长 · 显示偏移",
  "身体坐标 · 裁剪",
  "群游 · 荷叶 · 水光",
];
const frame = document.getElementById("sketch");
const pauseButton = document.getElementById("pause");
let currentIndex = -1;
let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;

for (const [index, step] of KOI_STEPS.entries()) {
  const button = document.createElement("button");
  button.className = "step";
  button.type = "button";
  button.dataset.index = index;
  button.innerHTML = `<span class="step-index">${step.number}</span><span><span class="step-title">${shortTitles[index]}</span><span class="step-subtitle">${subtitles[index]}</span></span>`;
  button.addEventListener("click", () => {
    location.hash = step.number;
  });
  document.getElementById("steps").append(button);
}

function selectStep() {
  const number = Number(location.hash.slice(1));
  const index =
    number >= 1 && number <= 8 && Number.isInteger(number) ? number - 1 : 7;
  if (index === currentIndex) return;
  currentIndex = index;
  const step = KOI_STEPS[index];
  const page = step.file.replace(/\.js$/, ".html");
  frame.src = `steps/${page}`;
  frame.title = `第 ${index + 1} 步：${step.title}`;
  document.querySelectorAll(".step").forEach((button, i) => {
    if (i === index) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  document.getElementById("current-step").textContent =
    `${step.number} / 08 · ${shortTitles[index]}`;
  document.getElementById("lesson-number").textContent = `第 ${index + 1} 步`;
  document.getElementById("lesson-title").textContent = step.title;
  document.getElementById("explanation").textContent = step.explanation;
  document.getElementById("observe").textContent = step.observe;
  document.getElementById("experiment").textContent = step.experiment;
  document.getElementById("source").href = `steps/${step.file}`;
  document.getElementById("standalone").href = `steps/${page}`;
  paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  updatePauseButton();
}

function updatePauseButton() {
  pauseButton.textContent = paused ? "继续" : "暂停";
  pauseButton.setAttribute("aria-pressed", String(paused));
}

pauseButton.addEventListener("click", () => {
  paused = !paused;
  frame.contentWindow.postMessage({ type: "koi:pause", paused }, "*");
  updatePauseButton();
});
document.getElementById("restart").addEventListener("click", () => {
  frame.src = frame.src;
  paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  updatePauseButton();
});
document.getElementById("save").addEventListener("click", () => {
  frame.contentWindow.postMessage({ type: "koi:save" }, "*");
});
window.addEventListener("hashchange", selectStep);
selectStep();
