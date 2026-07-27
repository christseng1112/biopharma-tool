import { escapeHtml } from './normalize.js';
import { APP_VERSION } from './config.js';

/**
 * Report generators. Output is both rendered in-app (via dangerouslySetInnerHTML)
 * and written to standalone downloadable HTML files, so every interpolated value
 * must pass through escapeHtml — the fields come from the Database editor and
 * from imported config files.
 */

/** Inlined into downloaded reports so they render standalone. */
export const CSS_STRING = `
<style>
.report-container { font-family: Arial, sans-serif; background-color: white; padding: 5px; }
.stage-header { color: #2c3e50; font-size: 1.2rem; font-weight: bold; border-left: 5px solid #ff4b4b; padding-left: 10px; margin-top: 25px; margin-bottom: 10px; background-color: transparent; }
.custom-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 13px; color: #000; }
.custom-table th { background-color: #e0e0e0; color: black; border: 1px solid black; padding: 8px; text-align: center; font-weight: bold; }
.custom-table td { border: 1px solid black; padding: 8px; vertical-align: middle; background-color: white; color: black; }
.diagram-code { font-family: 'Courier New', monospace; font-size: 11px; white-space: pre-wrap; line-height: 1.2; margin-top: 5px; color: #333; }
.text-center { text-align: center; }
.text-blue { color: blue; font-weight: bold; text-align: center; }
.bg-light { background-color: #f9f9f9 !important; text-align: center; }
.total-detail { font-size: 0.85em; color: #555; display: block; margin-top: 2px; }
.picking-title { font-size: 1.1rem; font-weight: bold; color: #333; margin-top: 20px; border-bottom: 2px solid #ccc; padding-bottom: 5px; }
.provenance { border: 1px solid #bbb; background: #f7f7f7; font-size: 12px; color: #333; margin: 10px 0 18px; padding: 8px 10px; }
.provenance table { border-collapse: collapse; width: 100%; }
.provenance td { padding: 2px 6px; vertical-align: top; border: 0; }
.provenance td.k { color: #555; white-space: nowrap; width: 1%; }
.provenance .uncontrolled { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #bbb; font-weight: bold; color: #8a2b2b; }
</style>
`;

/**
 * These reports get printed and carried onto the production floor, where a page
 * with no origin on it is indistinguishable from any other page. The header
 * records when it was produced, by which version of the tool, and from which
 * dataset — and states plainly that it is not a controlled document.
 *
 * `sourceLabel` identifies the dataset: the imported filename, or a marker for
 * the built-in defaults. `generatedAt` is injectable so output is reproducible
 * under test.
 */
export function provenanceHTML({ title, sourceLabel, generatedAt = new Date(), appVersion = APP_VERSION } = {}) {
    const stamp = Number.isNaN(generatedAt?.getTime?.()) ? new Date() : generatedAt;
    const pad = (n) => String(n).padStart(2, '0');
    const formatted = `${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())} `
        + `${pad(stamp.getHours())}:${pad(stamp.getMinutes())}:${pad(stamp.getSeconds())}`;

    // The document name is already the report's <h1>; repeating it here would
    // just be noise on a printed sheet.
    const rows = [
        ['Generated / 產生時間', formatted],
        ['Tool version / 工具版本', `v${appVersion}`],
        ['Data source / 資料來源', sourceLabel || '(built-in defaults / 內建預設值)']
    ];

    return '<div class="provenance"><table>'
        + rows.map(([k, v]) => `<tr><td class="k">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`).join("")
        + '</table>'
        + '<div class="uncontrolled">⚠️ 本文件由工具自動產生，為非受控文件 (UNCONTROLLED DOCUMENT). '
        + '正式生產請依所屬品質系統之受控文件作業。</div>'
        + '</div>';
}

export function generateAssemblyGuideHTML(stageList, tasks, customBomMap, componentsDb, diagramsDb, provenance = {}) {
    const title = 'Biopharma Assembly Guide (裝配工單)';
    const htmlParts = [
        `<div class="report-container"><h1>${title}</h1>`,
        provenanceHTML({ title, ...provenance })
    ];

    stageList.forEach(stage => {
        const stageTasks = tasks.filter(t => t.Stage === stage && !t.Is_Stock && !t.Material_Code);
        if (stageTasks.length === 0) return;

        htmlParts.push(`<div class="stage-header">📍 製程階段: ${escapeHtml(stage)}</div>`);
        htmlParts.push('<table class="custom-table"><thead><tr><th style="width:35%;">Assembly Item / Diagram (管組示意圖)</th><th style="width:8%;">Set Qty<br>(套數)</th><th style="width:25%;">Material Detail (物料明細)</th><th style="width:12%;">Length/Seg<br>(單段長度)</th><th style="width:8%;">Seg/Set<br>(段/套)</th><th style="width:12%;">Total Qty<br>(本站總需)</th></tr></thead><tbody>');

        stageTasks.forEach(t => {
            const sopId = parseInt(t['SOP No.'], 10);
            const qtySets = t['Qty'];
            const jsonBom = customBomMap[sopId] || [];
            const safeDiagram = escapeHtml(diagramsDb[sopId] || "");
            const rowSpan = jsonBom.length > 0 ? jsonBom.length : 1;
            let isFirstRow = true;

            jsonBom.forEach(part => {
                const pCode = part['Code'];
                const matInfo = componentsDb[pCode] || { 'Name': 'Unknown' };
                const isTubing = Object.prototype.hasOwnProperty.call(part, 'Len') && part['Len'] > 0;
                const lenPerSeg = isTubing ? `${escapeHtml(part['Len'])} cm` : "-";
                const segPerSet = part['Count'] || 1;
                const totalSegs = segPerSet * qtySets;
                const totalLen = isTubing ? (part['Len'] || 0) * totalSegs : 0;
                const totalDisp = isTubing
                    ? (totalSegs > 1
                        ? `<b>${escapeHtml(totalLen)} cm</b><br><span class='total-detail'>(${escapeHtml(totalSegs)} x ${escapeHtml(part['Len'])} cm)</span>`
                        : `<b>${escapeHtml(totalLen)} cm</b>`)
                    : `${escapeHtml(totalSegs)} ea`;

                htmlParts.push('<tr>');
                if (isFirstRow) {
                    htmlParts.push(`<td rowspan="${rowSpan}" class="text-center"><b>No. ${escapeHtml(sopId)}</b><br><span style="font-size:0.9em;">${escapeHtml(t["Name"])}</span><br><div class="diagram-code">${safeDiagram}</div></td><td rowspan="${rowSpan}" class="text-center" style="font-size:1.1em; font-weight:bold;">${escapeHtml(qtySets)}</td>`);
                }
                htmlParts.push(`<td><b>${escapeHtml(pCode)}</b><br><span style="color:#555; font-size:0.9em;">${escapeHtml(matInfo["Name"])}</span></td><td class="text-blue">${lenPerSeg}</td><td class="text-center">${escapeHtml(segPerSet)}</td><td class="bg-light">${totalDisp}</td></tr>`);
                isFirstRow = false;
            });
        });

        htmlParts.push('</tbody></table>');
    });

    htmlParts.push('</div>');
    return htmlParts.join("");
}

export function generatePickingListHTML(tasks, customBomMap, componentsDb, catalogDb, provenance = {}) {
    const rawMaterialTotals = {};
    const stockSetTotals = {};
    const isCodeTubing = {};

    tasks.forEach(t => {
        if (t.Is_Stock) {
            const stockCode = t.Material_Code;
            if (stockCode) stockSetTotals[stockCode] = (stockSetTotals[stockCode] || 0) + t.Qty;
        } else {
            const sopId = parseInt(t['SOP No.'], 10);
            const bom = customBomMap[sopId] || [];
            bom.forEach(part => {
                const pCode = part.Code;
                const isTubing = Object.prototype.hasOwnProperty.call(part, 'Len') && part.Len > 0;
                isCodeTubing[pCode] = (isCodeTubing[pCode] || isTubing);
                const segCount = part.Count || 1;
                const totalNeeded = segCount * t.Qty;

                if (!rawMaterialTotals[pCode]) {
                    rawMaterialTotals[pCode] = { Total: 0, Details: {} };
                }

                if (isTubing) {
                    rawMaterialTotals[pCode].Total += (part.Len * totalNeeded);
                    const lenKey = part.Len;
                    rawMaterialTotals[pCode].Details[lenKey] = (rawMaterialTotals[pCode].Details[lenKey] || 0) + totalNeeded;
                } else {
                    rawMaterialTotals[pCode].Total += totalNeeded;
                }
            });
        }
    });

    const title = 'Total Material Picking List (總領料單)';
    const htmlParts = [
        `<div class="report-container"><h1>${title}</h1>`,
        provenanceHTML({ title, ...provenance })
    ];

    if (Object.keys(rawMaterialTotals).length > 0) {
        htmlParts.push('<div class="picking-title">A. Raw Materials (自製耗材總表)</div>');
        htmlParts.push('<table class="custom-table"><thead><tr><th style="width:15%;">Material Code</th><th style="width:40%;">Material Name / Description</th><th style="width:25%;">Total Quantity Needed</th><th style="width:20%;">Cutting Details (Tubing)</th></tr></thead><tbody>');

        Object.keys(rawMaterialTotals).sort().forEach(code => {
            const data = rawMaterialTotals[code];
            const total = data.Total;
            const matInfo = componentsDb[code] || { 'Name': 'Unknown', 'Unit': '?' };
            const isTubing = isCodeTubing[code];
            const unit = isTubing ? "cm" : "ea";

            const qtyDisplay = unit === "cm"
                ? `<b>${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unit}</b>`
                : `${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unit}`;

            let detailHtml = "-";
            if (isTubing && Object.keys(data.Details).length > 0) {
                const details = [];
                Object.keys(data.Details).sort((a, b) => parseFloat(b) - parseFloat(a)).forEach(len => {
                    details.push(`${escapeHtml(len)} cm x ${escapeHtml(data.Details[len])}`);
                });
                detailHtml = details.join("<br>");
            }

            htmlParts.push(`<tr><td class="text-center"><b>${escapeHtml(code)}</b></td><td>${escapeHtml(matInfo["Name"])}</td><td class="text-center" style="font-size:1.1em;">${qtyDisplay}</td><td class="text-center" style="font-size:0.9em; color:#555;">${detailHtml}</td></tr>`);
        });
        htmlParts.push('</tbody></table>');
    } else {
        htmlParts.push('<p style="padding:10px;">No raw materials required.</p>');
    }

    if (Object.keys(stockSetTotals).length > 0) {
        htmlParts.push('<div class="picking-title" style="margin-top:30px;">B. Stock Sets (庫存套件領取表)</div>');
        htmlParts.push('<table class="custom-table"><thead><tr><th style="width:20%;">Stock Code</th><th style="width:50%;">Set Name</th><th style="width:30%;">Total Sets to Pick</th></tr></thead><tbody>');

        const stockNameMap = {};
        Object.values(catalogDb).forEach(v => { if (v.Stock_Code) stockNameMap[v.Stock_Code] = v.Name; });

        Object.keys(stockSetTotals).sort().forEach(code => {
            const count = stockSetTotals[code];
            const name = stockNameMap[code] || "Unknown Stock Set";
            htmlParts.push(`<tr><td class="text-center"><b>${escapeHtml(code)}</b></td><td>${escapeHtml(name)}</td><td class="text-center" style="font-size:1.1em;"><b>${escapeHtml(count)} ea</b></td></tr>`);
        });
        htmlParts.push('</tbody></table>');
    }

    htmlParts.push('</div>');
    return htmlParts.join("");
}
