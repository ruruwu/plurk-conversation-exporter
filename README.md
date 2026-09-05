# Plurk Conversation Exporter v0.2

Chrome Extension prototype，用來把目前 Plurk 頁面的主噗與回覆整理成可直接貼到 Google Docs 的富文字，並盡可能保留 inline 圖片與表符。

## 安裝

1. 開啟 `chrome://extensions/`
2. 開啟右上角「開發人員模式」
3. 點「載入未封裝項目」
4. 選擇本資料夾
5. 打開一則 Plurk 交流頁
6. 點工具列上的 Extension 圖示開啟側邊欄
7. 在側邊欄按「擷取目前噗文」
8. 預覽確認後按「複製預覽內容」
9. 在 Google Docs 直接 Ctrl+V / Cmd+V

側邊欄預設不會隨 Plurk 頁面載入自動開啟。開啟後會維持開啟狀態，直到使用者主動關閉。

## v0.2 變更

- 預覽由 textarea 改成真正的 HTML 富文字預覽
- 主要按鈕改為「複製到 Google Docs」
- Clipboard 同時寫入 `text/html` + `text/plain`
- 不再把 HTML 原始碼當純文字複製
- 複製前嘗試 fetch 每張 Plurk 圖片 / 表符並轉成 data URL 內嵌到 HTML
- 如果個別圖片無法下載，退回原始絕對網址
- 保留「複製純文字」作為 fallback

## 驗收目標

理想操作只有：

1. 擷取 Plurk 交流
2. 按一次「複製到 Google Docs」
3. Google Docs 貼上

預期保留：

- 對話順序
- 發言者
- 換行
- inline 表符位置
- 一般圖片位置

## 尚待實機確認

1. 2026 年 Plurk 實際 DOM class 是否完全符合 `content.js` selector。
2. Google Docs 對 `data:` 圖片的實際貼上行為。若 Docs 過濾 data URI，extension 會對無法內嵌的圖片使用原始 Plurk 圖片網址；必要時下一版可改成另一種圖片搬運策略。
3. 自訂表符若不是由 `*.plurk.com` 提供，可能無法被 extension 主動下載，但 HTML 仍會保留原始網址。


## v0.2.1
- 修正 plurk.com（無 www）與 Plurk 子網域未載入 content script 的問題。
- 若既有分頁尚未載入 content script，popup 會自動注入後重試。


## v0.4 修正
- Google Docs 富文字＋圖片複製流程維持 v0.3 原樣，不修改。
- 保留「保留發言者」與「保留圖片 / 表符」選項。
- 保留純文字輸出。
- 修正首樓可能同時被主噗 DOM 與 response DOM 擷取而重複一次的問題。
- 增加相鄰完全相同項目的最後一道去重保護；不會全域刪除內容相同但位於不同位置的真實回覆。


## v0.5 擷取核心修正
- Google Docs 富文字＋圖片複製功能完全沿用 v0.4，`popup.js` 未修改。
- 保留純文字輸出、保留發言者、保留圖片 / 表符選項。
- 移除所有「依留言內容 / fingerprint 去重」邏輯。
- 依 Plurk 真實資料識別：
  - `data-pid` = 噗文 ID
  - `data-rid` = 回覆 ID
- 河道模式主噗：用 `#plurk_cnt_<pid>` 擷取。
- 獨立頁主噗：用 `[data-type="plurk"][data-pid="<pid>"]` 擷取。
- 回覆優先從 `.list-container .list` 的 canonical response DOM 擷取。
- 僅在同一個 `data-rid` 出現多份 DOM 時去重；不同 `data-rid` 即使內容完全相同也全部保留。


## v0.6 文字格式 / 語法保留
- 延續 v0.5 的 `data-pid` / `data-rid` 擷取與去重邏輯。
- Google Docs 的圖片複製策略不變。
- 富文字輸出保留：
  - 粗體
  - 斜體
  - 底線
  - 刪除線
  - code
  - 上標 / 下標
  - 超連結
  - 換行
- 純文字與 CxC 文字稿會將格式轉為可攜的文字語法，例如 `**粗體**`、`*斜體*`、`~~刪除線~~`、`[文字](網址)`。
- 「保留發言者」與「保留圖片 / 表符」選項維持不變。


## v0.7 介面精簡
- 移除「複製 CxC 文字稿」按鈕與相關文案。
- 保留兩種主要輸出：
  - 「複製到 Google Docs」：富文字＋圖片 / 表符。
  - 「複製純文字」：可攜式文字語法；圖片 / 表符轉成文字標記。
- 保留「下載圖片 / 表符」功能。
- `data-pid` / `data-rid` 擷取邏輯不變。
- Google Docs 富文字＋圖片複製策略不變。

## DOCX 可靠模式

- 新增「匯出 DOCX（可靠模式）」按鈕，原有複製、純文字及圖片下載功能維持不變。
- 匯出時會先下載圖片與表符，並將檔案內容直接嵌入 DOCX；上傳到 Google Drive 後可用 Google 文件開啟，不依賴貼上後再向 Plurk 載入圖片。
- DOCX 採 Google Docs 友善的 Arial 11 pt、Letter 紙張與 1 吋邊界，並保留發言者、段落、行內格式、連結及圖片位置。
- 無法下載或轉換的個別圖片會改成文字標記，其餘內容仍會正常匯出。
- 支援 Plurk 表符 CDN 將 PNG、JPEG、GIF、WebP 或 SVG 回傳為 `application/octet-stream` 的情況；會先檢查實際檔頭，再供 DOCX 嵌入與圖片下載共用。

## v0.8 介面調整

- popup 改為 Chrome Side Panel，內容寬度設定為 400px。
- 將操作分為「擷取設定」、「複製格式化內容」、「複製純文字與下載圖片／表符」及「匯出 Word 文件」四個可收合區塊。
- 「複製預覽內容」會複製預覽中的文字與格式；勾選保留圖片與表符時，也會一併帶入。
- 「複製純文字」與「下載圖片與表符」歸在同一個流程，適合不支援富文字貼上的平台。
- Word 文件匯出維持獨立流程，可自行嵌入文字、格式、圖片與表符。

## v1.0

- 版本號更新為 `1.0.0`；Chrome icon 尺寸可自行準備 16、32、48、128 px PNG，未內建特定 icon。
- 「複製格式化內容」狀態會顯示圖片來源數量，並說明圖片顯示取決於目標編輯器。
- 「複製純文字」會使用 `[圖片1]`、`[圖片2]` 等編號，與圖片 ZIP 內的檔案對應。
- 「下載圖片與表符」會打包為單一 ZIP，內含 `images/` 資料夾與 `圖片對照表.txt`。
- ZIP 對照表會列出每個圖片編號、檔名及下載成功／失敗狀態；狀態列也會顯示失敗數量。
