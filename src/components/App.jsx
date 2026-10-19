import { useState, useEffect, useRef, useMemo } from 'react';
import { Icons } from './Icons.jsx';
import { AutoclaveModule } from './AutoclaveModule.jsx';
import { PlanTab } from './PlanTab.jsx';
import { DatabaseTab } from './DatabaseTab.jsx';
import { ReportPanel } from './ReportPanel.jsx';
import { normalizePatterns, isPlainObject, reindexByNumber } from '../lib/normalize.js';
import { APP_VERSION, AUTOSAVE_KEY, LEGACY_AUTOSAVE_KEYS, validateConfig } from '../lib/config.js';
import { generatePickingListHTML, generateAssemblyGuideHTML, generateAttachment2PartAHTML } from '../lib/reports.js';
import { assembledAmounts } from '../lib/forms.js';
import { withCatalogNames, addAssignment } from '../lib/plan.js';
import { downloadJson } from '../lib/download.js';
import {
    sopDataFingerprint, makeDataBasis, defaultDataBasis, describeDataBasis,
    patternsFingerprint, makePatternBasis, defaultPatternBasis
} from '../lib/dataBasis.js';
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
    // What every view of the plan reads: the stored assignments under the
    // catalog's current names (see lib/plan.js). Saves keep the raw rows.
    const plan = useMemo(() => withCatalogNames(assignments, dbCatalog), [assignments, dbCatalog]);
    const [activeTab, setActiveTab] = useState("plan");

    // --- SAFE INITIALIZATION ---
    // Start empty, then populate in an effect so a data problem degrades
    // gracefully instead of preventing the App component from mounting.
    const [autoclavePatterns, setAutoclavePatterns] = useState([]);
    const [autoclaveInventoryB, setAutoclaveInventoryB] = useState(DEFAULT_AUTOCLAVE_GROUP_B);
    const [autoclaveManualCart, setAutoclaveManualCart] = useState([]);
    // Lives here rather than in AutoclaveModule: that component unmounts when
    // another tab is opened, and the box used to come back unticked — silently
    // dropping stock sets from the schedule and the Part B form.
    const [autoclaveIncludeStock, setAutoclaveIncludeStock] = useState(false);
    // Batch / work-order number printed on every report, so a printed sheet
    // can be filed with its batch record (SOP-000022 3.2.9, SOP-000077 4.9).
    const [batchNo, setBatchNo] = useState("");
    const [configError, setConfigError] = useState(null);
    // Identifies the dataset the reports were produced from — printed in the
    // provenance header so a sheet on the floor can be traced back to its source.
    const [dataSource, setDataSource] = useState(null);
    // Which SOP revision the SOP data was checked against, plus the fingerprint
    // of the data at that moment (see lib/dataBasis.js).
    const [dataBasis, setDataBasis] = useState(() => defaultDataBasis({
        components: DEFAULT_COMPONENTS, catalog: DEFAULT_CATALOG, diagrams: DEFAULT_DIAGRAMS, bom: DEFAULT_BOM
    }));
    const sopFingerprint = useMemo(
        () => sopDataFingerprint({ components: dbComponents, catalog: dbCatalog, diagrams: dbDiagrams, bom: dbBom }),
        [dbComponents, dbCatalog, dbDiagrams, dbBom]
    );
    const dataBasisLabel = describeDataBasis(dataBasis, sopFingerprint);
    const handleRecordDataBasis = (reference) => setDataBasis(makeDataBasis(reference, {
        components: dbComponents, catalog: dbCatalog, diagrams: dbDiagrams, bom: dbBom
    }));
    // The loading patterns come from SOP-000077 and carry their own basis.
    const [patternBasis, setPatternBasis] = useState(() => defaultPatternBasis());
    const patternFingerprint = useMemo(() => patternsFingerprint(autoclavePatterns), [autoclavePatterns]);
    const patternBasisLabel = describeDataBasis(patternBasis, patternFingerprint);
    const handleRecordPatternBasis = (reference) => setPatternBasis(makePatternBasis(reference, autoclavePatterns));
    // Autosaves carry their own patterns, so a correction to the shipped
    // patterns only reached a user through Reset Defaults — which also wipes
    // the plan. This restores the patterns (and the Group B list they refer
    // to) and nothing else.
    const handleRestoreDefaultPatterns = () => {
        setAutoclavePatterns(normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA));
        setAutoclaveInventoryB(DEFAULT_AUTOCLAVE_GROUP_B);
        setPatternBasis(defaultPatternBasis());
    };
    const provenance = { sourceLabel: dataSource, dataBasisLabel, batchNo };

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
    // Stages left out of the Attachment 2 Part A form. Tracked as exclusions so
    // a newly added stage is included by default. UI state only — not saved.
    const [partAExcluded, setPartAExcluded] = useState([]);
    const partAStages = stageList.filter(s => !partAExcluded.includes(s));
    const togglePartAStage = (stage) => setPartAExcluded(prev =>
        prev.includes(stage) ? prev.filter(s => s !== stage) : [...prev, stage]);
    const partAHTML = () => generateAttachment2PartAHTML(
        assembledAmounts(plan, dbCatalog, partAStages),
        { stages: partAStages, provenance }
    );

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
        data_basis: dataBasis,
        pattern_basis: patternBasis,
        batch_no: batchNo,
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
                manual_cart: autoclaveManualCart,
                include_stock: autoclaveIncludeStock
            }
        }
    });

    // A5: one place where a validated config becomes application state.
    const applyConfig = (data, sourceLabel) => {
        setDataSource(sourceLabel || null);
        // A config that replaces SOP data without saying what it was checked
        // against (e.g. one written before v30.14) is reported as not recorded,
        // rather than inheriting a basis that describes different data.
        const db = data.database;
        const replacesSopData = isPlainObject(db) && ['components', 'catalog', 'diagrams', 'bom'].some(k => db[k] !== undefined);
        if (data.data_basis !== undefined) setDataBasis(data.data_basis);
        else if (replacesSopData) setDataBasis(null);
        // Same rule for the patterns' basis (SOP-000077).
        if (data.pattern_basis !== undefined) setPatternBasis(data.pattern_basis);
        else if (isPlainObject(db) && isPlainObject(db.autoclave) && Array.isArray(db.autoclave.patterns)) setPatternBasis(null);
        // A batch number belongs to the plan it came with: a config that brings
        // a new plan without one must not inherit the previous plan's number.
        if (typeof data.batch_no === 'string') setBatchNo(data.batch_no);
        else if (Array.isArray(data.assignments)) setBatchNo("");
        if (Array.isArray(data.assignments)) setAssignments(data.assignments);
        if (Array.isArray(data.stage_list)) setStageList(data.stage_list);
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
                if (typeof db.autoclave.include_stock === 'boolean') setAutoclaveIncludeStock(db.autoclave.include_stock);
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
    }, [assignments, stageList, dbComponents, dbCatalog, dbDiagrams, dbBom, autoclavePatterns, autoclaveInventoryB, autoclaveManualCart, dataBasis, patternBasis, batchNo, autoclaveIncludeStock]);

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
            setDataBasis(defaultDataBasis({ components: DEFAULT_COMPONENTS, catalog: DEFAULT_CATALOG, diagrams: DEFAULT_DIAGRAMS, bom: DEFAULT_BOM }));
            setPatternBasis(defaultPatternBasis());
            setBatchNo(""); setAutoclaveIncludeStock(false);
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
        setAssignments(addAssignment(assignments, { id: newAssignmentId(), "Stage": targetStage, "SOP No.": parseInt(selectedTubingId, 10), "Name": selectedTubingData.Name, "Qty": qtyValue, "Is_Stock": useStock, "Material_Code": useStock ? selectedTubingData.Stock_Code : null }));
    };
    const handleDeleteAssignment = (id) => { setAssignments(assignments.filter(a => a.id !== id)); };
    // QtyCell only commits positive integers, so this never writes NaN or 0.
    const handleUpdateAssignmentQty = (id, value) => {
        setAssignments(assignments.map(a => a.id === id ? { ...a, Qty: value } : a));
    };

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
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'partA' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('partA')}>📝 附件 2 Part A</button>
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'autoclave' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('autoclave')}>🌡️ Autoclave Calc</button>
                    <button className={`px-4 py-2 mr-2 whitespace-nowrap ${activeTab === 'database' ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab('database')}>⚙️ Database</button>
                </div>
                <div className="min-h-[500px]">
                    {activeTab === 'plan' && (
                        <PlanTab
                            batchNo={batchNo} setBatchNo={setBatchNo}
                            stageList={stageList} newStage={newStage} setNewStage={setNewStage} onAddStage={handleAddStage}
                            delStage={delStage} setDelStage={setDelStage} onRemoveStage={handleRemoveStage}
                            dbCatalog={dbCatalog} targetStage={targetStage} setTargetStage={setTargetStage}
                            selectedTubingId={selectedTubingId} setSelectedTubingId={setSelectedTubingId}
                            useStock={useStock} setUseStock={setUseStock} stockCodeExists={stockCodeExists}
                            qty={qty} setQty={setQty} qtyIsValid={qtyIsValid} onAddAssignment={handleAddAssignment}
                            assignments={plan} onUpdateQty={handleUpdateAssignmentQty} onDeleteAssignment={handleDeleteAssignment}
                        />
                    )}
                    {activeTab === 'picking' && (
                        <ReportPanel render={() => generatePickingListHTML(plan, dbBom, dbComponents, dbCatalog, provenance)} filename="Picking_List.html" />
                    )}
                    {activeTab === 'assembly' && (
                        <ReportPanel render={() => generateAssemblyGuideHTML(stageList, plan, dbBom, dbComponents, dbDiagrams, provenance)} filename="Assembly_Guide.html" />
                    )}
                    {activeTab === 'partA' && (
                        <div>
                            <div className="mb-4 bg-gray-50 border rounded p-3 text-sm flex flex-wrap items-center gap-3">
                                <span className="font-bold">製程階段 (Stages):</span>
                                {stageList.map(s => (
                                    <label key={s} className="flex items-center gap-1 cursor-pointer select-none">
                                        <input type="checkbox" checked={partAStages.includes(s)} onChange={() => togglePartAStage(s)} /> {s}
                                    </label>
                                ))}
                            </div>
                            <ReportPanel render={partAHTML} filename="SOP-000022_Attachment2_PartA.html" />
                        </div>
                    )}
                    {activeTab === 'autoclave' && (
                        <AutoclaveModule
                            provenance={{ ...provenance, patternBasisLabel }}
                            includeStock={autoclaveIncludeStock} setIncludeStock={setAutoclaveIncludeStock}
                            onRestoreDefaultPatterns={handleRestoreDefaultPatterns}
                            plannerAssignments={plan} dbCatalog={dbCatalog}
                            patternsList={autoclavePatterns} setPatternsList={setAutoclavePatterns}
                            inventoryB={autoclaveInventoryB} setInventoryB={setAutoclaveInventoryB}
                            manualCart={autoclaveManualCart} setManualCart={setAutoclaveManualCart}
                        />
                    )}
                    {activeTab === 'database' && (
                        <DatabaseTab
                            dataBasis={dataBasis} dataBasisLabel={dataBasisLabel} onRecordDataBasis={handleRecordDataBasis}
                            dataBasisCurrent={!!dataBasis && dataBasis.fingerprint === sopFingerprint}
                            patternBasis={patternBasis} patternBasisLabel={patternBasisLabel} onRecordPatternBasis={handleRecordPatternBasis}
                            patternBasisCurrent={!!patternBasis && patternBasis.fingerprint === patternFingerprint}
                            dbComponents={dbComponents} setDbComponents={setDbComponents} dbCatalog={dbCatalog} setDbCatalog={setDbCatalog}
                            dbDiagrams={dbDiagrams} setDbDiagrams={setDbDiagrams} dbBom={dbBom} setDbBom={setDbBom} assignments={assignments}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default App;
