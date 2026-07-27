# Biopharma Production Integration Tool (生技製藥生產整合工具)

這是一個專為生物製藥生產流程設計的單頁應用程式 (Single-Page Application, SPA)。本工具將原本獨立的「管組組裝規劃 (Tubing Planner)」與「滅菌鍋裝載計算 (Autoclave Calculator)」整合為一體，實現了從物料規劃、BOM 表生成到滅菌排程的無縫自動化流程。

本工具封裝於單一 HTML 檔案 `index.html` 中，無需伺服器部署，點擊即可在瀏覽器中運行。

**目前版本：v30.11**（版本號的唯一來源是 `index.html` 中的 `APP_VERSION` 常數；畫面標題與匯出的設定檔皆以此為準）

---

## 🚀 主要功能 (Key Features)

### 🏗️ 1. 管組規劃 (Tubing Planner)

基於 SOP-000022 標準，協助使用者規劃各製程階段所需的管組與耗材。

- **製程階段管理**：自定義生產階段 (如 Production Medium, Harvest 等)。
- **智慧庫存判斷**：自動識別所選管組是否為庫存品 (Stock) 或需自行組裝 (Custom Assembly)。
- **動態 BOM 表**：根據選擇的管組 ID (SOP No.)，自動展開物料清單 (Bill of Materials) 與 ASCII 示意圖。
- **報表生成**：
  - **Picking List (總領料單)**：自動彙總所有階段所需的總管材長度與接頭數量。
  - **Assembly Guide (裝配工單)**：針對非庫存品生成詳細的組裝指引與圖示。

### 🌡️ 2. 滅菌鍋計算 (Autoclave Calculator)

基於 SOP-000077 標準，使用貪婪演算法搭配回溯搜尋 (Greedy + Backtracking) 優化滅菌鍋的空間利用。

- **自動資料串接**：直接從 Planner 匯入需滅菌的「非庫存管組」，無需重複輸入。
- **混合排程**：支援自動匯入的管組 (Group A) 與手動加入的器具配件 (Group B) 混合計算。
- **智慧排程演算法**：根據預設的滅菌模式 (Pattern 1-10) 與區域限制 (Zone Rules)，自動計算最少所需的滅菌循環次數。
- **複雜規則檢核**：支援進階限制邏輯（例如：某區域雖然容量為 6，但剪刀最多只能放 2 把）。
- **結果具決定性**：候選排序為「受 rule 限制者優先 → 數量遞減 → 名稱」，同一組品項無論加入順序為何都得到相同排程。
- **標示解的品質**：排程標題旁的徽章顯示
  - **最佳解 (Optimal)** — 已窮舉搜尋，不存在更短的排程
  - **近似解 (Heuristic)** — 品項過多或搜尋預算用盡，僅提供貪婪解
  - **不完整 (Incomplete)** — 有品項未能排入，請見下方警示
- **未排程項目一律回報**，分為兩類：
  - **Unassignable**：沒有任何 Pattern 的 Zone 允許此品項。
  - **Not Scheduled**：超出 100 循環上限，未排入任何批次。

### ⚙️ 3. 系統與資料庫

- **設定檔管理**：支援 JSON 格式的完整設定匯出與匯入 (Export/Import)。匯入前會先做結構驗證，格式不符時**不會套用任何資料**，並在畫面上列出具體錯誤。
- **自動存檔**：變更後 1 秒自動寫入瀏覽器 localStorage（key：`BIOPHARMA_AUTOSAVE`）。若存檔毀損或格式不符，原始內容會被備份到 `BIOPHARMA_AUTOSAVE_CORRUPT_<timestamp>` 並於畫面提示，不會被靜默覆蓋。
- **資料庫編輯器**：內建 GUI 介面，可新增／修改／刪除元件庫 (Components) 與目錄 (Catalog)，並編輯裝配圖 (Diagrams)、BOM 與滅菌模式 (Patterns)。刪除前會檢查是否仍被 BOM 或 Assignment 引用，被引用時拒絕刪除。
- **錯誤處理**：渲染錯誤由 React Error Boundary 接住並顯示錯誤內容與復原選項，不會變成空白畫面；其餘錯誤由頁面內橫幅呈現。全程不使用 `alert()`。

---

## 🛠️ 技術棧 (Tech Stack)

| 項目 | 使用技術 |
|---|---|
| Core | React 18（production build，建置時打包） |
| Styling | Tailwind CSS（建置時 purge 後內嵌） |
| Icons | 內建 Lucide 風格 inline SVG（無外部圖示字型） |
| Build | Vite + `vite-plugin-singlefile` |
| Test | Vitest |
| Architecture | Single File HTML（零外部請求） |

> ✅ **完全離線可用**：`index.html` 內嵌所有資源，開啟時不會發出任何外部請求。
> 可直接複製到無網路的 GMP 內網工作站，以 Chrome 或 Edge 開啟即可使用。
> 此性質由 `npm run verify:offline` 自動驗證（見下方「開發」）。

---

## 🧑‍💻 開發 (Development)

`index.html` 是**建置產物**，請勿直接編輯 — 原始碼在 `src/`。

```
src/
  lib/normalize.js          normalizeName / escapeHtml / normalizePatterns
  lib/scheduler.js          simulateLoad / runGreedySimulation / calculateSchedule
  lib/reports.js            領料單與裝配工單的 HTML 產生器
  lib/config.js             APP_VERSION、存檔 key、validateConfig
  lib/download.js           檔案下載
  lib/globalErrorHandler.js 全域錯誤安全網
  data/defaults.js          預設資料集
  components/               Icons、Notice、ErrorBoundary、三個編輯器、
                            AutoclaveModule、App
  main.jsx                  進入點
  styles.css                Tailwind directives + 專案樣式
tests/                      Vitest 測試
scripts/publish.mjs         把 dist/index.html 發佈為 ./index.html
scripts/verify-offline.mjs  驗證產物真的自包含
```

```bash
npm install

npm run dev             # 開發伺服器（hot reload）
npm test                # 執行測試
npm run build           # 建置並更新 ./index.html
npm run verify:offline  # 驗證產物零外部請求且能離線渲染
npm run check           # test + build + verify:offline
```

`verify:offline` 分兩部分：

- **靜態檢查**（無外部參照、production React、無 Babel、樣式與腳本已內嵌）——
  一律執行，任一項不過即以非 0 結束。
- **實際渲染檢查**（在封鎖所有非 `file://` 請求的瀏覽器中開啟並巡覽全部分頁）——
  **選用**。`npm install` 不會下載瀏覽器二進位，未安裝時此段會顯示 skip 並照常通過。
  要啟用請執行一次：

  ```bash
  npx playwright install chromium
  ```

`npm run build` 產生 `dist/index.html` 後由 `scripts/publish.mjs` 複製為根目錄的
`index.html`；若產物中仍存在任何外部參照，publish 會直接失敗而不發佈。

---

## 📖 使用說明 (Usage)

1. **啟動**：直接使用 Chrome 或 Edge 瀏覽器開啟 `index.html`。
2. **🏗️ Plan & Config**
   - 建立製程階段。
   - 選擇 SOP 管組編號並輸入數量（數量必須是大於 0 的整數，否則 Add 按鈕會停用）。
   - 系統會提示該項目是否為庫存品。
3. **📋 Picking List / 📦 Assembly Guide**
   - 查看並下載領料單與組裝工單。
   - 每份報表的標題下方均附有來源區塊：產生時間、工具版本、資料來源，以及「非受控文件」聲明。
4. **🌡️ Autoclave Calc**
   - 系統會自動帶入 Plan 分頁中需要組裝的管組。
   - 若有額外器具 (如鑷子、濾器)，可在左側手動加入。
   - 系統即時計算並顯示滅菌排程建議。
   - **請務必檢查是否出現 Unassignable 或 Not Scheduled 區塊** — 這些品項不在排程中。
5. **⚙️ Database**
   - 新增／編輯／刪除元件庫與目錄項目，並編輯裝配圖與 BOM。
   - 變更需按各區塊的 **Save Changes** 才會套用；結果會以區塊內的訊息列回報。
6. **保存**：點擊左側 Sidebar 的 Export 下載 JSON 檔以保存當前進度。

---

## 📦 版本紀錄 (Changelog)

完整紀錄請見 [CHANGELOG](./CHANGELOG)。

---

## 📝 注意事項

- 本工具完全運行於客戶端瀏覽器，不發出任何外部請求，也不會上傳任何數據。
- 產生的 Picking List 與 Assembly Guide 是工具自動產生的參考文件，**非受控文件**；正式生產請依所屬品質系統的受控文件作業。
- 預設資料中的 `1” Braided Silicone Tubing Set` 未被任何滅菌 Pattern 的 Zone 收錄，計算時會被列為 Unassignable。若需納入排程，請於 Database 分頁將其加入對應 Zone 的允許清單。

---

Project maintained by [Your Name/Team]
