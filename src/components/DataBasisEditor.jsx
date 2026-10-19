import { useState, useEffect } from 'react';
import { Notice, useNotice } from './Notice.jsx';

/**
 * Records which SOP revision the current data was checked against. When the SOP
 * is revised, the data is updated in the editors below and the new revision is
 * recorded here — no code release needed. Recording also captures a fingerprint
 * of the data, so later edits show up as "modified since recorded" on reports.
 */
export const DataBasisEditor = ({ dataBasis, dataBasisLabel, isCurrent, onRecord }) => {
    const [reference, setReference] = useState(dataBasis?.reference ?? "");
    const [notice, showNotice] = useNotice();

    useEffect(() => { setReference(dataBasis?.reference ?? ""); }, [dataBasis]);

    const handleRecord = () => {
        const ref = reference.trim();
        if (!ref) { showNotice('請先輸入依據文件與版本，例如 SOP-000022 v9.0。', 'error'); return; }
        onRecord(ref);
        showNotice(`✅ 已記錄目前資料的依據為「${ref}」。`, 'success');
    };

    const tone = isCurrent
        ? 'bg-green-50 border-green-300 text-green-800'
        : 'bg-amber-50 border-amber-300 text-amber-800';

    return (
        <div className="border p-4 mb-4 rounded">
            <h4 className="font-bold mb-2">📑 Data Basis (資料依據)</h4>
            <Notice notice={notice} />
            <p className={`text-sm border rounded p-2 mb-2 ${tone}`}>目前狀態：{dataBasisLabel}</p>
            <p className="text-xs text-gray-600 mb-2">
                Components、Catalog、示意圖與 BOM 依 SOP 核對完成後，於此記錄依據文件與版本。
                記錄後若再修改上述資料，報表會標示「記錄後資料已修改」，直到重新核對並記錄。
            </p>
            <div className="flex gap-2 items-end bg-gray-50 p-2 rounded">
                <div className="flex-1"><label className="text-xs block">Reference</label><input className="border p-1 text-sm w-full block" value={reference} onChange={e => setReference(e.target.value)} placeholder="e.g. SOP-000022 v9.0" /></div>
                <button onClick={handleRecord} disabled={!reference.trim()} className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">記錄為目前資料的依據</button>
            </div>
        </div>
    );
};

export default DataBasisEditor;
