Biopharma Planner Mobile (v29.1) 🧬

生技製藥管組規劃與滅菌排程整合工具 - 行動版

一個基於 React 與 Tailwind CSS 建構的單頁應用程式 (SPA)，專為生技製藥產線設計。協助使用者進行管組規劃 (Tubing Planning)、物料領取 (Picking)、組裝指導 (Assembly Guide) 以及滅菌釜排程計算 (Autoclave Calculation)。

📖 專案簡介 (Introduction)

本工具原本為桌面版應用，現已重構為 Mobile-First (行動優先) 版本。旨在解決現場人員使用電腦不便的問題，透過手機或平板即可快速進行製程物料規劃與查閱。

系統採用 "Zero-Build" 架構，所有邏輯包含 React、Babel、Tailwind CSS 皆整合於單一 HTML 檔案中，無需繁雜的編譯過程，下載即用。

✨ 主要功能 (Key Features)

📱 行動優化介面 (Mobile-First UI)

隱藏式側邊選單 (Hamburger Menu)。

頂部黏性導航列 (Sticky Tabs)，滑動切換功能。

響應式表格設計，支援觸控滑動查看詳細資訊。

加大的觸控目標區域，優化手機操作體驗。

🏗️ 管組規劃 (Tubing Planner)

自定義製程階段 (Stage Manager)。

快速指派 SOP 管組與數量。

自動偵測庫存代碼 (Stock Code) 與客製化組裝需求。

📊 自動化報表 (Auto-Generated Reports)

領料單 (Picking List)：自動彙整所需原物料與庫存套件總量。

組裝工單 (Assembly Guide)：針對客製化管組生成詳細的圖示 (ASCII Diagram) 與 BOM 表。

支援 HTML 報表下載。

🌡️ 滅菌釜計算機 (Autoclave Calculator)

貪婪演算法 (Greedy Algorithm)：自動優化滅菌釜空間利用率。

排程模擬：根據預設 Pattern 自動分配物品到不同車次 (Cycle)。

支援手動加入額外物品 (Manual Cart) 與庫存物品混搭計算。

💾 資料持久化

支援 JSON 設定檔匯入/匯出 (Import/Export)。

完全前端執行，無後端伺服器依賴，資料安全存於本地。

🛠️ 使用技術 (Tech Stack)

Core: HTML5, JavaScript (ES6+)

Framework: React 18 (via CDN)

Styling: Tailwind CSS (via CDN)

Compiler: Babel Standalone

Icons: FontAwesome

🚀 快速開始 (Getting Started)

本地執行 (Local Usage)

由於本專案是單一 HTML 檔案，您不需要安裝 Node.js 或 npm。

下載本儲存庫中的 index.html。

直接使用瀏覽器 (Chrome, Safari, Edge) 開啟檔案即可使用。

部署到網路 (Deployment)

推薦使用 GitHub Pages 進行免費託管：

將專案 Fork 或 Push 到您的 GitHub 帳號。

進入 Repository 的 Settings > Pages。

在 Source 選擇 main branch 並儲存。

等待約 1 分鐘，即可獲得專屬網址。

📱 手機 App 化技巧 (PWA-like Experience)

為了獲得最佳的手機操作體驗，建議將網頁加入主畫面：

iOS (Safari): 點擊分享按鈕 (Share) -> 「加入主畫面 (Add to Home Screen)」。

Android (Chrome): 點擊選單 (Menu) -> 「加到主畫面 (Add to Home Screen)」。

📂 檔案結構 (File Structure)

biopharma-mobile-tool/
├── index.html          # 主程式 (包含所有 CSS, JS 邏輯)
├── README.md           # 說明文件
└── sample_config.json  # (可選) 範例設定檔


🤝 貢獻 (Contributing)

歡迎提交 Pull Request 或 Issue 來改善這個工具！
由於是單檔架構，修改時請直接編輯 index.html 中的 <script type="text/babel"> 區塊。

📝 版本紀錄 (Changelog)

v29.1 (Mobile):

重構 UI 為行動版佈局。

優化 Autoclave 計算機的狀態管理 (State Lifting)，解決切換分頁資料遺失問題。

加入響應式導航與側邊選單。

Developed for Biopharma Production Efficiency.# biopharma-tool
