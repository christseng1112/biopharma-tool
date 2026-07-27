import { useState, useEffect } from 'react';

export const CatalogEditor = ({ dbCatalog, setDbCatalog }) => {
    const [localCat, setLocalCat] = useState(dbCatalog);

    useEffect(() => { setLocalCat(dbCatalog); }, [dbCatalog]);

    const handleCommit = () => { setDbCatalog(localCat); alert("Catalog Updated!"); };

    return (
        <div className="border p-4 mb-4 rounded">
            <h4 className="font-bold mb-2">📂 2. Manage Catalog</h4>
            <div className="h-64 overflow-y-auto mb-2 border">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0"><tr><th className="p-1 border">SOP No.</th><th className="p-1 border">Name</th><th className="p-1 border">Stock Code</th></tr></thead>
                    <tbody>{Object.entries(localCat).map(([k, v]) => (
                        <tr key={k}>
                            <td className="p-1 border">{k}</td>
                            <td className="p-1 border"><input className="w-full" value={v.Name ?? ""} onChange={(e) => setLocalCat({ ...localCat, [k]: { ...v, Name: e.target.value } })} /></td>
                            <td className="p-1 border"><input className="w-full" value={v.Stock_Code ?? ""} onChange={(e) => setLocalCat({ ...localCat, [k]: { ...v, Stock_Code: e.target.value } })} /></td>
                        </tr>
                    ))}</tbody>
                </table>
            </div>
            <button onClick={handleCommit} className="bg-green-600 text-white px-4 py-2 rounded text-sm w-full">Save Changes</button>
        </div>
    );
};

export default CatalogEditor;
