const boardHints = {
  uno: "Arduino Uno / Nano 內建 LED 通常是 D13，PWM 可用 3、5、6、9、10、11。",
  nano: "Arduino Nano 腳位寫法大多與 Uno 相同，內建 LED 通常是 D13。",
  leonardo: "Arduino Leonardo 內建 LED 通常是 D13，Serial 與 USB 序列埠行為需留意。",
  esp8266: "ESP8266 建議使用 D1、D2、D5 等開發板標示腳位，部分腳位會影響開機。",
  d1mini: "D1 mini 常用 D1、D2、D5、D6、D7，內建 LED 多半是 D4 且低電位亮。",
  esp32: "ESP32 建議直接標示 GPIO 編號，避免使用啟動綁定或僅輸入腳位作輸出。"
};

const languageHints = {
  arduino: "目前使用 Arduino C 轉換器。",
  micropython: "MicroPython 轉換器已預留介面；目前仍以 Arduino C 規則解析。",
  python: "Python 轉換器已預留介面；目前仍以 Arduino C 規則解析。",
  javascript: "JavaScript 轉換器已預留介面；目前仍以 Arduino C 規則解析。"
};

const motoBlocklyBlocks = {
  setup: { type: "arduino_setup", category: "程式開始", display: "motoBlockly：程式開始" },
  loop: { type: "arduino_setup", category: "程式開始", display: "motoBlockly：loop 區" },
  variable: { type: "variables_set", category: "變量", display: "motoBlockly：變量" },
  pinMode: { type: "inout_pinmode_val", category: "腳位設定", display: "motoBlockly：腳位模式" },
  digitalWrite: { type: "inout_digital_write_v2", category: "數位輸出", display: "motoBlockly：數位輸出" },
  digitalRead: { type: "inout_digital_read_v2", category: "數位讀取", display: "motoBlockly：數位讀取" },
  analogRead: { type: "inout_analog_read_v2", category: "類比讀取", display: "motoBlockly：類比讀取" },
  analogWrite: { type: "inout_analog_write_v2", category: "PWM 輸出", display: "motoBlockly：PWM 輸出" },
  delay: { type: "delay_custom", category: "時間", display: "motoBlockly：等待" },
  delayMicroseconds: { type: "delayMicroseconds_custom", category: "時間", display: "motoBlockly：微秒等待" },
  millis: { type: "millis", category: "時間", display: "motoBlockly：millis" },
  serialBegin: { type: "serial_setup", category: "串列埠", display: "motoBlockly：Serial 設定" },
  serialPrint: { type: "serial_print", category: "串列埠", display: "motoBlockly：Serial print" },
  serialPrintln: { type: "serial_printL", category: "串列埠", display: "motoBlockly：Serial println" },
  if: { type: "controls_if", category: "邏輯", display: "motoBlockly：if" },
  for: { type: "controls_for", category: "迴圈", display: "motoBlockly：for" },
  while: { type: "while_do", category: "迴圈", display: "motoBlockly：while" },
  tone: { type: "custom_tone_v1", category: "蜂鳴器", display: "motoBlockly：tone" },
  noTone: { type: "no_tone", category: "蜂鳴器", display: "motoBlockly：noTone" },
  servoMove: { type: "servo_move", category: "伺服馬達", display: "motoBlockly：伺服馬達" },
  custom: { type: "custom_code", category: "自製積木", display: "motoBlockly：自訂程式" }
};

const exampleCode = `const int ledPin = 13;
const int buttonPin = 2;

void setup() {
  pinMode(ledPin, OUTPUT);
  pinMode(buttonPin, INPUT_PULLUP);
  Serial.begin(9600);
}

void loop() {
  if (digitalRead(buttonPin) == LOW) {
    digitalWrite(ledPin, HIGH);
    Serial.println("LED on");
  } else {
    digitalWrite(ledPin, LOW);
  }
  delay(500);
}`;

const promptText = `請幫我產生 Arduino C 程式。
板子：Arduino Uno
任務：讓按鈕控制 LED，按下亮、放開暗
限制：
1. 使用 setup() 與 loop()
2. 使用 pinMode、digitalRead、digitalWrite
3. 加上清楚註解
4. 不要使用複雜 C++ 類別或自訂函式
5. 說明每個腳位接到哪裡`;

const els = {
  codeInput: document.querySelector("#codeInput"),
  languageSelect: document.querySelector("#languageSelect"),
  boardSelect: document.querySelector("#boardSelect"),
  boardHint: document.querySelector("#boardHint"),
  blockCanvas: document.querySelector("#blockCanvas"),
  outlineView: document.querySelector("#outlineView"),
  blockCount: document.querySelector("#blockCount"),
  pinCount: document.querySelector("#pinCount"),
  warningCount: document.querySelector("#warningCount"),
  handoffList: document.querySelector("#handoffList"),
  promptTemplate: document.querySelector("#promptTemplate"),
  loadExample: document.querySelector("#loadExample"),
  exportSvg: document.querySelector("#exportSvg"),
  exportPng: document.querySelector("#exportPng")
};

let latestModel = [];
let latestStats = { blocks: 0, pins: new Set(), warnings: [] };

function tokenize(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\{/g, "\n{\n")
    .replace(/\}/g, "\n}\n")
    .replace(/;/g, ";\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseCode(code) {
  const root = [];
  const stack = [{ type: "root", children: root }];
  const stats = { blocks: 0, pins: new Set(), warnings: [] };
  const lines = tokenize(code);

  lines.forEach((line) => {
    if (line === "{") return;
    if (line === "}") {
      if (stack.length > 1) stack.pop();
      return;
    }

    const node = classifyLine(line, stats);
    const current = stack[stack.length - 1];
    current.children.push(node);
    stats.blocks += node.kind === "meta" ? 0 : 1;

    if (node.opens) {
      node.children = [];
      stack.push(node);
    }
  });

  if (stack.length > 1) {
    stats.warnings.push("括號數量可能不完整，已依可辨識內容產生積木。");
  }

  return { model: root, stats };
}

function classifyLine(rawLine, stats) {
  const line = rawLine.replace(/;$/, "");
  const simple = line.replace(/\s+/g, " ");

  const functionMatch = simple.match(/^void\s+(setup|loop)\s*\(\s*\)/);
  if (functionMatch) {
    const fn = functionMatch[1];
    return block("function", "程式區塊", fn === "setup" ? "setup() 開始設定" : "loop() 重複執行", true, fn === "setup" ? "setup" : "loop");
  }

  if (/^#include/.test(simple)) return block("meta", "函式庫", simple);

  const declaration = simple.match(/^(?:const\s+)?(?:int|float|long|bool|boolean|byte|char|String)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/);
  if (declaration) {
    collectPin(declaration[2], stats);
    return block("custom", "變數", `設定 ${declaration[1]} 為 ${declaration[2]}`, false, "variable");
  }

  const pinMode = simple.match(/^pinMode\s*\((.+),\s*(INPUT_PULLUP|INPUT|OUTPUT)\)$/);
  if (pinMode) {
    collectPin(pinMode[1], stats);
    return block("pin", "腳位模式", `把 ${pinMode[1]} 設為 ${translateMode(pinMode[2])}`, false, "pinMode");
  }

  const digitalWrite = simple.match(/^digitalWrite\s*\((.+),\s*(HIGH|LOW)\)$/);
  if (digitalWrite) {
    collectPin(digitalWrite[1], stats);
    return block("pin", "數位輸出", `讓 ${digitalWrite[1]} ${digitalWrite[2] === "HIGH" ? "輸出 HIGH / 亮起" : "輸出 LOW / 熄滅"}`, false, "digitalWrite");
  }

  const analogWrite = simple.match(/^analogWrite\s*\((.+),\s*(.+)\)$/);
  if (analogWrite) {
    collectPin(analogWrite[1], stats);
    return block("pin", "PWM 輸出", `讓 ${analogWrite[1]} 輸出 PWM ${analogWrite[2]}`, false, "analogWrite");
  }

  const delayMatch = simple.match(/^delay(?:Microseconds)?\s*\((.+)\)$/);
  if (delayMatch) {
    const unit = simple.startsWith("delayMicroseconds") ? "微秒" : "毫秒";
    return block("timing", "等待", `等待 ${delayMatch[1]} ${unit}`, false, simple.startsWith("delayMicroseconds") ? "delayMicroseconds" : "delay");
  }

  const serialBegin = simple.match(/^Serial\.begin\s*\((.+)\)$/);
  if (serialBegin) return block("serial", "序列埠", `啟動 Serial，鮑率 ${serialBegin[1]}`, false, "serialBegin");

  const serialPrint = simple.match(/^Serial\.(print|println)\s*\((.*)\)$/);
  if (serialPrint) return block("serial", "序列輸出", `顯示 ${serialPrint[2] || "空行"}`, false, serialPrint[1] === "println" ? "serialPrintln" : "serialPrint");

  const ifMatch = simple.match(/^if\s*\((.+)\)$/);
  if (ifMatch) return block("control", "如果", convertCondition(ifMatch[1]), true, "if");

  const elseIfMatch = simple.match(/^else\s+if\s*\((.+)\)$/);
  if (elseIfMatch) return block("control", "否則如果", convertCondition(elseIfMatch[1]), true, "if");

  if (/^else$/.test(simple)) return block("control", "否則", "前面條件不成立時", true, "if");

  const forMatch = simple.match(/^for\s*\((.+)\)$/);
  if (forMatch) return block("control", "重複", `for：${forMatch[1]}`, true, "for");

  const whileMatch = simple.match(/^while\s*\((.+)\)$/);
  if (whileMatch) return block("control", "當成立時重複", convertCondition(whileMatch[1]), true, "while");

  const toneMatch = simple.match(/^(tone|noTone)\s*\((.*)\)$/);
  if (toneMatch) return block("pin", "蜂鳴器", `${toneMatch[1]}(${toneMatch[2]})`, false, toneMatch[1] === "noTone" ? "noTone" : "tone");

  const servoMatch = simple.match(/^([A-Za-z_]\w*)\.write\s*\((.+)\)$/);
  if (servoMatch) return block("pin", "伺服馬達", `讓 ${servoMatch[1]} 轉到 ${servoMatch[2]} 度`, false, "servoMove");

  if (/\bmillis\s*\(\s*\)/.test(simple)) return block("timing", "計時", simple, false, "millis");

  stats.warnings.push(`未標準化：${simple}`);
  return block("custom", "自訂程式", simple, false, "custom");
}

function block(type, kind, label, opens = false, motoKey = "") {
  return { type, kind, label, opens, moto: motoBlocklyBlocks[motoKey] || null, children: [] };
}

function translateMode(mode) {
  return {
    OUTPUT: "輸出",
    INPUT: "輸入",
    INPUT_PULLUP: "輸入上拉"
  }[mode] || mode;
}

function collectPin(value, stats) {
  const cleaned = value.trim();
  if (/^(?:A?\d+|D\d+|GPIO\d+|[A-Za-z_]\w*Pin)$/.test(cleaned)) {
    stats.pins.add(cleaned);
  }
}

function convertCondition(condition) {
  return condition
    .replace(/digitalRead\s*\((.+?)\)/g, "讀取 $1")
    .replace(/analogRead\s*\((.+?)\)/g, "類比讀取 $1")
    .replace(/==/g, "等於")
    .replace(/!=/g, "不等於")
    .replace(/>=/g, "大於等於")
    .replace(/<=/g, "小於等於")
    .replace(/&&/g, "而且")
    .replace(/\|\|/g, "或者");
}

function render() {
  const result = parseCode(els.codeInput.value);
  latestModel = result.model;
  latestStats = result.stats;
  els.boardHint.textContent = `${languageHints[els.languageSelect.value]} ${boardHints[els.boardSelect.value]}`;
  els.blockCount.textContent = String(result.stats.blocks);
  els.pinCount.textContent = String(result.stats.pins.size);
  els.warningCount.textContent = String(result.stats.warnings.length);
  renderBlocks(result.model);
  renderOutline(result.model);
  renderHandoff(result.stats);
}

function renderBlocks(model) {
  els.blockCanvas.innerHTML = "";
  if (!model.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "貼上程式碼後，這裡會產生標準化積木圖。";
    els.blockCanvas.append(empty);
    return;
  }
  const stackEl = document.createElement("div");
  stackEl.className = "stack";
  model.forEach((node) => stackEl.append(renderNode(node)));
  els.blockCanvas.append(stackEl);
}

function renderNode(node) {
  const wrap = document.createElement("div");
  if (node.type === "function") {
    const isLoop = node.label.startsWith("loop");
    wrap.className = `function-stack ${isLoop ? "loop-section" : "setup-section"}`;
    const title = document.createElement("div");
    title.className = "function-block-head";
    title.innerHTML = `<span class="gear" aria-hidden="true"></span><span class="section-name"></span><span class="section-role"></span>`;
    title.querySelector(".section-name").textContent = isLoop ? "loop" : "setup";
    title.querySelector(".section-role").textContent = isLoop ? "重複執行區" : "開始設定區";
    title.title = node.moto ? node.moto.type : "";
    wrap.append(title);
    const childStack = document.createElement("div");
    childStack.className = "stack function-body";
    node.children.forEach((child) => childStack.append(renderNode(child)));
    wrap.append(childStack);
    return wrap;
  }

  const blockEl = document.createElement("div");
  blockEl.className = `blockly-block ${node.type}${node.opens ? " has-mouth" : ""}`;
  blockEl.innerHTML = `<span class="gear" aria-hidden="true"></span><span class="kind"></span><span class="label"></span><span class="moto-tag"></span>`;
  blockEl.querySelector(".kind").textContent = node.kind;
  blockEl.querySelector(".label").innerHTML = formatBlocklyLabel(node.label);
  const motoTag = blockEl.querySelector(".moto-tag");
  if (node.moto) {
    motoTag.textContent = node.moto.type;
    motoTag.title = node.moto.display;
  } else {
    motoTag.remove();
  }
  wrap.append(blockEl);

  if (node.children?.length) {
    const mouth = document.createElement("div");
    mouth.className = `block-mouth ${node.type}`;
    const mouthLabel = document.createElement("span");
    mouthLabel.className = "mouth-label";
    mouthLabel.textContent = node.kind.includes("否則") ? "else" : "do";
    mouth.append(mouthLabel);
    const children = document.createElement("div");
    children.className = "child-stack";
    node.children.forEach((child) => children.append(renderNode(child)));
    mouth.append(children);
    wrap.append(mouth);
  }
  return wrap;
}

function formatBlocklyLabel(text) {
  const tokenPattern = /("[^"]*"|'[^']*'|不等於|大於等於|小於等於|等於|而且|或者|\b(?:HIGH|LOW|OUTPUT|INPUT_PULLUP|INPUT)\b|\b(?:GPIO\d+|D\d+|A\d+|[A-Za-z_]\w*Pin|[A-Za-z_]\w*)\b|\b\d+(?:\.\d+)?\b)/g;
  let html = "";
  let lastIndex = 0;
  for (const match of text.matchAll(tokenPattern)) {
    html += escapeHtml(text.slice(lastIndex, match.index));
    const token = match[0];
    html += `<span class="slot ${slotClass(token)}">${escapeHtml(token)}</span>`;
    lastIndex = match.index + token.length;
  }
  html += escapeHtml(text.slice(lastIndex));
  return html;
}

function slotClass(token) {
  if (/^["']/.test(token)) return "string";
  if (/^(不等於|大於等於|小於等於|等於|而且|或者)$/.test(token)) return "operator";
  if (/^\d/.test(token)) return "number";
  if (/^(HIGH|LOW|OUTPUT|INPUT_PULLUP|INPUT)$/.test(token)) return "value";
  return "variable";
}

function renderOutline(model) {
  els.outlineView.innerHTML = "";
  flatten(model).forEach((item) => {
    const li = document.createElement("li");
    li.style.marginLeft = `${item.depth * 18}px`;
    li.textContent = `${item.kind}：${item.label}${item.moto ? `（${item.moto.type}）` : ""}`;
    els.outlineView.append(li);
  });
}

function flatten(nodes, depth = 0) {
  return nodes.flatMap((node) => [
    { kind: node.kind, label: node.label, depth, moto: node.moto },
    ...flatten(node.children || [], depth + 1)
  ]);
}

function renderHandoff(stats) {
  const pins = Array.from(stats.pins);
  const items = [
    ["語言", els.languageSelect.options[els.languageSelect.selectedIndex].textContent, languageHints[els.languageSelect.value]],
    ["板子", els.boardSelect.options[els.boardSelect.selectedIndex].textContent, boardHints[els.boardSelect.value]],
    ["腳位", pins.length ? pins.join("、") : "尚未辨識腳位", "若使用變數命名，建議採用 ledPin、buttonPin、pumpPin 等清楚名稱。"],
    ["對應", "已啟用 motoBlockly 第一批對應", "目前標示常用入門積木 type，例如 inout_digital_write_v2、delay_custom、controls_if。"],
    ["輸出", "可下載 SVG / PNG", "SVG 適合投影片與講義排版，PNG 適合快速貼圖。"],
    ["提醒", stats.warnings.length ? `${stats.warnings.length} 個自訂或未標準化語句` : "目前沒有未標準化語句", stats.warnings.slice(0, 2).join("；") || "可直接依照積木圖到 mBlock / Mixly / Arduino Blockly 拉積木。"]
  ];
  els.handoffList.innerHTML = "";
  items.forEach(([tag, title, detail]) => {
    const item = document.createElement("div");
    item.className = "handoff-item";
    item.innerHTML = `<span></span><div><strong></strong><small></small></div>`;
    item.querySelector("span").textContent = tag;
    item.querySelector("strong").textContent = title;
    item.querySelector("small").textContent = detail;
    els.handoffList.append(item);
  });
}

function buildExportSvg() {
  const width = 1120;
  const drawn = drawExportNodes(latestModel, 24, 54, width - 48);
  const height = Math.max(220, drawn.height + 86);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="#cfd8d1"/></pattern></defs>
    <rect width="100%" height="100%" fill="#fbfcfa"/>
    <rect width="100%" height="100%" fill="url(#dots)"/>
    <text x="24" y="34" font-family="Segoe UI, Noto Sans TC, Arial" font-size="21" font-weight="600" fill="#5f3c75">Code to Blockly</text>
    ${drawn.svg}
  </svg>`;
}

function drawExportNodes(nodes, x, y, maxWidth) {
  let svg = "";
  let cursor = y;
  nodes.forEach((node) => {
    const drawn = drawExportNode(node, x, cursor, maxWidth);
    svg += drawn.svg;
    cursor += drawn.height + 12;
  });
  return { svg, height: cursor - y };
}

function drawExportNode(node, x, y, maxWidth) {
  if (node.type === "function") {
    const isLoop = node.label.startsWith("loop");
    const color = isLoop ? "#5f8fc2" : "#8f5aa8";
    const headW = isLoop ? 300 : 310;
    const bodyX = x + 48;
    const bodyY = y + 39;
    const children = drawExportNodes(node.children || [], bodyX, bodyY + 12, maxWidth - 86);
    const bodyH = Math.max(64, children.height + 30);
    const bodyW = Math.max(560, Math.min(maxWidth, 1000));
    const title = isLoop ? "loop   重複執行區" : "setup   開始設定區";
    const svg = `
      ${svgBlockPath(x, y, headW, 40, color, false)}
      <text x="${x + 18}" y="${y + 25}" font-family="Segoe UI, Noto Sans TC, Arial" font-size="16" font-weight="500" fill="#fff">${escapeXml(title)}</text>
      <text x="${x + headW - 116}" y="${y + 25}" font-family="Segoe UI, Noto Sans TC, Arial" font-size="10" fill="rgba(255,255,255,.82)">${escapeXml(node.moto?.type || "")}</text>
      <rect x="${x}" y="${bodyY}" width="${bodyW}" height="${bodyH}" fill="${color}" stroke="rgba(0,0,0,.16)"/>
      ${children.svg}
    `;
    return { svg, height: 40 + bodyH };
  }

  const color = exportColorFor(node);
  const label = `${node.kind}：${node.label}`;
  const w = Math.max(360, Math.min(maxWidth, estimateExportWidth(label, node.moto?.type)));
  let svg = `${svgBlockPath(x, y, w, 38, color, true)}
    <text x="${x + 18}" y="${y + 24}" font-family="Segoe UI, Noto Sans TC, Arial" font-size="15" font-weight="400" fill="#fff">${escapeXml(label)}</text>
    ${node.moto ? `<text x="${x + w - 190}" y="${y + 24}" font-family="Segoe UI, Noto Sans TC, Arial" font-size="10" fill="rgba(255,255,255,.86)">${escapeXml(node.moto.type)}</text>` : ""}
  `;
  let height = 38;
  if (node.children?.length) {
    const mouthX = x;
    const mouthY = y + 36;
    const childX = x + 54;
    const children = drawExportNodes(node.children, childX, mouthY + 12, maxWidth - 70);
    const mouthH = Math.max(58, children.height + 30);
    const mouthW = Math.max(520, Math.min(maxWidth, w + 80));
    svg += `<rect x="${mouthX}" y="${mouthY}" width="${mouthW}" height="${mouthH}" fill="#5f8fc2" stroke="rgba(0,0,0,.16)"/>
      <text x="${mouthX + 14}" y="${mouthY + 29}" font-family="Segoe UI, Noto Sans TC, Arial" font-size="15" font-weight="600" fill="#fff">${node.kind.includes("否則") ? "else" : "do"}</text>
      ${children.svg}`;
    height += mouthH - 2;
  }
  return { svg, height };
}

function svgBlockPath(x, y, w, h, color, hasTopNotch) {
  const notch = hasTopNotch ? `H ${x + 44} q 5 0 8 5 q 3 5 8 0 q 3 -5 8 -5` : "";
  return `<path d="M ${x + 7} ${y} ${notch} H ${x + w} V ${y + h} H ${x + 74} q -5 0 -8 5 q -3 5 -8 0 q -3 -5 -8 -5 H ${x + 7} q -7 0 -7 -7 V ${y + 7} q 0 -7 7 -7 Z" fill="${color}" stroke="rgba(0,0,0,.18)"/>`;
}

function exportColorFor(node) {
  return {
    pin: "#4f88c6",
    timing: "#d99b32",
    control: "#5f8fc2",
    serial: "#55aa91",
    custom: "#c65c90"
  }[node.type] || "#7c8580";
}

function estimateExportWidth(label, motoType = "") {
  return 120 + label.length * 14 + (motoType ? Math.min(220, motoType.length * 7 + 36) : 0);
}

function escapeHtml(text) {
  return text.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function escapeXml(text) {
  return text.replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;",
    "'": "&apos;"
  }[char]));
}

function download(filename, href) {
  const link = document.createElement("a");
  link.download = filename;
  link.href = href;
  document.body.append(link);
  link.click();
  link.remove();
}

function exportSvg() {
  const svg = buildExportSvg();
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  download("arduino-blockly.svg", URL.createObjectURL(blob));
}

function exportPng() {
  const svg = buildExportSvg();
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = img.width * 2;
    canvas.height = img.height * 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fbfcfa";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    download("arduino-blockly.png", canvas.toDataURL("image/png"));
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-view]").forEach((btn) => btn.classList.remove("active"));
    button.classList.add("active");
    const showOutline = button.dataset.view === "outline";
    els.outlineView.hidden = !showOutline;
    els.blockCanvas.hidden = showOutline;
  });
});

els.codeInput.addEventListener("input", render);
els.languageSelect.addEventListener("change", render);
els.boardSelect.addEventListener("change", render);
els.loadExample.addEventListener("click", () => {
  els.codeInput.value = exampleCode;
  render();
});
els.exportSvg.addEventListener("click", exportSvg);
els.exportPng.addEventListener("click", exportPng);

els.codeInput.value = exampleCode;
els.promptTemplate.value = promptText;
render();
