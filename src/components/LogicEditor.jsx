import { useState, useEffect } from 'react';

export const LogicEditor = ({ dbCatalog, dbDiagrams, setDbDiagrams, dbBom, setDbBom, dbComponents }) => {
    const [selectedSop, setSelectedSop] = useState("");
    const [diagram, setDiagram] = useState("");
    const [bom, setBom] = useState([]);

    useEffect(() => {
        const keys = Object.keys(dbCatalog);
        if (keys.length > 0 && (!selectedSop || !dbCatalog[selectedSop])) setSelectedSop(keys[0]);
    }, [dbCatalog]);

    useEffect(() => {
        if (selectedSop) {
            setDiagram(dbDiagrams[selectedSop] ?? "");
            setBom((dbBom[selectedSop] ?? []).map(item => ({ ...item, Len: item.Len ?? 0, Count: item.Count ?? 1 })));
        } else {
            setDiagram(""); setBom([]);
        }
    }, [selectedSop, dbDiagrams, dbBom]);

    // Keep unparseable input as "" rather than storing NaN in state.
    const updateBomRow = (idx, field, val) => {
        setBom(prevBom => prevBom.map((item, i) => {
            if (i !== idx) return item;
            if (val === "") return { ...item, [field]: "" };
            const num = field === 'Count' ? parseInt(val, 10) : parseFloat(val);
            return { ...item, [field]: Number.isFinite(num) ? num : "" };
        }));
    };

    const addBomRow = () => setBom([...bom, { Code: Object.keys(dbComponents)[0] || "", Len: 0, Count: 1 }]);
    const removeBomRow = (idx) => setBom(bom.filter((_, i) => i !== idx));

    const handleSave = () => {
        if (!selectedSop) return;
        const cleanBom = bom
            .map(item => ({
                ...item,
                Len: Number.isFinite(parseFloat(item.Len)) ? parseFloat(item.Len) : 0,
                Count: Number.isFinite(parseInt(item.Count, 10)) ? parseInt(item.Count, 10) : 1
            }))
            .filter(item => item.Count > 0);
        setDbDiagrams({ ...dbDiagrams, [selectedSop]: diagram });
        setDbBom({ ...dbBom, [selectedSop]: cleanBom });
        alert("Logic Updated!");
    };

    if (!selectedSop && Object.keys(dbCatalog).length === 0) return <div>No Catalog items.</div>;

    return (
        <div className="border p-4 mb-4 rounded">
            <h4 className="font-bold mb-2">🛠️ 3. Assembly Logic</h4>
            <div className="flex gap-4 mb-4">
                <div className="w-1/3">
                    <label className="text-sm font-bold block mb-1">Select Tubing Set</label>
                    <select className="w-full border p-2" value={selectedSop ?? ""} onChange={e => setSelectedSop(e.target.value)}>
                        {Object.keys(dbCatalog).map(k => <option key={k} value={k}>No. {k}</option>)}
                    </select>
                </div>
                <div className="w-2/3">
                    <label className="text-sm font-bold block mb-1">A. Diagram (ASCII)</label>
                    <textarea className="w-full border p-2 font-mono text-xs h-24" value={diagram ?? ""} onChange={e => setDiagram(e.target.value)}></textarea>
                    <label className="text-sm font-bold block mt-2 mb-1">B. BOM</label>
                    <div className="border p-2 bg-gray-50">
                        {bom.map((row, idx) => (
                            <div key={idx} className="flex gap-2 mb-1">
                                <select className="border text-xs w-40" value={row.Code ?? ""} onChange={e => updateBomRow(idx, 'Code', e.target.value)}>
                                    {Object.keys(dbComponents).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <input type="number" className="border text-xs w-20" placeholder="Len" value={row.Len} onChange={e => updateBomRow(idx, 'Len', e.target.value)} />
                                <input type="number" className="border text-xs w-16" placeholder="Count" value={row.Count} onChange={e => updateBomRow(idx, 'Count', e.target.value)} />
                                <button onClick={() => removeBomRow(idx)} className="text-red-500">x</button>
                            </div>
                        ))}
                        <button onClick={addBomRow} className="text-xs bg-gray-200 px-2 py-1 rounded">+ Add Row</button>
                    </div>
                    <button onClick={handleSave} className="mt-4 bg-green-600 text-white px-4 py-2 rounded text-sm w-full">💾 Save Logic for No. {selectedSop}</button>
                </div>
            </div>
        </div>
    );
};

export default LogicEditor;
