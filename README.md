Biopharma Production Integration Tool (生技製藥生產整合工具)

這是一個專為生物製藥生產流程設計的單頁應用程式 (Single-Page Application, SPA)。本工具將原本獨立的「管組組裝規劃 (Tubing Planner)」與「滅菌鍋裝載計算 (Autoclave Calculator)」整合為一體，實現了從物料規劃、BOM 表生成到滅菌排程的無縫自動化流程。

本工具封裝於單一 HTML 檔案中，無需伺服器部署，點擊即可在瀏覽器中運行。

🚀 主要功能 (Key Features)

🏗️ 1. 管組規劃 (Tubing Planner)

基於 SOP-000022 標準，協助使用者規劃各製程階段所需的管組與耗材。

製程階段管理：自定義生產階段 (如 Production Medium, Harvest 等)。

智慧庫存判斷：自動識別所選管組是否為庫存品 (Stock) 或需自行組裝 (Custom Assembly)。

動態 BOM 表：根據選擇的管組 ID (SOP No.)，自動展開物料清單 (Bill of Materials) 與 ASCII 示意圖。

報表生成：

Picking List (總領料單)：自動彙總所有階段所需的總管材長度與接頭數量。

Assembly Guide (裝配工單)：針對非庫存品生成詳細的組裝指引與圖示。

🌡️ 2. 滅菌鍋計算 (Autoclave Calculator)

基於 SOP-000077 標準，使用貪婪演算法 (Iterative Greedy Algorithm) 優化滅菌鍋的空間利用。

自動資料串接：直接從 Planner 匯入需滅菌的「非庫存管組」，無需重複輸入。

混合排程：支援自動匯入的管組 (Group A) 與手動加入的器具配件 (Group B) 混合計算。

智慧排程演算法：根據預設的滅菌模式 (Pattern 1-10) 與區域限制 (Zone Rules)，自動計算最少所需的滅菌循環次數。

複雜規則檢核：支援進階限制邏輯（例如：某區域雖然容量為 6，但剪刀最多只能放 2 把）。

⚙️ 3. 系統與資料庫

設定檔管理：支援 JSON 格式的完整設定匯出與匯入 (Export/Import)，可隨時保存工作進度或備份資料庫。

資料庫編輯器：內建 GUI 介面，可直接修改元件庫 (Components)、目錄 (Catalog)、裝配圖 (Diagrams) 與滅菌模式 (Patterns)。

🛠️ 技術棧 (Tech Stack)

Core: React 18 (via CDN, no build step required)

Styling: Tailwind CSS (via CDN)

Iconography: Lucide-style SVGs

Compiler: Babel Standalone

Architecture: Single File HTML (便於在封閉或管制的內網環境中分發與執行)

📖 使用說明 (Usage)

啟動：直接使用 Chrome 或 Edge 瀏覽器開啟 Integrated_Tubing_Autoclave_Tool.html。

Tab 1: Plan & Config：

建立製程階段。

選擇 SOP 管組編號並輸入數量。

系統會提示該項目是否為庫存品。

Tab 2 & 3: Reports：

查看並下載領料單與組裝工單。

Tab 5: Autoclave Calc：

系統會自動帶入 Tab 1 中需要組裝的管組。

若有額外器具 (如鑷子、濾器)，可在右側手動加入。

系統即時計算並顯示滅菌排程建議。

保存：點擊左側 Sidebar 的 Export Config 下載 JSON 檔以保存當前進度。

📦 版本紀錄 (Changelog)

v29.1 (Latest)

Fix: 修正 React key 重複錯誤。解決了當 Catalog 中存在標準化名稱相同但 ID 不同的項目時，下拉選單渲染報錯的問題。

Optimization: 採用 Set 進行選單與規則的去重複處理，提升穩定性。

v29.0

Feature: 完成 Planner 與 Autoclave 的核心整合。

Refactor: 將 AutoclaveModule 的狀態提升 (State Lifting) 至頂層 App，解決切換分頁導致手動加入物品清單遺失的問題。

Perf: 將滅菌演算法改為 useMemo 觸發，減少不必要的渲染。

Feature: 新增「Include Stock」選項，允許將庫存品強制納入滅菌計算。

📝 注意事項

本工具運行於客戶端瀏覽器，不會上傳任何數據至外部伺服器，確保資料隱私與安全。

若需在無網路環境使用，請確保下載時已將 CDN 腳本快取或下載至本地並修改引用路徑。

Project maintained by [Your Name/Team]
