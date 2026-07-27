import { useState, useMemo } from 'react';
import { Icons } from './Icons.jsx';
import { normalizeName } from '../lib/normalize.js';
import { calculateSchedule, MAX_CYCLES, QUALITY } from '../lib/scheduler.js';

export const AutoclaveModule = ({ plannerAssignments, dbCatalog, patternsList, setPatternsList, inventoryB, setInventoryB, manualCart, setManualCart }) => {
    const [selectedItem, setSelectedItem] = useState("");
    const [quantity, setQuantity] = useState(1);
    const [expandedPatternId, setExpandedPatternId] = useState(null);
    const [includeStock, setIncludeStock] = useState(false);

    const plannerQueue = useMemo(() => {
        const queue = [];
        const aggregation = {};
        plannerAssignments.forEach(assign => {
            if (!assign.Is_Stock || includeStock) {
                const normName = normalizeName(assign.Name);
                aggregation[normName] = (aggregation[normName] || 0) + assign.Qty;
            }
        });
        Object.entries(aggregation).forEach(([name, qty]) => {
            queue.push({ item: name, qty: qty, source: 'planner' });
        });
        return queue;
    }, [plannerAssignments, includeStock]);

    // Merge by item name. The planner queue and the manual queue can name the
    // same thing (Forceps from the plan, Forceps added by hand); leaving them as
    // two rows made the totals and the load plan confusing to read back.
    const combinedCart = useMemo(() => {
        const merged = new Map();
        [...plannerQueue, ...manualCart].forEach(({ item, qty, source }) => {
            const existing = merged.get(item);
            if (existing) {
                existing.qty += qty;
                if (existing.source !== source) existing.source = 'planner+manual';
            } else {
                merged.set(item, { item, qty, source });
            }
        });
        return [...merged.values()];
    }, [plannerQueue, manualCart]);

    const { schedule, unassignable, unscheduled, quality } = useMemo(
        () => calculateSchedule(combinedCart, patternsList),
        [combinedCart, patternsList]
    );

    const qualityBadge = {
        // The search enumerates sequences of patterns; the packing inside each
        // cycle is fixed by simulateLoad. So what is proven is "no shorter
        // sequence of patterns under this packing rule" — not "no shorter
        // schedule exists at all". Say what is actually proven.
        [QUALITY.OPTIMAL]: { label: '最佳解 (Optimal)', title: '已窮舉所有 Pattern 組合：在目前的裝填規則下沒有更短的排程', className: 'bg-green-100 text-green-800 border-green-300' },
        [QUALITY.HEURISTIC]: { label: '近似解 (Heuristic)', title: '品項過多或搜尋預算用盡，僅提供貪婪解；實際可能存在更短的排程', className: 'bg-amber-100 text-amber-800 border-amber-300' },
        [QUALITY.INCOMPLETE]: { label: '不完整 (Incomplete)', title: '有品項未能排入任何批次，請見下方警示', className: 'bg-red-100 text-red-800 border-red-300' }
    }[quality];

    // A2: same guard as the planner — a blank field must not become NaN.
    const qtyValue = parseInt(quantity, 10);
    const qtyIsValid = Number.isFinite(qtyValue) && qtyValue > 0;

    const handleAddManualItem = () => {
        if (!selectedItem || !qtyIsValid) return;
        const existing = manualCart.find(i => i.item === selectedItem);
        if (existing) { setManualCart(manualCart.map(i => i.item === selectedItem ? { ...i, qty: i.qty + qtyValue } : i)); }
        else { setManualCart([...manualCart, { item: selectedItem, qty: qtyValue, source: 'manual' }]); }
        setQuantity(1);
    };
    const handleRemoveManualItem = (item) => { setManualCart(manualCart.filter(i => i.item !== item)); };
    const handleClearManualCart = () => { if (window.confirm("Clear all manual items?")) setManualCart([]); };

    const handleAddPattern = () => {
        const newId = patternsList.length > 0 ? Math.max(...patternsList.map(p => p.id)) + 1 : 1;
        setPatternsList([...patternsList, { id: newId, name: "New Pattern", program: "P01", description: "", zones: [] }]);
        setExpandedPatternId(newId);
    };
    const handleDeletePattern = (id) => setPatternsList(patternsList.filter(p => p.id !== id));
    const handleUpdatePattern = (id, field, value) => setPatternsList(patternsList.map(p => p.id === id ? { ...p, [field]: value } : p));
    const handleAddZone = (pid) => setPatternsList(patternsList.map(p => p.id === pid ? { ...p, zones: [...p.zones, { name: "New Zone", capacity: 1, allowed: [] }] } : p));
    const handleDeleteZone = (pid, zidx) => setPatternsList(patternsList.map(p => { if (p.id !== pid) return p; const nz = [...p.zones]; nz.splice(zidx, 1); return { ...p, zones: nz }; }));
    const handleUpdateZone = (pid, zidx, f, v) => setPatternsList(patternsList.map(p => { if (p.id !== pid) return p; const nz = [...p.zones]; nz[zidx] = { ...nz[zidx], [f]: v }; return { ...p, zones: nz }; }));

    // Same guard as the quantity inputs: clearing a number field yields NaN,
    // and a zone with NaN capacity accepts nothing at all — the items surface
    // as "Not Scheduled" with no hint that an empty capacity box caused it.
    const handleUpdateZoneCapacity = (pid, zidx, raw) => {
        if (raw === "") { handleUpdateZone(pid, zidx, 'capacity', 0); return; }
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && n >= 0) handleUpdateZone(pid, zidx, 'capacity', n);
    };
    const handleAddAllowedItem = (pid, zidx, item) => {
        if (!item) return;
        setPatternsList(patternsList.map(p => {
            if (p.id !== pid) return p;
            const nz = [...p.zones];
            if (!nz[zidx].allowed.includes(item)) nz[zidx] = { ...nz[zidx], allowed: [...nz[zidx].allowed, item] };
            return { ...p, zones: nz };
        }));
    };
    const handleRemoveAllowedItem = (pid, zidx, item) => {
        setPatternsList(patternsList.map(p => {
            if (p.id !== pid) return p;
            const nz = [...p.zones];
            nz[zidx] = { ...nz[zidx], allowed: nz[zidx].allowed.filter(i => i !== item) };
            return { ...p, zones: nz };
        }));
    };

    const groupAItems = useMemo(() => [...new Set(Object.values(dbCatalog).map(c => normalizeName(c.Name)))].sort(), [dbCatalog]);
    const groupBItems = useMemo(() => [...new Set(inventoryB)].sort(), [inventoryB]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-gray-800">
            <div className="lg:col-span-1 space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 shadow-sm">
                    <div className="flex justify-between items-start mb-2"><h3 className="font-bold text-blue-800 flex items-center gap-2"><Icons.RefreshCw className="w-4 h-4" /> Imported from Planner</h3><div className="flex items-center gap-1"><input type="checkbox" id="incStock" checked={includeStock} onChange={e => setIncludeStock(e.target.checked)} className="cursor-pointer" /><label htmlFor="incStock" className="text-xs text-blue-800 cursor-pointer select-none">Include Stock</label></div></div>
                    <ul className="space-y-1 max-h-40 overflow-y-auto custom-scroll pr-2">{plannerQueue.map((item, idx) => (<li key={idx} className="flex justify-between text-sm bg-white p-1 rounded border border-blue-100"><span className="truncate w-48" title={item.item}>{item.item}</span><span className="font-bold text-blue-600">x{item.qty}</span></li>))}</ul>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-sm border">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Icons.Plus className="w-5 h-5 text-green-600" /> Add Extra Items (Group B)</h2>
                    <div className="space-y-4"><div><label className="block text-sm font-medium text-gray-700 mb-1">Select Item</label><select className="w-full border border-gray-300 rounded-md p-2 text-sm outline-none" value={selectedItem} onChange={(e) => setSelectedItem(e.target.value)}><option value="">-- Select Item --</option><optgroup label="Group B: Equipment & Parts">{groupBItems.map(item => <option key={item} value={item}>{item}</option>)}</optgroup><optgroup label="Group A: Tubing Sets (Manual Add)">{groupAItems.map(item => <option key={item} value={item}>{item}</option>)}</optgroup></select></div><div className="flex gap-2"><input type="number" min="1" className={`w-20 border rounded p-2 text-sm ${qtyIsValid ? '' : 'border-red-400 bg-red-50'}`} value={quantity} onChange={(e) => setQuantity(e.target.value)} /><button onClick={handleAddManualItem} disabled={!selectedItem || !qtyIsValid} className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:opacity-50">Add to Queue</button></div></div>
                    <div className="mt-4 border-t pt-4"><div className="flex justify-between items-center mb-2"><h4 className="font-bold text-sm">Manual Queue</h4>{manualCart.length > 0 && <button onClick={handleClearManualCart} className="text-xs text-red-500 hover:text-red-700">Clear All</button>}</div><ul className="space-y-2 max-h-40 overflow-y-auto custom-scroll">{manualCart.map((c, idx) => (<li key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded border"><span className="text-sm truncate w-40" title={c.item}>{c.item}</span><div className="flex items-center gap-2"><span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">x{c.qty}</span><button onClick={() => handleRemoveManualItem(c.item)} className="text-red-400 hover:text-red-600"><Icons.Trash2 className="w-4 h-4" /></button></div></li>))}</ul></div>
                </div>
            </div>
            <div className="lg:col-span-2 space-y-6">
                <div className="bg-white p-6 rounded-lg shadow-sm min-h-[400px] border">
                    <h2 className="text-lg font-semibold mb-6 flex flex-wrap items-center gap-2 border-b pb-2">
                        <Icons.Package className="w-5 h-5 text-blue-600" />
                        <span>Sterilization Schedule (Total: {combinedCart.reduce((a, c) => a + c.qty, 0)})</span>
                        {schedule.length > 0 && (
                            <span className={`text-xs font-normal px-2 py-1 rounded-full border cursor-help ${qualityBadge.className}`} title={qualityBadge.title}>
                                {schedule.length} cycles · {qualityBadge.label}
                            </span>
                        )}
                    </h2>
                    {schedule.length === 0 && unassignable.length === 0 && unscheduled.length === 0 ? (<div className="text-center py-12 text-gray-400"><Icons.Info className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>Add items to generate schedule</p></div>) : (
                        <div className="space-y-6">
                            {unassignable.length > 0 && (<div className="bg-red-50 border border-red-200 rounded-lg p-4"><h3 className="text-red-800 font-bold flex items-center gap-2"><Icons.AlertCircle className="w-4 h-4" /> Unassignable Items <span className="font-normal text-xs">— 沒有任何 Pattern 的 Zone 允許此品項</span></h3><ul className="list-disc list-inside mt-2 text-xs text-red-700">{unassignable.map((u, i) => <li key={i}>{u.item} (x{u.qty})</li>)}</ul></div>)}
                            {unscheduled.length > 0 && (<div className="bg-orange-50 border border-orange-300 rounded-lg p-4"><h3 className="text-orange-800 font-bold flex items-center gap-2"><Icons.ShieldAlert className="w-4 h-4" /> Not Scheduled <span className="font-normal text-xs">— 超出 {MAX_CYCLES} 循環上限，未排入任何批次</span></h3><ul className="list-disc list-inside mt-2 text-xs text-orange-700">{unscheduled.map((u, i) => <li key={i}>{u.item} (x{u.qty})</li>)}</ul><p className="mt-2 text-xs text-orange-800 font-bold">⚠️ 這些品項不在上方排程中，請勿依此排程作業。</p></div>)}
                            {schedule.map(cycle => (
                                <div key={cycle.cycleNumber} className="relative pl-8 border-l-2 border-gray-200 pb-2">
                                    <div className="absolute -left-3 top-0 bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">{cycle.cycleNumber}</div>
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"><div className="bg-gray-50 p-2 border-b flex justify-between items-center"><div><span className="font-bold text-gray-800">{cycle.pattern.name}</span> <span className="text-xs text-gray-500">({cycle.pattern.program})</span></div><span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">{cycle.loadedItems.length} items</span></div><div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">{cycle.loadedItems.map((detail, i) => (<div key={i} className="text-sm text-gray-700 flex items-start gap-2"><Icons.ArrowRight className="w-3 h-3 text-gray-300 mt-1 flex-shrink-0" /><span>{detail}</span></div>))}</div></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className="bg-gray-50 p-4 rounded border">
                    <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Icons.Settings className="w-4 h-4" /> Pattern Configuration</h3>
                    <button onClick={handleAddPattern} className="text-xs bg-white border px-2 py-1 rounded mb-4 hover:bg-gray-100">+ New Pattern</button>
                    <div className="space-y-2 max-h-96 overflow-y-auto custom-scroll pr-2">
                        {patternsList.map(pattern => {
                            const isExpanded = expandedPatternId === pattern.id;
                            return (
                                <div key={pattern.id} className="bg-white border rounded">
                                    <div className="p-3 flex justify-between items-center cursor-pointer hover:bg-gray-50" onClick={() => setExpandedPatternId(isExpanded ? null : pattern.id)}>
                                        <span className="font-bold text-sm">{pattern.name} <span className="font-normal text-xs text-gray-500">({pattern.zones.length} Zones)</span></span>
                                        {isExpanded ? <Icons.ChevronUp className="w-4 h-4" /> : <Icons.ChevronDown className="w-4 h-4" />}
                                    </div>
                                    {isExpanded && (
                                        <div className="p-3 border-t bg-gray-50">
                                            <div className="grid grid-cols-2 gap-2 mb-2"><input className="border p-1 text-xs rounded" value={pattern.name} onChange={e => handleUpdatePattern(pattern.id, 'name', e.target.value)} placeholder="Name" /><input className="border p-1 text-xs rounded" value={pattern.program} onChange={e => handleUpdatePattern(pattern.id, 'program', e.target.value)} placeholder="Program" /></div>
                                            <div className="space-y-2"><div className="flex justify-between items-center"><span className="text-xs font-bold">Zones</span><button onClick={() => handleAddZone(pattern.id)} className="text-xs bg-blue-100 px-2 rounded">+ Zone</button></div>
                                                {pattern.zones.map((zone, zIdx) => (
                                                    <div key={zIdx} className="bg-white border p-2 rounded">
                                                        <div className="flex gap-2 mb-1"><input className="flex-1 border text-xs p-1" value={zone.name} onChange={e => handleUpdateZone(pattern.id, zIdx, 'name', e.target.value)} /><input type="number" min="0" className={`w-12 border text-xs p-1 ${Number.isFinite(zone.capacity) ? '' : 'border-red-400 bg-red-50'}`} value={Number.isFinite(zone.capacity) ? zone.capacity : ''} onChange={e => handleUpdateZoneCapacity(pattern.id, zIdx, e.target.value)} title="Zone capacity" /><button onClick={() => handleDeleteZone(pattern.id, zIdx)} className="text-red-400"><Icons.Trash2 className="w-3 h-3" /></button></div>
                                                        <div className="flex flex-wrap gap-1 mb-1">{zone.allowed.map(item => (<span key={item} className="text-xs bg-blue-50 text-blue-800 px-1 rounded flex items-center gap-1" title={item}>{item.slice(0, 15)}... <button onClick={() => handleRemoveAllowedItem(pattern.id, zIdx, item)}><Icons.X className="w-3 h-3" /></button></span>))}</div>
                                                        {zone.rules && zone.rules.length > 0 && (<div className="mt-2 bg-yellow-50 p-2 rounded border border-yellow-200 text-xs"><span className="font-bold text-yellow-700 block mb-1">Constraints:</span><ul className="list-disc list-inside text-yellow-800">{zone.rules.map((rule, rIdx) => rule.items && rule.max ? (<li key={rIdx}>Max <strong>{rule.max}</strong> for: {rule.items.join(", ")}</li>) : null)}</ul></div>)}
                                                        <select className="w-full text-xs border p-1" onChange={e => handleAddAllowedItem(pattern.id, zIdx, e.target.value)} value=""><option value="">+ Add Item...</option><optgroup label="Tubing">{groupAItems.map(i => <option key={i} value={i} disabled={zone.allowed.includes(i)}>{i}</option>)}</optgroup><optgroup label="Equipment">{groupBItems.map(i => <option key={i} value={i} disabled={zone.allowed.includes(i)}>{i}</option>)}</optgroup></select>
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={() => handleDeletePattern(pattern.id)} className="mt-2 text-xs text-red-500 underline">Delete Pattern</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AutoclaveModule;
