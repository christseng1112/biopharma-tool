import { useState, useEffect } from 'react';
import { Icons } from './Icons.jsx';
import { Notice, useNotice } from './Notice.jsx';

/**
 * The catalog previously had no way to add or remove an entry — a new tubing set
 * could only be introduced by hand-editing a config JSON and importing it, and
 * a retired one could never be taken out. Both are now possible here.
 */
export const CatalogEditor = ({ dbCatalog, setDbCatalog, dbBom, dbDiagrams, setDbBom, setDbDiagrams, assignments }) => {
    const [localCat, setLocalCat] = useState(dbCatalog);
    const [newName, setNewName] = useState("");
    const [newStockCode, setNewStockCode] = useState("");
    const [notice, showNotice] = useNotice();

    useEffect(() => { setLocalCat(dbCatalog); }, [dbCatalog]);

    const nextSopNo = () => {
        const ids = Object.keys(localCat).map(k => parseInt(k, 10)).filter(Number.isFinite);
        return ids.length > 0 ? Math.max(...ids) + 1 : 1;
    };

    const handleAdd = () => {
        const name = newName.trim();
        if (!name) { showNotice('請先輸入名稱。', 'error'); return; }
        const id = nextSopNo();
        setLocalCat({ ...localCat, [id]: { Name: name, Stock_Code: newStockCode.trim() || null } });
        setNewName(""); setNewStockCode("");
        showNotice(`已新增 No. ${id}「${name}」，請按 Save Changes 套用。`, 'info');
    };

    const handleDelete = (key) => {
        // An entry referenced by a plan must not vanish underneath it — the
        // assignment would keep a SOP No. that no longer resolves to anything.
        const used = assignments.filter(a => String(a['SOP No.']) === String(key));
        if (used.length > 0) {
            showNotice(`⛔ 無法刪除 No. ${key}：目前有 ${used.length} 筆 Assignment 正在使用。`, 'error');
            return;
        }
        if (!window.confirm(`刪除 No. ${key}「${localCat[key]?.Name ?? ''}」？其 BOM 與示意圖也會一併移除。`)) return;

        const cat = { ...localCat }; delete cat[key];
        setLocalCat(cat);

        const bom = { ...dbBom }; delete bom[key];
        const diagrams = { ...dbDiagrams }; delete diagrams[key];
        setDbBom(bom);
        setDbDiagrams(diagrams);
        showNotice(`已移除 No. ${key}，請按 Save Changes 套用。`, 'info');
    };

    const handleCommit = () => {
        setDbCatalog(localCat);
        showNotice('✅ Catalog 已更新。', 'success');
    };

    const sortedKeys = Object.keys(localCat).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    return (
        <div className="border p-4 mb-4 rounded">
            <h4 className="font-bold mb-2">📂 2. Manage Catalog</h4>
            <Notice notice={notice} />
            <div className="h-64 overflow-y-auto mb-2 border">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="p-1 border w-16">SOP No.</th>
                            <th className="p-1 border">Name</th>
                            <th className="p-1 border w-32">Stock Code</th>
                            <th className="p-1 border w-16">Action</th>
                        </tr>
                    </thead>
                    <tbody>{sortedKeys.map(k => {
                        const v = localCat[k];
                        return (
                            <tr key={k}>
                                <td className="p-1 border text-center">{k}</td>
                                <td className="p-1 border"><input className="w-full" value={v.Name ?? ""} onChange={(e) => setLocalCat({ ...localCat, [k]: { ...v, Name: e.target.value } })} /></td>
                                <td className="p-1 border"><input className="w-full" value={v.Stock_Code ?? ""} onChange={(e) => setLocalCat({ ...localCat, [k]: { ...v, Stock_Code: e.target.value } })} /></td>
                                <td className="p-1 border text-center">
                                    <button onClick={() => handleDelete(k)} className="text-red-500 hover:text-red-700" title={`Delete No. ${k}`} aria-label={`Delete No. ${k}`}>
                                        <Icons.Trash2 className="w-4 h-4 inline" />
                                    </button>
                                </td>
                            </tr>
                        );
                    })}</tbody>
                </table>
            </div>
            <div className="flex gap-2 mb-2 items-end bg-gray-50 p-2 rounded">
                <div className="text-xs text-gray-500 pb-1 whitespace-nowrap">No. {nextSopNo()}</div>
                <div className="flex-1"><label className="text-xs block">New Name</label><input className="border p-1 text-sm w-full block" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. 1/2” C-Flex Tubing Set" /></div>
                <div><label className="text-xs block">Stock Code</label><input className="border p-1 text-sm w-28 block" value={newStockCode} onChange={e => setNewStockCode(e.target.value)} placeholder="(optional)" /></div>
                <button onClick={handleAdd} disabled={!newName.trim()} className="bg-blue-500 text-white px-3 py-1 rounded text-sm disabled:opacity-50">+ Add</button>
            </div>
            <button onClick={handleCommit} className="bg-green-600 text-white px-4 py-2 rounded text-sm w-full">Save Changes</button>
        </div>
    );
};

export default CatalogEditor;
