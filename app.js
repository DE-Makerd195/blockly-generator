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
    return block("function", "程式區塊", functionMatch[1] === "setup" ? "setup() 開始設定" : "loop() 重複執行", true);
  }

  if (/^#include/.test(simple)) return block("meta", "函式庫", simple);

  const declaration = simple.match(/^(?:const\s+)?(?:int|float|long|bool|boolean|byte|char|String)\s+([A-Za-z_]\w*)\s*=\s*(.+)$/);
  if (declaration) {
    collectPin(declaration[2], stats);
    return block("custom", "變數", `設定 ${declaration[1]} 為 ${declaration[2]}`);
  }

  const pinMode = simple.match(/^pinMode\s*\((.+),\s*(INPUT_PULLUP|INPUT|OUTPUT)\)$/);
  if (pinMode) {
    collectPin(pinMode[1], stats);
    return block("pin", "腳位模式", `把 ${pinMode[1]} 設為 ${translateMode(pinMode[2])}`);
  }

  const digitalWrite = simple.match(/^digitalWrite\s*\((.+),\s*(HIGH|LOW)\)$/);
  if (digitalWrite) {
    collectPin(digitalWrite[1], stats);
    return block("pin", "數位輸出", `讓 ${digitalWrite[1]} ${digitalWrite[2] === "HIGH" ? "輸出 HIGH / 亮起" : "輸出 LOW / 熄滅"}`);
  }

  const analogWrite = simple.match(/^analogWrite\s*\((.+),\s*(.+)\)$/);
  if (analogWrite) {
    collectPin(analogWrite[1], stats);
    return block("pin", "PWM 輸出", `讓 ${analogWrite[1]} 輸出 PWM ${analogWrite[2]}`);
  }

  const delayMatch = simple.match(/^delay(?:Microseconds)?\s*\((.+)\)$/);
  if (delayMatch) {
    const unit = simple.startsWith("delayMicroseconds") ? "微秒" : "毫秒";
    return block("timing", "等待", `等待 ${delayMatch[1]} ${unit}`);
  }

  const serialBegin = simple.match(/^Serial\.begin\s*\((.+)\)$/);
  if (serialBegin) return block("serial", "序列埠", `啟動 Serial，鮑率 ${serialBegin[1]}`);

  const serialPrint = simple.match(/^Serial\.(print|println)\s*\((.*)\)$/);
  if (serialPrint) return block("serial", "序列輸出", `顯示 ${serialPrint[2] || "空行"}`);

  const ifMatch = simple.match(/^if\s*\((.+)\)$/);
  if (ifMatch) return block("control", "如果", convertCondition(ifMatch[1]), true);

  const elseIfMatch = simple.match(/^else\s+if\s*\((.+)\)$/);
  if (elseIfMatch) return block("control", "否則如果", convertCondition(elseIfMatch[1]), true);

  if (/^else$/.test(simple)) return block("control", "否則", "前面條件不成立時", true);

  const forMatch = simple.match(/^for\s*\((.+)\)$/);
  if (forMatch) return block("control", "重複", `for：${forMatch[1]}`, true);

  const whileMatch = simple.match(/^while\s*\((.+)\)$/);
  if (whileMatch) return block("control", "當成立時重複", convertCondition(whileMatch[1]), true);

  const toneMatch = simple.match(/^(tone|noTone)\s*\((.*)\)$/);
  if (toneMatch) return block("pin", "蜂鳴器", `${toneMatch[1]}(${toneMatch[2]})`);

  const servoMatch = simple.match(/^([A-Za-z_]\w*)\.write\s*\((.+)\)$/);
  if (servoMatch) return block("pin", "伺服馬達", `讓 ${servoMatch[1]} 轉到 ${servoMatch[2]} 度`);

  if (/\bmillis\s*\(\s*\)/.test(simple)) return block("timing", "計時", simple);

  stats.warnings.push(`未標準化：${simple}`);
  return block("custom", "自訂程式", simple);
}

function block(type, kind, label, opens = false) {
  return { type, kind, label, opens, children: [] };
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
    title.className = "section-label";
    title.innerHTML = `<span class="section-name"></span><span class="section-role"></span>`;
    title.querySelector(".section-name").textContent = isLoop ? "loop()" : "setup()";
    title.querySelector(".section-role").textContent = isLoop ? "重複執行區" : "開始設定區";
    wrap.append(title);
    const childStack = document.createElement("div");
    childStack.className = "stack function-body";
    node.children.forEach((child) => childStack.append(renderNode(child)));
    wrap.append(childStack);
    return wrap;
  }

  const blockEl = document.createElement("div");
  blockEl.className = `blockly-block ${node.type}${node.opens ? " has-mouth" : ""}`;
  blockEl.innerHTML = `<span class="gear" aria-hidden="true"></span><span class="kind"></span><span class="label"></span>`;
  blockEl.querySelector(".kind").textContent = node.kind;
  blockEl.querySelector(".label").innerHTML = formatBlocklyLabel(node.label);
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
    li.textContent = `${item.kind}：${item.label}`;
    els.outlineView.append(li);
  });
}

function flatten(nodes, depth = 0) {
  return nodes.flatMap((node) => [
    { kind: node.kind, label: node.label, depth },
    ...flatten(node.children || [], depth + 1)
  ]);
}

function renderHandoff(stats) {
  const pins = Array.from(stats.pins);
  const items = [
    ["語言", els.languageSelect.options[els.languageSelect.selectedIndex].textContent, languageHints[els.languageSelect.value]],
    ["板子", els.boardSelect.options[els.boardSelect.selectedIndex].textContent, boardHints[els.boardSelect.value]],
    ["腳位", pins.length ? pins.join("、") : "尚未辨識腳位", "若使用變數命名，建議採用 ledPin、buttonPin、pumpPin 等清楚名稱。"],
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
  const rows = flattenForExport(latestModel);
  const width = 1120;
  const rowHeight = 46;
  const height = Math.max(190, rows.length * rowHeight + 78);
  const colors = { 腳位模式: "#4f88c6", 數位輸出: "#4f88c6", "PWM 輸出": "#4f88c6", 等待: "#d99b32", 如果: "#5f8fc2", 否則: "#5f8fc2", 否則如果: "#5f8fc2", 重複: "#5f8fc2", 當成立時重複: "#5f8fc2", 序列埠: "#55aa91", 序列輸出: "#55aa91" };
  const rowMarkup = rows.map((row, index) => {
    const y = 54 + index * rowHeight;
    const x = 24 + row.depth * 34;
    if (row.section) {
      return `<text x="${x}" y="${y + 25}" font-family="Segoe UI, Noto Sans TC, Arial" font-size="17" font-weight="600" fill="#5f3c75">${escapeXml(row.label)}</text><line x1="${x}" y1="${y + 35}" x2="${width - 34}" y2="${y + 35}" stroke="#d9dfd7"/>`;
    }
    const w = Math.max(360, width - x - 34);
    const color = colors[row.kind] || "#7c8580";
    const label = escapeXml(`${row.kind}：${row.label}`);
    return `<path d="M ${x + 7} ${y} H ${x + w} V ${y + 36} H ${x + 72} q -5 0 -8 5 q -3 5 -8 0 q -3 -5 -8 -5 H ${x + 7} q -7 0 -7 -7 V ${y + 7} q 0 -7 7 -7 Z" fill="${color}" stroke="rgba(0,0,0,.18)"/><text x="${x + 18}" y="${y + 24}" font-family="Segoe UI, Noto Sans TC, Arial" font-size="16" font-weight="400" fill="#fff">${label}</text>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="4" cy="4" r="1.2" fill="#cfd8d1"/></pattern></defs>
    <rect width="100%" height="100%" fill="#fbfcfa"/>
    <rect width="100%" height="100%" fill="url(#dots)"/>
    <text x="24" y="34" font-family="Segoe UI, Noto Sans TC, Arial" font-size="21" font-weight="600" fill="#5f3c75">Code to Blockly</text>
    ${rowMarkup}
  </svg>`;
}

function flattenForExport(nodes, depth = 0) {
  return nodes.flatMap((node) => {
    if (node.type === "function") {
      return [
        { section: true, label: node.label, depth },
        ...flattenForExport(node.children || [], depth + 1)
      ];
    }
    return [
      { kind: node.kind, label: node.label, depth },
      ...flattenForExport(node.children || [], depth + 1)
    ];
  });
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
