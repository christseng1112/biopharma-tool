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
- **未排程項目一律回報**，分為兩類：
  - **Unassignable**：沒有任何 Pattern 的 Zone 允許此品項。
  - **Not Scheduled**：超出 100 循環上限，未排入任何批次。

### ⚙️ 3. 系統與資料庫

- **設定檔管理**：支援 JSON 格式的完整設定匯出與匯入 (Export/Import)。匯入前會先做結構驗證，格式不符時**不會套用任何資料**，並在畫面上列出具體錯誤。
- **自動存檔**：變更後 1 秒自動寫入瀏覽器 localStorage（key：`BIOPHARMA_AUTOSAVE`）。若存檔毀損或格式不符，原始內容會被備份到 `BIOPHARMA_AUTOSAVE_CORRUPT_<timestamp>` 並於畫面提示，不會被靜默覆蓋。
- **資料庫編輯器**：內建 GUI 介面，可直接修改元件庫 (Components)、目錄 (Catalog)、裝配圖 (Diagrams) 與滅菌模式 (Patterns)。

---

## 🛠️ 技術棧 (Tech Stack)

| 項目 | 使用技術 |
|---|---|
| Core | React 18 (via CDN, no build step required) |
| Styling | Tailwind CSS (via CDN) |
| Icons | 內建 Lucide 風格 SVG + Font Awesome (via CDN) |
| Compiler | Babel Standalone（瀏覽器端即時編譯） |
| Architecture | Single File HTML |

> ⚠️ **已知限制**：React、Tailwind、Babel、Font Awesome 目前皆透過外部 CDN 載入，**在完全無網路的環境中開啟本檔案會得到空白畫面**。
> 若需在封閉內網使用，請先確認這些 CDN 可達。離線化改版已列入規劃，見 CHANGELOG 的「Planned」段落。

---

## 📖 使用說明 (Usage)

1. **啟動**：直接使用 Chrome 或 Edge 瀏覽器開啟 `index.html`。
2. **🏗️ Plan & Config**
   - 建立製程階段。
   - 選擇 SOP 管組編號並輸入數量（數量必須是大於 0 的整數，否則 Add 按鈕會停用）。
   - 系統會提示該項目是否為庫存品。
3. **📋 Picking List / 📦 Assembly Guide**
   - 查看並下載領料單與組裝工單。
4. **🌡️ Autoclave Calc**
   - 系統會自動帶入 Plan 分頁中需要組裝的管組。
   - 若有額外器具 (如鑷子、濾器)，可在左側手動加入。
   - 系統即時計算並顯示滅菌排程建議。
   - **請務必檢查是否出現 Unassignable 或 Not Scheduled 區塊** — 這些品項不在排程中。
5. **⚙️ Database**
   - 編輯元件庫、目錄與裝配邏輯。
6. **保存**：點擊左側 Sidebar 的 Export 下載 JSON 檔以保存當前進度。

---

## 📦 版本紀錄 (Changelog)

完整紀錄請見 [CHANGELOG](./CHANGELOG)。

---

## 📝 注意事項

- 本工具運行於客戶端瀏覽器，除了載入上述 CDN 資源外不會上傳任何數據至外部伺服器。
- 產生的 Picking List 與 Assembly Guide 是工具自動產生的參考文件，**非受控文件**；正式生產請依所屬品質系統的受控文件作業。
- 預設資料中的 `1” Braided Silicone Tubing Set` 未被任何滅菌 Pattern 的 Zone 收錄，計算時會被列為 Unassignable。若需納入排程，請於 Database 分頁將其加入對應 Zone 的允許清單。

---

Project maintained by [Your Name/Team]
