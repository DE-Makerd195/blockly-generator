# WordPress 建置方式

建議使用 iframe 嵌入，這是最穩定的方式：

1. 將 `arduino-blockly-generator` 整個資料夾上傳到 WordPress 網站可公開讀取的位置。
2. 確認 `index.html` 可用瀏覽器開啟。
3. 到 WordPress 頁面新增「自訂 HTML」區塊。
4. 貼上 `wordpress-iframe-snippet.html` 的內容。
5. 把 iframe 的 `src` 改成你的實際網址。

範例：

```html
<iframe
  title="程式碼轉標準化 Blockly 圖像產生器"
  src="https://your-domain.example/arduino-blockly-generator/index.html"
  style="width:100%;height:980px;border:0;display:block;background:#fff;"
  loading="lazy"
></iframe>
```

如果頁面內容太高或太低，可以調整 `height:980px`。

不建議直接把完整 HTML/CSS/JS 貼進 WordPress 文章內容，因為部分主題與外掛會覆蓋按鈕、文字區、表單與排版樣式。
