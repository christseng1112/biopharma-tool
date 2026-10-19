# Biopharma Production Integration Tool (生技製藥生產整合工具)

這是一個專為生物製藥生產流程設計的單頁應用程式 (Single-Page Application, SPA)。本工具將原本獨立的「管組組裝規劃 (Tubing Planner)」與「滅菌鍋裝載計算 (Autoclave Calculator)」整合為一體，實現了從物料規劃、BOM 表生成到滅菌排程的無縫自動化流程。

本工具封裝於單一 HTML 檔案 `index.html` 中，無需伺服器部署，點擊即可在瀏覽器中運行。

**目前版本：v30.17**（版本號的唯一來源是 `index.html` 中的 `APP_VERSION` 常數；畫面標題與匯出的設定檔皆以此為準）

---

## 🚀 主要功能 (Key Features)

### 🏗️ 1. 管組規劃 (Tubing Planner)

基於 SOP-000022 標準，協助使用者規劃各製程階段所需的管組與耗材。內建資料依據 **SOP-000022 v9.0** 核對。

- **製程階段管理**：自定義生產階段 (如 Production Medium, Harvest 等)。
- **智慧庫存判斷**：自動識別所選管組是否為庫存品 (Stock) 或需自行組裝 (Custom Assembly)。
- **動態 BOM 表**：根據選擇的管組 ID (SOP No.)，自動展開物料清單 (Bill of Materials) 與 ASCII 示意圖。
- **報表生成**：
  - **Picking List (總領料單)**：自動彙總所有階段所需的總管材長度與接頭數量。
  - **Assembly Guide (裝配工單)**：針對非庫存品生成詳細的組裝指引與圖示。
  - **附件 2 Part A (Assembled Amount)**：依 SOP-000022 附件 2 的 Number 跨製程階段加總組裝套數，可勾選要納入的階段；變體 (132/142/212) 併入原編號 (13/14/21) 並列出明細。

### 🌡️ 2. 滅菌鍋計算 (Autoclave Calculator)

基於 SOP-000077 標準，使用貪婪演算法搭配回溯搜尋 (Greedy + Backtracking) 優化滅菌鍋的空間利用。內建 11 個 Loading Pattern 依據 **SOP-000077 v11.0** 附件 1 核對。

- **自動資料串接**：直接從 Planner 匯入需滅菌的「非庫存管組」，無需重複輸入。
- **混合排程**：支援自動匯入的管組 (Group A) 與手動加入的器具配件 (Group B) 混合計算。
- **智慧排程演算法**：根據預設的滅菌模式 (Pattern 1-10) 與區域限制 (Zone Rules)，自動計算最少所需的滅菌循環次數。
- **複雜規則檢核**：支援進階限制邏輯（例如：某區域雖然容量為 6，但剪刀最多只能放 2 把）。
- **結果具決定性**：候選排序為「受 rule 限制者優先 → 數量遞減 → 名稱」，同一組品項無論加入順序為何都得到相同排程。
- **標示解的品質**：排程標題旁的徽章顯示
  - **最佳解 (Optimal)** — 已窮舉所有 Pattern 組合，在目前的裝填規則下無更短排程
  - **近似解 (Heuristic)** — 品項過多或搜尋預算用盡，僅提供貪婪解
  - **不完整 (Incomplete)** — 有品項未能排入，請見下方警示
- **附件 2 Part B (Sterilization Records)**：每鍋排程卡片標示管組編號 (No.)，並產生可複製的 `13 (2) / 21 (1)` 字串與套數；排程下方提供完整 Part B 表可下載。Load # 為排程順序，Cycle No.、Expiry Date、簽名欄位留空供現場填寫。
- **未排程項目一律回報**，分為兩類：
  - **Unassignable**：沒有任何 Pattern 的 Zone 允許此品項。
  - **Not Scheduled**：超出 100 循環上限，未排入任何批次。
- **排程表可下載**：與領料單、裝配工單相同格式的獨立 HTML，含來源資訊、
  結果品質標示與未排程警示區塊，供現場列印與逐項打勾。
- **Zone 限制可於 UI 編輯**：各 Zone 的 Constraints（如「剪刀最多 2 把」）
  可直接新增、調整上限、選擇受限品項與刪除，不再需要改 JSON 匯入。
- **編輯期間不卡頓**：Pattern 或購物車變更後排程以延後方式重算，輸入框維持
  即時回應。重算期間標題旁顯示 **計算中**，且下載按鈕暫時停用 —— 確保下載到的
  排程一定與畫面上的一致，不會拿到依舊設定算出的結果。

### ⚙️ 3. 系統與資料庫

- **設定檔管理**：支援 JSON 格式的完整設定匯出與匯入 (Export/Import)。匯入前會先做結構驗證，格式不符時**不會套用任何資料**，並在畫面上列出具體錯誤。
- **自動存檔**：變更後 1 秒自動寫入瀏覽器 localStorage（key：`BIOPHARMA_AUTOSAVE`）。若存檔毀損或格式不符，原始內容會被備份到 `BIOPHARMA_AUTOSAVE_CORRUPT_<timestamp>` 並於畫面提示，不會被靜默覆蓋。
- **資料依據 (Data Basis)**：記錄 SOP 資料（Components / Catalog / 示意圖 / BOM）核對所依據的文件與版本，並印在每份報表的來源區塊。資料在記錄後被修改時，報表會標示「記錄後資料已修改」。SOP 進版時，於 Database 分頁更新資料後記錄新版本即可。
- **Pattern 依據 (Pattern Basis)**：滅菌 Pattern 另有一份依據（預設 SOP-000077 v11.0），印在滅菌排程表與附件 2 Part B，規則同上。
- **批號與列印**：Plan 分頁輸入的批號／工單號會印在所有報表；未填則印一條空白線供手寫。每份報表都有 🖨️ Print，跨頁重複表頭、表格列不被切斷；紙張與直向／橫向於列印對話框選擇。
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
| Test | Vitest（單元）＋ Playwright（e2e，對建置產物） |
| Type check | JSDoc typedef + `tsc --checkJs`（無 `.ts` 檔、無轉譯） |
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
  lib/reports.js            領料單、裝配工單與滅菌排程表的 HTML 產生器
  lib/config.js             APP_VERSION、存檔 key、validateConfig
  lib/dataBasis.js          資料依據指紋與報表標示
  lib/forms.js              SOP-000022 附件 2 Part A / Part B 的編號對應與彙總
  lib/format.js             時間戳格式化（報表來源區塊與匯出檔名共用）
  lib/types.js              JSDoc typedef（核心資料形狀，無執行期程式碼）
  lib/download.js           檔案下載
  lib/globalErrorHandler.js 全域錯誤安全網
  data/defaults.js          預設資料集
  components/               Icons、Notice、ErrorBoundary、三個編輯器、
                            AutoclaveModule、App
  main.jsx                  進入點
  styles.css                Tailwind directives + 專案樣式
tests/                      Vitest 單元測試
tests/e2e/                  瀏覽器端對端測試（無瀏覽器時自動 skip）
scripts/publish.mjs         把 dist/index.html 發佈為 ./index.html
scripts/verify-offline.mjs  驗證產物真的自包含
```

```bash
npm install

npm run dev             # 開發伺服器（hot reload）
npm test                # 執行測試
npm run typecheck       # tsc --checkJs（範圍限 src/lib 與 src/data）
npm run build           # 建置並更新 ./index.html
npm run verify:offline  # 驗證產物零外部請求且能離線渲染
npm run test:e2e        # 瀏覽器端對端測試（對建置後的 index.html）
npm run check           # typecheck + test + build + verify:offline + test:e2e
```

型別檢查以 JSDoc 進行，專案沒有 `.ts` 檔也沒有轉譯步驟：`src/lib/types.js` 用
`@typedef` 寫下核心資料形狀，各模組以 `import('./types.js')` 引用。範圍刻意限定
在 `src/lib` 與 `src/data` —— 純邏輯與資料，也正是計算生產數字的部分；
`components/` 不納入，避免為了滿足檢查而扭曲 React 慣用寫法。

CI（GitHub Actions，`.github/workflows/check.yml`）在每次 push / PR 執行
`npm run check`，並額外驗證 commit 的 `index.html` 與 `src/` 建置結果一致 ——
改了原始碼忘記重建、或手改產物，都會被擋下。

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
   - 於最上方輸入 **批號 / 工單號 (Batch No.)**（選填，印在所有報表）。
   - 選擇 SOP 管組編號並輸入數量（數量必須是大於 0 的整數，否則 Add 按鈕會停用）。
   - 系統會提示該項目是否為庫存品。
   - 已加入的項目可直接在 Current Assignments 修改數量；只接受大於 0 的整數。
3. **📋 Picking List / 📦 Assembly Guide / 📝 附件 2 Part A**
   - 查看、列印 (🖨️ Print) 並下載領料單、組裝工單與附件 2 Part A；Part A 可勾選要納入的製程階段。
   - 每份報表的標題下方均附有來源區塊：產生時間、工具版本、資料來源，以及「非受控文件」聲明。
4. **🌡️ Autoclave Calc**
   - 系統會自動帶入 Plan 分頁中需要組裝的管組。
   - 若有額外器具 (如鑷子、濾器)，可在左側手動加入。
   - 系統即時計算並顯示滅菌排程建議。
   - **請務必檢查是否出現 Unassignable 或 Not Scheduled 區塊** — 這些品項不在排程中。
   - 每鍋卡片底部的「附件 2 Part B」字串可直接複製填入；完整 Part B 表在排程下方。
   - **Include Stock** 的勾選會保留（切換分頁或重新開啟都不會重設）。
   - 舊存檔的 Pattern 不會自動更新。Pattern Configuration 的 **↺ 還原為預設 Pattern** 只重設 Pattern 與 Group B 清單，規劃與 Database 資料不受影響。
5. **⚙️ Database**
   - 新增／編輯／刪除元件庫與目錄項目，並編輯裝配圖與 BOM。
   - 變更需按各區塊的 **Save Changes** 才會套用；結果會以區塊內的訊息列回報。
   - 依 SOP 核對完成後，於最上方 **Data Basis** 與 **Pattern Basis** 區塊輸入依據文件與版本（例：`SOP-000022 v9.0`、`SOP-000077 v11.0`）並記錄。
6. **保存**：點擊左側 Sidebar 的 Export 下載 JSON 檔以保存當前進度。

---

## 📦 版本紀錄 (Changelog)

完整紀錄請見 [CHANGELOG](./CHANGELOG)。

---

## 📝 注意事項

- 本工具完全運行於客戶端瀏覽器，不發出任何外部請求，也不會上傳任何數據。
- 產生的 Picking List 與 Assembly Guide 是工具自動產生的參考文件，**非受控文件**；正式生產請依所屬品質系統的受控文件作業。
- No.21 Pump Tubing Set 620 的兩種組裝方式分別為 No.21（末端 W, Mini TC）與 No.212（兩端 Empty End）。
- v30.14 以前的自動存檔沒有資料依據，載入後顯示「未記錄」，請核對後於 Database 分頁記錄。
- DO / pH Probe 依探頭套類型分為 bellows sheath（Pattern 9，P04）與 click-in sheath（Pattern 11，P10）兩種品項，請依實際探頭套選擇。
- v30.16 以前的自動存檔仍帶著舊 Pattern（No.26 會列為 Unassignable、沒有 Pattern 11），請於 Autoclave 分頁按「還原為預設 Pattern」。

### 共用工作站的存檔行為

自動存檔寫入的是**瀏覽器 profile 的 localStorage**，不是檔案系統上的檔案。這帶來三個
實務上的限制，在多人共用工作站的現場特別容易踩到：

- **同一個 Windows 帳號、同一個瀏覽器 = 同一份存檔。** 交接班的兩位操作員若都用
  同一台工作站的同一個帳號登入，後開啟的人會看到前一位留下的規劃，而自己的變更
  也會在 1 秒後覆蓋掉對方的 —— 兩份工作無法並存。
- **不同的 Windows 帳號、或不同瀏覽器（Chrome / Edge）各自獨立。** 在 A 帳號存的
  東西，在 B 帳號開同一個 `index.html` 是看不到的。
- **清除瀏覽器資料會一併清掉存檔。** 這通常由 IT 政策或使用者自行觸發，工具無從
  攔截。

因此**自動存檔只應視為單一使用者、單一 session 的暫存**，不是保存機制。

**交接與長期保存請一律使用 Export**：左側 Sidebar 的 Export 會下載一份帶時間戳的
JSON（`biopharma_prod_config_YYYY-MM-DD_HHmm.json`），放到共用磁碟或隨工單留存；
接手的人以 Import 載入即可完整還原。檔名含時間戳，連續匯出不會互相覆蓋，報表的
來源區塊也能對應到具體是哪一次匯出的設定。

---

## 授權 (License)

本工具為內部使用工具，著作權歸屬本專案維護單位所有，未經授權不得對外散布。
完整條款見 [LICENSE](./LICENSE)。

> 上述「本專案維護單位」為中性寫法，可自行替換為實際的單位或團隊名稱
>（README 與 LICENSE 兩處需一併修改）。
