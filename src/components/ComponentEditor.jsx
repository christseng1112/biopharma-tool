import { useState, useEffect } from 'react';

export const ComponentEditor = ({ dbComponents, setDbComponents, dbBom }) => {
    const [localComps, setLocalComps] = useState(dbComponents);
    const [editCode, setEditCode] = useState("");
    const [editName, setEditName] = useState("");
    const [editUnit, setEditUnit] = useState("");
    const [errorMsg, setErrorMsg] = useState("");

    useEffect(() => { setLocalComps(dbComponents); }, [dbComponents]);

    const handleDelete = (code) => {
        let used = false;
        Object.values(dbBom).forEach(bomList => { bomList.forEach(part => { if (part.Code === code) used = true; }); });
        if (used) { setErrorMsg(`⛔ Action Blocked: ${code} is used in BOM.`); setTimeout(() => setErrorMsg(""), 5000); return; }
        const newC = { ...localComps }; delete newC[code]; setLocalComps(newC);
    };

    const handleSaveRow = () => {
        if (!editCode) return;
        setLocalComps({ ...localComps, [editCode]: { Name: editName, Unit: editUnit } });
        setEditCode(""); setEditName(""); setEditUnit("");
    };

    const handleCommit = () => { setDbComponents(localComps); alert("Components Updated!"); };

    return (
        <div className="border p-4 mb-4 rounded">
            <h4 className="font-bold mb-2">🔧 1. Manage Components (Delete Protected)</h4>
            {errorMsg && <div className="bg-red-100 text-red-700 p-2 rounded mb-2">{errorMsg}</div>}
            <div className="h-64 overflow-y-auto mb-2 border">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0"><tr><th className="p-1 border">Code</th><th className="p-1 border">Name</th><th className="p-1 border">Unit</th><th className="p-1 border">Action</th></tr></thead>
                    <tbody>{Object.entries(localComps).map(([k, v]) => (
                        <tr key={k} className="border-b">
                            <td className="p-1 border">{k}</td>
                            <td className="p-1 border">{v.Name}</td>
                            <td className="p-1 border">{v.Unit}</td>
                            <td className="p-1 border text-center"><button onClick={() => handleDelete(k)} className="text-red-500">🗑️</button></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <div className="flex gap-2 mb-2 items-end bg-gray-50 p-2 rounded">
                <div><label className="text-xs">Code</label><input className="border p-1 text-sm w-20 block" value={editCode} onChange={e => setEditCode(e.target.value)} /></div>
                <div className="flex-1"><label className="text-xs">Name</label><input className="border p-1 text-sm w-full block" value={editName} onChange={e => setEditName(e.target.value)} /></div>
                <div><label className="text-xs">Unit</label><input className="border p-1 text-sm w-16 block" value={editUnit} onChange={e => setEditUnit(e.target.value)} /></div>
                <button onClick={handleSaveRow} className="bg-blue-500 text-white px-3 py-1 rounded text-sm">Update</button>
            </div>
            <button onClick={handleCommit} className="bg-green-600 text-white px-4 py-2 rounded text-sm w-full">Save Changes</button>
        </div>
    );
};

export default ComponentEditor;
