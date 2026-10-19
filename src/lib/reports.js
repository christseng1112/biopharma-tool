import { escapeHtml } from './normalize.js';
import { APP_VERSION } from './config.js';
import { cycleTubingSummary } from './forms.js';
import { QUALITY, MAX_CYCLES } from './scheduler.js';
import { formatTimestamp } from './format.js';
/** @typedef {import('./types.js').Assignment} Assignment */
/** @typedef {import('./types.js').BomPart} BomPart */
/** @typedef {import('./types.js').CatalogEntry} CatalogEntry */
/** @typedef {import('./types.js').Component} Component */
/** @typedef {import('./types.js').ScheduleResult} ScheduleResult */
/** @typedef {import('./types.js').ReportProvenance} ReportProvenance */


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
.form-note { font-size: 12px; color: #555; margin: 4px 0 10px; }
.form-blank { min-width: 90px; }
.provenance .uncontrolled { margin-top: 6px; padding-top: 6px; border-top: 1px dashed #bbb; font-weight: bold; color: #8a2b2b; }
.schedule-summary { border: 1px solid #ccc; background: #fafafa; padding: 8px 10px; margin-bottom: 15px; font-size: 13px; }
.cycle-header { background: #2c3e50; color: white; font-weight: bold; padding: 6px 10px; margin-top: 18px; font-size: 14px; }
.cycle-header .cycle-meta { font-weight: normal; font-size: 0.85em; color: #cfd8e3; }
.warn-block { border: 2px solid #c0392b; background: #fdecea; color: #7f1d1d; padding: 10px; margin: 12px 0; font-size: 13px; }
.warn-block h3 { margin: 0 0 6px; font-size: 14px; }
.warn-block ul { margin: 0; padding-left: 20px; }
.done-col { width: 8%; }
.batch-blank { display: inline-block; min-width: 160px; border-bottom: 1px solid #333; }
/* Printed reports are filed with the batch record: A4, table headers repeated
   on every page, and no table row or cycle heading split across a page break. */
@media print {
  @page { size: A4; margin: 12mm; }
  body { margin: 0; }
  .report-container { padding: 0; }
  thead { display: table-header-group; }
  tr, .provenance, .warn-block { break-inside: avoid; page-break-inside: avoid; }
  .stage-header, .cycle-header, .picking-title { break-after: avoid; page-break-after: avoid; }
  .custom-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .no-print { display: none !important; }
}
</style>
`;

/**
 * These reports get printed and carried onto the production floor, where a page
 * with no origin on it is indistinguishable from any other page. The header
 * records when it was produced, by which version of the tool, and from which
 * dataset — and states plainly that it is not a controlled document.
 *
 * `sourceLabel` identifies the dataset: the imported filename, or a marker for
 * the built-in defaults. `dataBasisLabel` names the controlled document the
 * SOP data was checked against, `patternBasisLabel` the one the autoclave
 * loading patterns were (only the autoclave reports pass it). `batchNo` ties
 * the sheet to its batch record; left blank it prints a line to write on.
 * `generatedAt` is injectable so output is reproducible under test.
 * @param {{title?: string} & ReportProvenance & {appVersion?: string}} [opts]
 * @returns {string} HTML fragment
 */
export function provenanceHTML({ title, sourceLabel, dataBasisLabel, patternBasisLabel, batchNo, generatedAt = new Date(), appVersion = APP_VERSION } = {}) {
    const formatted = formatTimestamp(generatedAt);

    // The document name is already the report's <h1>; repeating it here would
    // just be noise on a printed sheet.
    const rows = [
        ['Batch No. / 批號', null],
        ['Generated / 產生時間', formatted],
        ['Tool version / 工具版本', `v${appVersion}`],
        ['Data source / 資料來源', sourceLabel || '(built-in defaults / 內建預設值)']
    ];
    // Which SOP revision the data was checked against (see lib/dataBasis.js).
    if (dataBasisLabel) rows.push(['Data basis / 資料依據', dataBasisLabel]);
    if (patternBasisLabel) rows.push(['Pattern basis / 滅菌 Pattern 依據', patternBasisLabel]);

    const batch = String(batchNo ?? '').trim();
    const cell = (v) => (v === null
        ? (batch ? `<b>${escapeHtml(batch)}</b>` : '<span class="batch-blank">&nbsp;</span>')
        : escapeHtml(v));

    return '<div class="provenance"><table>'
        + rows.map(([k, v]) => `<tr><td class="k">${escapeHtml(k)}</td><td>${cell(v)}</td></tr>`).join("")
        + '</table>'
        + '<div class="uncontrolled">⚠️ 本文件由工具自動產生，為非受控文件 (UNCONTROLLED DOCUMENT). '
        + '正式生產請依所屬品質系統之受控文件作業。</div>'
        + '</div>';
}

/**
 * @param {string[]} stageList
 * @param {Assignment[]} tasks
 * @param {Record<number, BomPart[]>} customBomMap
 * @param {Record<string, Component>} componentsDb
 * @param {Record<number, string>} diagramsDb
 * @param {ReportProvenance} [provenance]
 * @returns {string} HTML fragment
 */
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

            // A set whose BOM has no rows used to produce no row at all: the
            // whole item silently vanished from the work order, so nobody on
            // the floor would know it needed assembling. Emit the row and say
            // plainly that the BOM is missing.
            if (jsonBom.length === 0) {
                htmlParts.push('<tr>');
                htmlParts.push(`<td rowspan="1" class="text-center"><b>No. ${escapeHtml(sopId)}</b><br><span style="font-size:0.9em;">${escapeHtml(t["Name"])}</span><br><div class="diagram-code">${safeDiagram}</div></td><td rowspan="1" class="text-center" style="font-size:1.1em; font-weight:bold;">${escapeHtml(qtySets)}</td>`);
                htmlParts.push('<td colspan="4" style="color:#8a2b2b; font-weight:bold;">⚠️ 此品項尚未定義 BOM (no BOM defined) — 無法產生物料明細，請於 Database 分頁補齊。</td></tr>');
                return;
            }

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

/**
 * @param {Assignment[]} tasks
 * @param {Record<number, BomPart[]>} customBomMap
 * @param {Record<string, Component>} componentsDb
 * @param {Record<number, CatalogEntry>} catalogDb
 * @param {ReportProvenance} [provenance]
 * @returns {string} HTML fragment
 */
export function generatePickingListHTML(tasks, customBomMap, componentsDb, catalogDb, provenance = {}) {
    const rawMaterialTotals = {};
    const stockSetTotals = {};

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
                const segCount = part.Count || 1;
                const totalNeeded = segCount * t.Qty;

                if (!rawMaterialTotals[pCode]) {
                    // Length and piece counts are tracked separately. A single
                    // total used to hold both, so a code used as tubing in one
                    // BOM and as a fitting in another produced "30 cm + 1 ea"
                    // printed as "31 cm" — a number that means nothing.
                    rawMaterialTotals[pCode] = { lengthCm: 0, pieces: 0, Details: {} };
                }

                if (isTubing) {
                    rawMaterialTotals[pCode].lengthCm += (part.Len * totalNeeded);
                    const lenKey = part.Len;
                    rawMaterialTotals[pCode].Details[lenKey] = (rawMaterialTotals[pCode].Details[lenKey] || 0) + totalNeeded;
                } else {
                    rawMaterialTotals[pCode].pieces += totalNeeded;
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

        const fmt = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });

        Object.keys(rawMaterialTotals).sort().forEach(code => {
            const data = rawMaterialTotals[code];
            const matInfo = componentsDb[code] || { 'Name': 'Unknown', 'Unit': '?' };
            const isTubing = data.lengthCm > 0;
            const hasPieces = data.pieces > 0;

            const parts = [];
            if (isTubing) parts.push(`<b>${fmt(data.lengthCm)} cm</b>`);
            if (hasPieces) parts.push(`${fmt(data.pieces)} ea`);
            // Neither is a real case (a BOM row always contributes to one of
            // them), but showing 0 ea beats showing an empty cell.
            let qtyDisplay = parts.length > 0 ? parts.join('<br>') : '0 ea';
            if (isTubing && hasPieces) {
                qtyDisplay += `<br><span class='total-detail' style="color:#8a2b2b;">⚠️ 此料號同時以管材與配件計量，請分別領取</span>`;
            }

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

/**
 * SOP-000022 Attachment 2 Part A — Assembled Amount of Tubing Sets.
 *
 * `rows` comes from assembledAmounts(): one row per form Number, summed across
 * the selected stages, variants folded into their base number. Only numbers
 * with a non-zero amount are listed; the breakdown column lets the total be
 * checked against the plan.
 */
export function generateAttachment2PartAHTML(rows, { stages = [], provenance = {} } = {}) {
    const title = 'SOP-000022 Attachment 2 Part A — Assembled Amount of Tubing Sets (組裝數量)';
    const htmlParts = [
        `<div class="report-container"><h1>${title}</h1>`,
        provenanceHTML({ title, ...provenance }),
        `<div class="form-note">納入的製程階段 (Stages included): ${stages.length > 0 ? stages.map(escapeHtml).join('、') : '(none)'}</div>`
    ];

    if (rows.length === 0) {
        htmlParts.push('<p style="padding:10px;">所選階段沒有需要組裝的管組 (no assembled tubing sets).</p></div>');
        return htmlParts.join("");
    }

    htmlParts.push('<table class="custom-table"><thead><tr><th style="width:10%;">Number</th><th style="width:40%;">Assembly Name</th><th style="width:15%;">Amount (set)</th><th style="width:35%;">Breakdown (明細)</th></tr></thead><tbody>');
    rows.forEach(r => {
        const detail = [];
        if (r.variants.length > 1 || (r.variants[0] && r.variants[0].sopNo !== r.no)) {
            detail.push(r.variants.map(v => `No. ${escapeHtml(v.sopNo)} ${escapeHtml(v.name)}: ${escapeHtml(v.qty)}`).join('<br>'));
        }
        detail.push(r.stages.map(st => `${escapeHtml(st.stage)}: ${escapeHtml(st.qty)}`).join('<br>'));
        htmlParts.push(`<tr><td class="text-center"><b>${escapeHtml(r.no)}</b></td><td>${escapeHtml(r.name)}</td><td class="text-center" style="font-size:1.1em;"><b>${escapeHtml(r.total)}</b></td><td style="font-size:0.9em; color:#555;">${detail.join('<hr style="border:0;border-top:1px dashed #ccc;margin:4px 0;">')}</td></tr>`);
    });
    const total = rows.reduce((n, r) => n + r.total, 0);
    htmlParts.push(`<tr><td colspan="2" style="text-align:right;"><b>Total</b></td><td class="text-center"><b>${escapeHtml(total)}</b></td><td></td></tr>`);
    htmlParts.push('</tbody></table></div>');
    return htmlParts.join("");
}

/**
 * SOP-000022 Attachment 2 Part B — Sterilization Records.
 *
 * One row per scheduled load that contains tubing sets. The autoclave cycle
 * number, expiry date and signature are left blank: the cycle number is
 * assigned by the autoclave and the rest is completed on the floor. Group B
 * equipment in the same load is noted under the load number but kept out of
 * the form's tubing-set column.
 */
export function generateAttachment2PartBHTML(schedule, formIndex, { provenance = {} } = {}) {
    const title = 'SOP-000022 Attachment 2 Part B — Sterilization Records (滅菌紀錄)';
    const htmlParts = [
        `<div class="report-container"><h1>${title}</h1>`,
        provenanceHTML({ title, ...provenance }),
        '<div class="form-note">Load # 為工具的排程順序，非滅菌鍋 Cycle No.；Cycle No.、Expiry Date 與 Performed by/Date 請於現場填寫。</div>'
    ];

    const loads = schedule
        .map(cycle => ({ cycle, summary: cycleTubingSummary(cycle, formIndex) }))
        .filter(l => l.summary.sets.length > 0);

    if (loads.length === 0) {
        htmlParts.push('<p style="padding:10px;">排程中沒有管組 (no tubing sets in the schedule).</p></div>');
        return htmlParts.join("");
    }

    htmlParts.push('<table class="custom-table"><thead><tr><th style="width:16%;">Load #<br>(排程順序)</th><th style="width:14%;">Autoclave Cycle No.</th><th style="width:34%;">Number of Tubing Set (amount)<br>(each set separated by slash)</th><th style="width:16%;">Expiry Date of Tubing Sets</th><th style="width:20%;">Performed by/ Date</th></tr></thead><tbody>');
    loads.forEach(({ cycle, summary }) => {
        const others = summary.others.length > 0
            ? `<br><span class="total-detail">+ ${summary.others.map(o => `${escapeHtml(o.item)} x${escapeHtml(o.qty)}`).join(', ')}</span>`
            : '';
        htmlParts.push(`<tr><td class="text-center"><b>Load ${escapeHtml(cycle.cycleNumber)}</b><br><span class="total-detail">${escapeHtml(cycle.pattern?.name)} (${escapeHtml(cycle.pattern?.program)})</span>${others}</td><td class="form-blank"></td><td><b>${escapeHtml(summary.text)}</b><br><span class="total-detail">共 ${escapeHtml(summary.totalSets)} 套</span></td><td class="form-blank"></td><td class="form-blank"></td></tr>`);
    });
    htmlParts.push('</tbody></table></div>');
    return htmlParts.join("");
}

/**
 * The wording shown for each schedule quality, shared by the on-screen badge
 * and the downloadable report so the two can never drift apart. The claim for
 * OPTIMAL is deliberately scoped: the search enumerates pattern sequences, so
 * it proves "no shorter sequence under the current packing rule", not "no
 * shorter schedule exists at all".
 */
export const QUALITY_LABELS = {
    [QUALITY.OPTIMAL]: { label: '最佳解 (Optimal)', title: '已窮舉所有 Pattern 組合：在目前的裝填規則下沒有更短的排程' },
    [QUALITY.HEURISTIC]: { label: '近似解 (Heuristic)', title: '品項過多或搜尋預算用盡，僅提供貪婪解；實際可能存在更短的排程' },
    [QUALITY.INCOMPLETE]: { label: '不完整 (Incomplete)', title: '有品項未能排入任何批次，請見警示區塊' }
};

/**
 * The sterilization schedule as a printable document.
 *
 * The picking list and assembly guide have always been downloadable; the
 * schedule — the sheet an operator actually runs the autoclave from — was
 * screen-only. The warning blocks are part of the document on purpose: a
 * printed schedule that omits what was NOT scheduled invites exactly the
 * silent-omission failure the rest of this tool guards against.
 * @param {Partial<ScheduleResult> & {totalItems?: number}} result
 * @param {ReportProvenance} [provenance]
 * @returns {string} HTML fragment
 */
export function generateScheduleHTML({ schedule = [], unassignable = [], unscheduled = [], quality, totalItems = 0 } = {}, provenance = {}) {
    const title = 'Autoclave Sterilization Schedule (滅菌排程表)';
    const htmlParts = [
        `<div class="report-container"><h1>${title}</h1>`,
        provenanceHTML({ title, ...provenance })
    ];

    const q = QUALITY_LABELS[quality];
    htmlParts.push('<div class="schedule-summary">');
    htmlParts.push(`品項總數 (Total items): <b>${escapeHtml(totalItems)}</b> ・ 滅菌循環數 (Cycles): <b>${escapeHtml(schedule.length)}</b>`);
    if (q) htmlParts.push(` ・ 結果品質: <b>${escapeHtml(q.label)}</b><br><span style="color:#555; font-size:0.9em;">${escapeHtml(q.title)}</span>`);
    htmlParts.push('</div>');

    // Warnings come before the cycles: an operator reading top-down must see
    // what is missing before starting to run what is present.
    if (unassignable.length > 0) {
        htmlParts.push('<div class="warn-block"><h3>⛔ Unassignable — 沒有任何 Pattern 的 Zone 允許下列品項</h3><ul>');
        unassignable.forEach(u => htmlParts.push(`<li>${escapeHtml(u.item)} × ${escapeHtml(u.qty)}</li>`));
        htmlParts.push('</ul><b>下列品項不在本排程中，需另行安排滅菌。</b></div>');
    }
    if (unscheduled.length > 0) {
        htmlParts.push(`<div class="warn-block"><h3>⚠️ Not Scheduled — 超出 ${MAX_CYCLES} 循環上限，未排入任何批次</h3><ul>`);
        unscheduled.forEach(u => htmlParts.push(`<li>${escapeHtml(u.item)} × ${escapeHtml(u.qty)}</li>`));
        htmlParts.push('</ul><b>下列品項不在本排程中，請勿依本表視為已涵蓋。</b></div>');
    }

    if (schedule.length === 0) {
        htmlParts.push('<p style="padding:10px;">No cycles scheduled (無排程循環)。</p>');
    }

    schedule.forEach(cycle => {
        const p = cycle.pattern || {};
        htmlParts.push(`<div class="cycle-header">Cycle ${escapeHtml(cycle.cycleNumber)} — ${escapeHtml(p.name)} <span class="cycle-meta">(Program: ${escapeHtml(p.program)} ・ ${escapeHtml((cycle.loadedItems || []).length)} 筆裝載)</span></div>`);
        htmlParts.push('<table class="custom-table"><thead><tr><th style="width:6%;">#</th><th>Load (裝載內容 — [Zone] 數量 × 品項)</th><th class="done-col">Done<br>(完成)</th></tr></thead><tbody>');
        (cycle.loadedItems || []).forEach((line, i) => {
            htmlParts.push(`<tr><td class="text-center">${i + 1}</td><td>${escapeHtml(line)}</td><td></td></tr>`);
        });
        htmlParts.push('</tbody></table>');
    });

    htmlParts.push('</div>');
    return htmlParts.join("");
}
