import { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons.jsx';
import { AutoclaveModule } from './AutoclaveModule.jsx';
import { ComponentEditor } from './ComponentEditor.jsx';
import { CatalogEditor } from './CatalogEditor.jsx';
import { LogicEditor } from './LogicEditor.jsx';
import { normalizePatterns, isPlainObject, reindexByNumber } from '../lib/normalize.js';
import { APP_VERSION, AUTOSAVE_KEY, LEGACY_AUTOSAVE_KEYS, validateConfig } from '../lib/config.js';
import { generatePickingListHTML, generateAssemblyGuideHTML } from '../lib/reports.js';
import { downloadHtml, downloadJson } from '../lib/download.js';
import { formatFileStamp } from '../lib/format.js';
import {
    DEFAULT_COMPONENTS, DEFAULT_CATALOG, DEFAULT_DIAGRAMS, DEFAULT_BOM,
    DEFAULT_STAGES, DEFAULT_AUTOCLAVE_GROUP_B, DEFAULT_AUTOCLAVE_PATTERNS_DATA
} from '../data/defaults.js';

export function App() {
    const [dbComponents, setDbComponents] = useState(DEFAULT_COMPONENTS);
    const [dbCatalog, setDbCatalog] = useState(DEFAULT_CATALOG);
    const [dbDiagrams, setDbDiagrams] = useState(DEFAULT_DIAGRAMS);
    const [dbBom, setDbBom] = useState(DEFAULT_BOM);
    const [stageList, setStageList] = useState(DEFAULT_STAGES);
    const [assignments, setAssignments] = useState([]);
    const [activeTab, setActiveTab] = useState("plan");

    // --- SAFE INITIALIZATION ---
    // Start empty, then populate in an effect so a data problem degrades
    // gracefully instead of preventing the App component from mounting.
    const [autoclavePatterns, setAutoclavePatterns] = useState([]);
    const [autoclaveInventoryB, setAutoclaveInventoryB] = useState(DEFAULT_AUTOCLAVE_GROUP_B);
    const [autoclaveManualCart, setAutoclaveManualCart] = useState([]);
    const [configError, setConfigError] = useState(null);
    // Identifies the dataset the reports were produced from — printed in the
    // provenance header so a sheet on the floor can be traced back to its source.
    const [dataSource, setDataSource] = useState(null);

    useEffect(() => {
        try {
            setAutoclavePatterns(normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA));
        } catch (err) {
            console.error("Pattern Initialization Error:", err);
            setConfigError({ title: "預設 Pattern 初始化失敗", details: [String(err)] });
        }
    }, []);

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [newStage, setNewStage] = useState("");
    const [delStage, setDelStage] = useState("(Select)");
    const [targetStage, setTargetStage] = useState("");
    const [selectedTubingId, setSelectedTubingId] = useState("");
    const [useStock, setUseStock] = useState(false);
    const [qty, setQty] = useState(1);

    useEffect(() => { if (stageList.length > 0 && !targetStage) setTargetStage(stageList[0]); }, [stageList, targetStage]);
    useEffect(() => { const keys = Object.keys(dbCatalog); if (keys.length > 0) { if (!selectedTubingId || !dbCatalog[selectedTubingId]) setSelectedTubingId(keys[0]); } }, [dbCatalog, selectedTubingId]);
    const selectedTubingData = dbCatalog[selectedTubingId] || {};
    // Stock_Code comes from an editable field and from imported JSON, so it is
    // not necessarily a string — calling .trim() on a number threw.
    const stockCodeExists = String(selectedTubingData.Stock_Code ?? "").trim() !== "";
    // Fix: ensure useStock updates reliably when tubing changes
    useEffect(() => {
        setUseStock(stockCodeExists);
    }, [selectedTubingId, stockCodeExists]);

    // --- AUTO SAVE ---
    /** How many quarantined copies of an unreadable autosave to keep. */
    const CORRUPT_BACKUP_LIMIT = 3;
    const [autoSaveStatus, setAutoSaveStatus] = useState("");
    // A4: block the debounced writer until the load attempt has resolved, so a
    // failed load can never be overwritten by default state one second later.
    const autoSaveReady = useRef(false);

    const buildConfigPayload = () => ({
        version: APP_VERSION,
        assignments,
        stage_list: stageList,
        database: {
            components: dbComponents,
            catalog: dbCatalog,
            diagrams: dbDiagrams,
            bom: dbBom,
            autoclave: {
                patterns: autoclavePatterns,
                inventory_group_b: autoclaveInventoryB,
                manual_cart: autoclaveManualCart
            }
        }
    });

    // A5: one place where a validated config becomes application state.
    const applyConfig = (data, sourceLabel) => {
        setDataSource(sourceLabel || null);
        if (Array.isArray(data.assignments)) setAssignments(data.assignments);
        if (Array.isArray(data.stage_list)) setStageList(data.stage_list);
        const db = data.database;
        if (isPlainObject(db)) {
            if (isPlainObject(db.components)) setDbComponents(db.components);
            if (isPlainObject(db.catalog)) setDbCatalog(reindexByNumber(db.catalog));
            if (isPlainObject(db.diagrams)) setDbDiagrams(reindexByNumber(db.diagrams));
            if (isPlainObject(db.bom)) setDbBom(reindexByNumber(db.bom));
            if (isPlainObject(db.autoclave)) {
                // A5: imported patterns were previously applied raw; without
                // normalization their zone names stop matching item names and
                // every item is reported as unassignable.
                if (Array.isArray(db.autoclave.patterns)) setAutoclavePatterns(normalizePatterns(db.autoclave.patterns));
                if (Array.isArray(db.autoclave.inventory_group_b)) setAutoclaveInventoryB(db.autoclave.inventory_group_b);
                if (Array.isArray(db.autoclave.manual_cart)) setAutoclaveManualCart(db.autoclave.manual_cart);
            }
        }
    };

    // Load from AutoSave on Mount
    useEffect(() => {
        let saved = localStorage.getItem(AUTOSAVE_KEY);
        let sourceKey = AUTOSAVE_KEY;
        if (!saved) {
            for (const legacy of LEGACY_AUTOSAVE_KEYS) {
                const v = localStorage.getItem(legacy);
                if (v) { saved = v; sourceKey = legacy; break; }
            }
        }

        if (!saved) { autoSaveReady.current = true; return; }

        const quarantine = (reason, details) => {
            // A4: never discard data we could not read — park it under a
            // timestamped key so it stays recoverable, and tell the user.
            const backupKey = `${AUTOSAVE_KEY}_CORRUPT_${Date.now()}`;
            try {
                // Backups accumulated without bound. localStorage has a quota,
                // and filling it would make the ordinary autosave fail — losing
                // live work to protect stale copies. Keep the newest few.
                const prefix = `${AUTOSAVE_KEY}_CORRUPT_`;
                const older = Object.keys(localStorage).filter(k => k.startsWith(prefix)).sort();
                older.slice(0, Math.max(0, older.length - (CORRUPT_BACKUP_LIMIT - 1)))
                    .forEach(k => localStorage.removeItem(k));
                localStorage.setItem(backupKey, saved);
            } catch (e) { console.error("Backup failed", e); }
            console.error(reason, details);
            setConfigError({
                title: "自動存檔讀取失敗，已改用預設資料",
                details: [...details, `原始資料已備份於 localStorage 的 "${backupKey}"`]
            });
        };

        try {
            const parsed = JSON.parse(saved);
            const result = validateConfig(parsed);
            if (!result.ok) {
                quarantine("Autosave validation failed", result.errors);
            } else {
                const version = result.value.version ? ` v${result.value.version}` : '';
                applyConfig(result.value, `auto-save${version} (browser localStorage)`);
                if (sourceKey !== AUTOSAVE_KEY) console.log(`Migrated autosave from ${sourceKey}`);
                console.log("Loaded from Autosave");
            }
        } catch (e) {
            quarantine("Autosave parse error", [String(e)]);
        }
        autoSaveReady.current = true;
    }, []);

    // Save to AutoSave on Change
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!autoSaveReady.current) return;
            try {
                localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildConfigPayload()));
                setAutoSaveStatus("Auto-saved");
                setTimeout(() => setAutoSaveStatus(""), 3000);
            } catch (e) {
                console.error("Autosave write error", e);
                setAutoSaveStatus("Auto-save failed");
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [assignments, stageList, dbComponents, dbCatalog, dbDiagrams, dbBom, autoclavePatterns, autoclaveInventoryB, autoclaveManualCart]);

    const handleImport = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const inputEl = e.target;
        const reader = new FileReader();
        reader.onload = (event) => {
            let parsed;
            try {
                parsed = JSON.parse(event.target.result);
            } catch (err) {
                setConfigError({ title: `無法解析 ${file.name}`, details: [String(err)] });
                inputEl.value = "";
                return;
            }
            // A5: validate the whole file before touching any state, so a bad
            // import cannot leave the app half-populated (and autosaved).
            const result = validateConfig(parsed);
            if (!result.ok) {
                setConfigError({ title: `${file.name} 格式不符，未套用任何資料`, details: result.errors });
                inputEl.value = "";
                return;
            }
            const version = result.value.version ? ` v${result.value.version}` : '';
            applyConfig(result.value, `${file.name}${version}`);
            setConfigError(null);
            setAutoSaveStatus(`已匯入 ${file.name}`);
            setTimeout(() => setAutoSaveStatus(""), 3000);
            inputEl.value = "";
        };
        reader.onerror = () => {
            setConfigError({ title: `讀取 ${file.name} 失敗`, details: [String(reader.error)] });
            inputEl.value = "";
        };
        reader.readAsText(file);
    };

    const handleExport = () => {
        // Timestamped so successive exports do not overwrite each other in the
        // downloads folder, and so the filename itself identifies which save it
        // is when it later shows up as a report's Data source.
        downloadJson(buildConfigPayload(), `biopharma_prod_config_${formatFileStamp(new Date())}.json`);
    };

    const handleResetDefaults = () => {
        if (window.confirm("⚠️ Reset ALL data? This will also clear your Auto-Save.")) {
            localStorage.removeItem(AUTOSAVE_KEY);
            LEGACY_AUTOSAVE_KEYS.forEach(k => localStorage.removeItem(k));
            setDbComponents(DEFAULT_COMPONENTS); setDbCatalog(DEFAULT_CATALOG); setDbDiagrams(DEFAULT_DIAGRAMS); setDbBom(DEFAULT_BOM); setStageList(DEFAULT_STAGES); setAssignments([]);
            setAutoclavePatterns(normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA));
            setAutoclaveInventoryB(DEFAULT_AUTOCLAVE_GROUP_B); setAutoclaveManualCart([]); setNewStage(""); setQty(1);
            setDataSource(null);
            setConfigError(null);
            setAutoSaveStatus("已重設為預設值");
            setTimeout(() => setAutoSaveStatus(""), 3000);
        }
    };

    const handleAddStage = () => {
        // Trim so " Harvest" and "Harvest" cannot become two separate stages.
        const name = newStage.trim();
        if (!name || stageList.includes(name)) return;
        setStageList([...stageList, name]);
        setNewStage("");
    };

    const handleRemoveStage = () => {
        if (!delStage || delStage === "(Select)") return;
        // Removing a stage also removes everything planned under it, and there
        // is no undo. Say how much is about to be lost before doing it.
        const affected = assignments.filter(a => a.Stage === delStage);
        if (affected.length > 0 && !window.confirm(
            `刪除階段「${delStage}」將一併刪除其下 ${affected.length} 筆 Assignment，且無法復原。確定要刪除嗎？`
        )) return;
        setStageList(stageList.filter(s => s !== delStage));
        setAssignments(assignments.filter(a => a.Stage !== delStage));
        setDelStage("(Select)");
    };
    // Date.now() collides when two rows are added within the same millisecond:
    // React sees duplicate keys, and deleting one row deletes both.
    const newAssignmentId = () =>
        (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);

    // A2: reject blank / non-numeric / non-positive quantities instead of writing NaN into the plan.
    const qtyValue = parseInt(qty, 10);
    const qtyIsValid = Number.isFinite(qtyValue) && qtyValue > 0;
    const handleAddAssignment = () => {
        if (!qtyIsValid || !targetStage || !selectedTubingId) return;
        setAssignments([...assignments, { id: newAssignmentId(), "Stage": targetStage, "SOP No.": parseInt(selectedTubingId, 10), "Name": selectedTubingData.Name, "Qty": qtyValue, "Is_Stock": useStock, "Material_Code": useStock ? selectedTubingData.Stock_Code : null }]);
    };
    const handleDeleteAssignment = (id) => { setAssignments(assignments.filter(a => a.id !== id)); };

    return (
        <div className="flex min-h-screen bg-white">
            <div className={`flex-shrink-0 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0 p-0 overflow-hidden'}`}>
                <div className="bg-gray-100 h-full p-4 border-r relative">
                    {isSidebarOpen && (<>
                        <h2 className="font-bold text-lg mb-4">📂 File System</h2>
                        <button className="w-full bg-white border border-gray-300 rounded py-1 px-3 mb-2 text-sm hover:bg-gray-50" onClick={handleExport}>📥 Export</button>
                        <div className="mb-4"><label className="block text-sm font-medium mb-1">📤 Import</label><input type="file" accept=".json" onChange={handleImport} className="text-xs w-full" /></div>
                        <div className="my-4 border-t border-gray-300 pt-4"><button className="w-full bg-red-50 border border-red-300 text-red-600 rounded py-2 px-3 text-sm hover:bg-red-100 font-bold flex items-center justify-center gap-2" onClick={handleResetDefaults}><Icons.RotateCcw className="w-4 h-4" /> Reset Defaults</button></div>
                    </>)}
                </div>
            </div>
            <div className={`fixed top-0 z-20 transition-all duration-300 h-full flex items-start ${isSidebarOpen ? 'left-64' : 'left-0'}`}>
                <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="mt-6 p-2 bg-red-500 text-white rounded-r-lg shadow-lg hover:bg-red-600 transition-colors">{isSidebarOpen ? <Icons.ChevronLeft className="w-4 h-4" /> : <Icons.ChevronRight className="w-4 h-4" />}</button>
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-4">
                    <span>🧬 Biopharma Production Tool v{APP_VERSION}</span>
                    {autoSaveStatus && <span className="text-sm font-normal text-green-700 bg-green-100 px-3 py-1 rounded-full shadow-sm border border-green-300 animate-pulse"><Icons.Save className="w-3 h-3 inline" /> {autoSaveStatus}</span>}
                </h1>
                {configError && (
                    <div className="mb-4 bg-red-50 border border-red-300 rounded-lg p-4 flex justify-between items-start gap-4">
                        <div>
                            <h3 className="font-bold text-red-800 flex items-center gap-2"><Icons.AlertCircle className="w-4 h-4" /> {configError.title}</h3>
                            <ul className="list-disc list-inside mt-2 text-xs text-red-700 space-y-1">{configError.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
                        </div>
                        <button onClick={() => setConfigError(null)} className="text-red-500 hover:text-red-700 flex-shrink-0"><Icons.X className="w-4 h-4" /></button>
                    </div>
                )}
                <div className="flex border-b mb-6 overflow-x-auto">
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'plan' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('plan')}>🏗️ Plan & Config</button>
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'picking' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('picking')}>📋 Picking List</button>
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'assembly' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('assembly')}>📦 Assembly Guide</button>
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'autoclave' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('autoclave')}>🌡️ Autoclave Calc</button>
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'database' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('database')}>⚙️ Database</button>
                </div>
                <div className="min-h-[500px]">
                    {activeTab === 'plan' && (<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-1 border p-4 rounded bg-gray-50">
                            <h3 className="text-xl font-bold mb-4">Stage Manager</h3>
                            <div className="mb-4 space-y-2">
                                <div className="flex gap-2"><input className="flex-1 border p-2 text-sm rounded" placeholder="New Stage" value={newStage} onChange={e => setNewStage(e.target.value)} /><button className="bg-blue-500 text-white w-10 h-10 rounded flex items-center justify-center" onClick={handleAddStage}><Icons.Plus className="w-4 h-4" /></button></div>
                                <div className="flex gap-2"><select className="flex-1 border p-2 text-sm rounded h-10" value={delStage} onChange={e => setDelStage(e.target.value)}><option value="(Select)">(Select)</option>{stageList.map(s => <option key={s} value={s}>{s}</option>)}</select><button className="bg-red-500 text-white w-10 h-10 rounded flex items-center justify-center" onClick={handleRemoveStage} disabled={delStage === "(Select)"}><Icons.Minus className="w-4 h-4" /></button></div>
                            </div>
                            <h3 className="text-xl font-bold mb-4">Assignments</h3>
                            <div className="flex flex-col gap-4">
                                <div><label className="block text-sm font-medium mb-1">Stage</label><select className="w-full border p-2 rounded" value={targetStage} onChange={e => setTargetStage(e.target.value)}>{stageList.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
                                <div><label className="block text-sm font-medium mb-1">Tubing</label><select className="w-full border p-2 rounded" value={selectedTubingId} onChange={e => setSelectedTubingId(e.target.value)}>{Object.entries(dbCatalog).map(([k, v]) => (<option key={k} value={k}>No. {k} - {v.Name}</option>))}</select></div>
                                <div className="flex items-center gap-2"><input type="checkbox" id="useStock" checked={useStock} onChange={e => setUseStock(e.target.checked)} /><label htmlFor="useStock" className="text-sm font-medium">Use Stock?</label></div>
                                <div><label className="block text-sm font-medium mb-1">Qty</label><input type="number" className={`w-full border p-2 rounded ${qtyIsValid ? '' : 'border-red-400 bg-red-50'}`} min="1" value={qty} onChange={e => setQty(e.target.value)} />{!qtyIsValid && <span className="text-xs text-red-600">請輸入大於 0 的整數</span>}</div>
                                <button className="st-btn w-full disabled:opacity-50" onClick={handleAddAssignment} disabled={!qtyIsValid || (useStock && !stockCodeExists)}>Add</button>
                            </div>
                        </div>
                        <div className="md:col-span-2">
                            <h3 className="text-xl font-bold mb-4">Current Assignments</h3>
                            {assignments.length === 0 ? <div className="bg-blue-50 p-4 rounded text-blue-700">No assignments yet.</div> : (<div>{[...new Set(assignments.map(a => a.Stage))].map(stage => (<div key={stage} className="mb-6"><div className="font-bold text-lg mb-2 text-gray-700">📍 {stage}</div><table className="w-full border-collapse text-sm"><thead><tr className="bg-gray-100 border-b"><th className="p-2 text-left">SOP No.</th><th className="p-2 text-left">Name</th><th className="p-2 text-left">Qty</th><th className="p-2 text-left">Is Stock</th><th className="p-2 text-center">Action</th></tr></thead><tbody>{assignments.filter(a => a.Stage === stage).map((row, idx) => (<tr key={row.id || idx} className="border-b"><td className="p-2">{row['SOP No.']}</td><td className="p-2">{row.Name}</td><td className="p-2">{row.Qty}</td><td className="p-2">{row.Is_Stock ? "Yes" : "No"}</td><td className="p-2 text-center"><button onClick={() => handleDeleteAssignment(row.id)} className="text-red-500 hover:text-red-700"><Icons.Trash2 className="w-4 h-4" /></button></td></tr>))}</tbody></table></div>))}</div>)}
                        </div>
                    </div>)}
                    {activeTab === 'picking' && (
                        <div>
                            <div dangerouslySetInnerHTML={{ __html: generatePickingListHTML(assignments, dbBom, dbComponents, dbCatalog, { sourceLabel: dataSource }) }} />
                            <div className="mt-4 text-right">
                                {/* Regenerated on click so the download carries its own generation time. */}
                                <button className="st-btn" onClick={() => downloadHtml(generatePickingListHTML(assignments, dbBom, dbComponents, dbCatalog, { sourceLabel: dataSource }), "Picking_List.html")}>📥 Download</button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'assembly' && (
                        <div>
                            <div dangerouslySetInnerHTML={{ __html: generateAssemblyGuideHTML(stageList, assignments, dbBom, dbComponents, dbDiagrams, { sourceLabel: dataSource }) }} />
                            <div className="mt-4 text-right">
                                <button className="st-btn" onClick={() => downloadHtml(generateAssemblyGuideHTML(stageList, assignments, dbBom, dbComponents, dbDiagrams, { sourceLabel: dataSource }), "Assembly_Guide.html")}>📥 Download</button>
                            </div>
                        </div>
                    )}
                    {activeTab === 'autoclave' && <AutoclaveModule plannerAssignments={assignments} dbCatalog={dbCatalog} patternsList={autoclavePatterns} setPatternsList={setAutoclavePatterns} inventoryB={autoclaveInventoryB} setInventoryB={setAutoclaveInventoryB} manualCart={autoclaveManualCart} setManualCart={setAutoclaveManualCart} dataSource={dataSource} />}
                    {activeTab === 'database' && (<div><h2 className="text-xl font-bold mb-4">⚙️ Database</h2><ComponentEditor dbComponents={dbComponents} setDbComponents={setDbComponents} dbBom={dbBom} /><CatalogEditor dbCatalog={dbCatalog} setDbCatalog={setDbCatalog} dbBom={dbBom} setDbBom={setDbBom} dbDiagrams={dbDiagrams} setDbDiagrams={setDbDiagrams} assignments={assignments} /><LogicEditor dbCatalog={dbCatalog} dbDiagrams={dbDiagrams} setDbDiagrams={setDbDiagrams} dbBom={dbBom} setDbBom={setDbBom} dbComponents={dbComponents} /></div>)}
                </div>
            </div>
        </div>
    );
}

export default App;
