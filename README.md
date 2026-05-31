Code to Blockly Generator

第一版原型：將 Arduino C 程式轉成教學用的標準化 Blockly / motoBlockly 風格圖像。

這個工具不是 Arduino IDE，也不是線上編譯器。它的目標是讓老師或學生把 AI 產生的 Arduino C 程式貼上來，快速產生可以參考的積木圖，再依照圖像到 motoBlockly、mBlock、Mixly 或其他 Blockly 類工具中實作。

第一版功能

- 貼上 Arduino C 程式後自動產生積木圖。
- 支援 setup() 與 loop() 區段。
- 支援常見入門語法：
  - 變數宣告
  - pinMode()
  - digitalWrite()
  - analogWrite()
  - delay() / delayMicroseconds()
  - millis()
  - Serial.begin()
  - Serial.print() / Serial.println()
  - if / else if / else
  - for
  - while
  - tone() / noTone()
  - Servo.write()
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

motoBlockly 對應狀態

第一版先對應入門教學常用積木，包含：

- setup() / loop()：arduino_setup
- 變數設定：variables_set
- pinMode()：inout_pinmode_val
- digitalWrite()：inout_digital_write_v2
- digitalRead() 條件概念：inout_digital_read_v2
- analogWrite()：inout_analog_write_v2
- analogRead() 條件概念：inout_analog_read_v2
- delay()：delay_custom
- delayMicroseconds()：delayMicroseconds_custom
- millis()：millis
- Serial.begin()：serial_setup
- Serial.print()：serial_print
- Serial.println()：serial_printL
- if / else：controls_if
- for：controls_for
- while：while_do
- tone()：custom_tone_v1
- noTone()：no_tone
- Servo.write()：servo_move
- 無法標準化語句：custom_code

第一版限制

- 這不是完整 C/C++ parser。
- 目前採保守規則辨識常見 Arduino 教學語法。
- 複雜函式、自訂 class、多檔案專案、巨集、指標、複雜 C++ 語法不在第一版範圍。
- motoBlockly 對應目前是第一批常用積木，不是完整 400+ 積木庫。
- 條件式中的巢狀讀取積木目前以文字與 motoBlockly 類型提示呈現，後續可再做成更完整的巢狀視覺積木。

檔案結構

index.html
styles.css
app.js
wordpress-iframe-snippet.html
WORDPRESS-README.md
README.md
server.js

GitHub Pages 只需要：

index.html
styles.css
app.js
wordpress-iframe-snippet.html
WORDPRESS-README.md
README.md
