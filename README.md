# Code to Blockly Generator

第一版原型：將 Arduino C 程式轉成教學用的標準化 Blockly / motoBlockly 風格圖像。

這個工具不是 Arduino IDE，也不是線上編譯器。它的目標是讓老師或學生把 AI 產生的 Arduino C 程式貼上來，快速產生可以參考的積木圖，再依照圖像到 motoBlockly、mBlock、Mixly 或其他 Blockly 類工具中實作。

## 第一版功能

- 貼上 Arduino C 程式後自動產生積木圖。
- 支援 `setup()` 與 `loop()` 區段。
- 支援常見入門語法：
  - 變數宣告
  - `pinMode()`
  - `digitalWrite()`
  - `analogWrite()`
  - `delay()` / `delayMicroseconds()`
  - `millis()`
  - `Serial.begin()`
  - `Serial.print()` / `Serial.println()`
  - `if / else if / else`
  - `for`
  - `while`
  - `tone()` / `noTone()`
  - `Servo.write()`
- 支援板子提示：
  - Arduino Uno
  - Arduino Nano
  - Arduino Leonardo
  - ESP8266
  - D1 mini
  - ESP32
- 標示第一批 motoBlockly 對應 block type。
- 可切換「積木圖」與「清單」模式。
- 可下載 SVG。
- 可下載 PNG。
- 可嵌入 WordPress 頁面。

## motoBlockly 對應狀態

第一版先對應入門教學常用積木，包含：

| Arduino C / 結構 | motoBlockly block type |
|---|---|
| `setup()` / `loop()` | `arduino_setup` |
| 變數設定 | `variables_set` |
| `pinMode()` | `inout_pinmode_val` |
| `digitalWrite()` | `inout_digital_write_v2` |
| `digitalRead()` 條件概念 | `inout_digital_read_v2` |
| `analogWrite()` | `inout_analog_write_v2` |
| `analogRead()` 條件概念 | `inout_analog_read_v2` |
| `delay()` | `delay_custom` |
| `delayMicroseconds()` | `delayMicroseconds_custom` |
| `millis()` | `millis` |
| `Serial.begin()` | `serial_setup` |
| `Serial.print()` | `serial_print` |
| `Serial.println()` | `serial_printL` |
| `if / else` | `controls_if` |
| `for` | `controls_for` |
| `while` | `while_do` |
| `tone()` | `custom_tone_v1` |
| `noTone()` | `no_tone` |
| `Servo.write()` | `servo_move` |
| 無法標準化語句 | `custom_code` |

## 第一版限制

- 這不是完整 C/C++ parser。
- 目前採保守規則辨識常見 Arduino 教學語法。
- 複雜函式、自訂 class、多檔案專案、巨集、指標、複雜 C++ 語法不在第一版範圍。
- motoBlockly 對應目前是第一批常用積木，不是完整 400+ 積木庫。
- 條件式中的巢狀讀取積木目前以文字與 motoBlockly 類型提示呈現，後續可再做成更完整的巢狀視覺積木。

## 檔案結構

```text
index.html
styles.css
app.js
wordpress-iframe-snippet.html
WORDPRESS-README.md
server.js
```

GitHub Pages 只需要：

```text
index.html
styles.css
app.js
wordpress-iframe-snippet.html
WORDPRESS-README.md
README.md
```

`server.js` 只是在本機測試時可選用，GitHub Pages 不需要。

## 本機開啟

直接用瀏覽器開啟：

```text
index.html
```

或使用本機 server：

```bash
node server.js
```

然後開啟：

```text
http://127.0.0.1:5173/
```

## 部署到 GitHub Pages

1. 建立 GitHub repository。
2. 將檔案放在 repository 根目錄。
3. 到 repository 的 `Settings`。
4. 點左側 `Pages`。
5. 在 `Build and deployment` 選：
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
6. 儲存。
7. 等待 GitHub Pages 建置完成。

網址通常會是：

```text
https://你的帳號.github.io/你的repo名稱/
```

## 嵌入 WordPress

建議使用 iframe 嵌入，避免 WordPress 主題或外掛影響工具樣式。

```html
<iframe
  title="程式碼轉標準化 Blockly 圖像產生器"
  src="https://你的帳號.github.io/你的repo名稱/"
  style="width:100%;height:980px;border:0;display:block;background:#fff;"
  loading="lazy"
></iframe>
```

如果 WordPress.com 方案不允許 iframe，可以改放連結按鈕，讓使用者開新頁使用。

## 適合用途

- Arduino 入門課程講義
- AI 產生程式後的教學轉譯
- 學生照圖到 motoBlockly 拉積木
- 老師快速產生流程圖或教學圖像
- 比較 Arduino C 與 Blockly 積木邏輯

## 後續方向

- 補完整 motoBlockly block 對應表。
- 支援 DHT、超音波、LCD/OLED、WS2812、RFID、IR、馬達車等硬體模組。
- 條件式內部改成真正巢狀讀取積木。
- 依板子模式切換 Arduino / ESP8266 / ESP32 對應積木。
- 加入更完整的錯誤提示與教學建議。
- 提供課程範例模板。
