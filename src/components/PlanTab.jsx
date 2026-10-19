import { Icons } from './Icons.jsx';
import { QtyCell } from './QtyCell.jsx';

/**
 * Plan & Config tab: batch number, stages, and the assignment list.
 * Stateless — App owns the plan state so it survives switching tabs and is
 * autosaved; this component only lays it out.
 */
export const PlanTab = ({
    batchNo, setBatchNo,
    stageList, newStage, setNewStage, onAddStage, delStage, setDelStage, onRemoveStage,
    dbCatalog, targetStage, setTargetStage, selectedTubingId, setSelectedTubingId,
    useStock, setUseStock, stockCodeExists, qty, setQty, qtyIsValid, onAddAssignment,
    assignments, onUpdateQty, onDeleteAssignment
}) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 border p-4 rounded bg-gray-50">
            <div className="mb-4">
                <label htmlFor="batchNo" className="block text-sm font-medium mb-1">批號 / 工單號 (Batch No.)</label>
                <input id="batchNo" className="w-full border p-2 text-sm rounded" value={batchNo} onChange={e => setBatchNo(e.target.value)} placeholder="印在所有報表；未填則留空白供手寫" />
            </div>
            <h3 className="text-xl font-bold mb-4">Stage Manager</h3>
            <div className="mb-4 space-y-2">
                <div className="flex gap-2">
                    <input className="flex-1 border p-2 text-sm rounded" placeholder="New Stage" value={newStage} onChange={e => setNewStage(e.target.value)} />
                    <button className="bg-blue-500 text-white w-10 h-10 rounded flex items-center justify-center" onClick={onAddStage}><Icons.Plus className="w-4 h-4" /></button>
                </div>
                <div className="flex gap-2">
                    <select className="flex-1 border p-2 text-sm rounded h-10" value={delStage} onChange={e => setDelStage(e.target.value)}>
                        <option value="(Select)">(Select)</option>
                        {stageList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="bg-red-500 text-white w-10 h-10 rounded flex items-center justify-center" onClick={onRemoveStage} disabled={delStage === "(Select)"}><Icons.Minus className="w-4 h-4" /></button>
                </div>
            </div>
            <h3 className="text-xl font-bold mb-4">Assignments</h3>
            <div className="flex flex-col gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Stage</label>
                    <select className="w-full border p-2 rounded" value={targetStage} onChange={e => setTargetStage(e.target.value)}>
                        {stageList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Tubing</label>
                    <select className="w-full border p-2 rounded" value={selectedTubingId} onChange={e => setSelectedTubingId(e.target.value)}>
                        {Object.entries(dbCatalog).map(([k, v]) => (<option key={k} value={k}>No. {k} - {v.Name}</option>))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="useStock" checked={useStock} onChange={e => setUseStock(e.target.checked)} />
                    <label htmlFor="useStock" className="text-sm font-medium">Use Stock?</label>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Qty</label>
                    <input type="number" className={`w-full border p-2 rounded ${qtyIsValid ? '' : 'border-red-400 bg-red-50'}`} min="1" value={qty} onChange={e => setQty(e.target.value)} />
                    {!qtyIsValid && <span className="text-xs text-red-600">請輸入大於 0 的整數</span>}
                </div>
                <button className="st-btn w-full disabled:opacity-50" onClick={onAddAssignment} disabled={!qtyIsValid || (useStock && !stockCodeExists)}>Add</button>
            </div>
        </div>
        <div className="md:col-span-2">
            <h3 className="text-xl font-bold mb-4">Current Assignments</h3>
            {assignments.length === 0
                ? <div className="bg-blue-50 p-4 rounded text-blue-700">No assignments yet.</div>
                : (
                    <div>
                        {[...new Set(assignments.map(a => a.Stage))].map(stage => (
                            <div key={stage} className="mb-6">
                                <div className="font-bold text-lg mb-2 text-gray-700">📍 {stage}</div>
                                <table className="w-full border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-gray-100 border-b">
                                            <th className="p-2 text-left">SOP No.</th>
                                            <th className="p-2 text-left">Name</th>
                                            <th className="p-2 text-left">Qty</th>
                                            <th className="p-2 text-left">Is Stock</th>
                                            <th className="p-2 text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignments.filter(a => a.Stage === stage).map((row, idx) => (
                                            <tr key={row.id || idx} className="border-b">
                                                <td className="p-2">{row['SOP No.']}</td>
                                                <td className="p-2">{row.Name}</td>
                                                <td className="p-2"><QtyCell value={row.Qty} onCommit={v => onUpdateQty(row.id, v)} /></td>
                                                <td className="p-2">{row.Is_Stock ? "Yes" : "No"}</td>
                                                <td className="p-2 text-center">
                                                    <button onClick={() => onDeleteAssignment(row.id)} className="text-red-500 hover:text-red-700"><Icons.Trash2 className="w-4 h-4" /></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}
        </div>
    </div>
);

export default PlanTab;
