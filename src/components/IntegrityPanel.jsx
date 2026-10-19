import { ISSUE_CATEGORIES, ISSUE_LEVEL } from '../lib/integrity.js';

/**
 * Results of checkDataIntegrity, grouped by category. Sits at the top of the
 * Database tab so a defect is visible where it is fixed, before it shows up
 * as a wrong report.
 */
export const IntegrityPanel = ({ issues }) => {
    if (issues.length === 0) {
        return (
            <div className="border border-green-300 bg-green-50 text-green-800 text-sm rounded p-3 mb-4" data-integrity="ok">
                ✅ 資料檢查通過：BOM、示意圖、料號與滅菌 Zone 對應皆無問題。
            </div>
        );
    }
    const errors = issues.filter(i => i.level === ISSUE_LEVEL.ERROR).length;
    const warnings = issues.length - errors;
    const tone = errors > 0 ? 'border-red-300 bg-red-50 text-red-900' : 'border-amber-300 bg-amber-50 text-amber-900';
    return (
        <div className={`border rounded p-3 mb-4 text-sm ${tone}`} data-integrity="issues">
            <h4 className="font-bold mb-2">⚠️ 資料檢查：{errors > 0 && `${errors} 項錯誤`}{errors > 0 && warnings > 0 && '、'}{warnings > 0 && `${warnings} 項警告`}</h4>
            {ISSUE_CATEGORIES.map(([category, title]) => {
                const rows = issues.filter(i => i.category === category);
                if (rows.length === 0) return null;
                return (
                    <div key={category} className="mb-2">
                        <div className="font-semibold">{title}</div>
                        <ul className="list-disc list-inside text-xs">
                            {rows.map((r, i) => <li key={i}><span className="font-mono">{r.ref}</span>{r.message && r.message !== r.ref ? ` — ${r.message}` : ''}</li>)}
                        </ul>
                    </div>
                );
            })}
        </div>
    );
};

export default IntegrityPanel;
