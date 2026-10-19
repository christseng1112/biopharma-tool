import { normalizeName } from './normalize.js';

/**
 * Helpers for filling in SOP-000022 Attachment 2:
 *   Part A — Assembled Amount of Tubing Sets: one Amount (set) per Number (1–30)
 *   Part B — Sterilization Records: per autoclave cycle, the tubing sets loaded,
 *            written as "Number (amount)" separated by slashes
 *
 * The form numbers its tubing sets 1–30, while the catalog also holds assembly
 * variants under their own SOP No. (132 and 142 are variants of 13 and 14, 212
 * of 21). Variants are named "<base name> (Type X)", which normalizeName strips,
 * so a variant and its base share a normalized name. The form number is the
 * lowest SOP No. carrying that name. Autoclave scheduling also works on
 * normalized names, so the same index maps a loaded item back to its number.
 */

const TYPE_SUFFIX = /\s*\(Type\s+[A-Za-z0-9]+\)/i;

/** Map<normalized name, { no, name }> — `name` is the base entry's name without its (Type …) suffix. */
export const buildFormNumberIndex = (catalog) => {
    const index = new Map();
    Object.entries(catalog || {}).forEach(([key, entry]) => {
        const no = parseInt(key, 10);
        if (!Number.isFinite(no) || !entry?.Name) return;
        const norm = normalizeName(entry.Name);
        const existing = index.get(norm);
        if (!existing || no < existing.no) {
            index.set(norm, { no, name: String(entry.Name).replace(TYPE_SUFFIX, '').trim() });
        }
    });
    return index;
};

/**
 * Part A rows: assembled (non-stock) sets summed per form number across stages.
 *
 * `stages` limits the stages counted; null/undefined counts every stage. Rows
 * with a zero total are omitted. Each row keeps the per-variant and per-stage
 * split so the total can be checked against the plan.
 */
export const assembledAmounts = (assignments, catalog, stages) => {
    const index = buildFormNumberIndex(catalog);
    const include = stages ? new Set(stages) : null;
    const rows = new Map();

    (assignments || []).forEach(a => {
        // Same filter as the Assembly Guide: stock sets are picked, not assembled.
        if (a.Is_Stock || a.Material_Code) return;
        if (include && !include.has(a.Stage)) return;
        const qty = Number(a.Qty);
        if (!Number.isFinite(qty) || qty <= 0) return;

        const sopNo = parseInt(a['SOP No.'], 10);
        const entryName = catalog?.[sopNo]?.Name ?? a.Name;
        // An assignment whose catalog entry has since been deleted still counts,
        // under its own SOP No., rather than silently dropping off the form.
        const form = index.get(normalizeName(entryName))
            ?? { no: sopNo, name: String(a.Name ?? '').replace(TYPE_SUFFIX, '').trim() };

        if (!rows.has(form.no)) rows.set(form.no, { no: form.no, name: form.name, total: 0, variants: new Map(), stages: new Map() });
        const row = rows.get(form.no);
        row.total += qty;
        const v = row.variants.get(sopNo) ?? { sopNo, name: entryName, qty: 0 };
        v.qty += qty;
        row.variants.set(sopNo, v);
        row.stages.set(a.Stage, (row.stages.get(a.Stage) ?? 0) + qty);
    });

    const stageOrder = stages ? [...stages] : null;
    return [...rows.values()]
        .sort((x, y) => x.no - y.no)
        .map(r => ({
            no: r.no,
            name: r.name,
            total: r.total,
            variants: [...r.variants.values()].sort((x, y) => x.sopNo - y.sopNo),
            stages: [...r.stages.entries()]
                .map(([stage, qty]) => ({ stage, qty }))
                .sort((x, y) => (stageOrder ? stageOrder.indexOf(x.stage) - stageOrder.indexOf(y.stage) : 0))
        }));
};

/**
 * Part B entry for one scheduled cycle.
 *
 * Tubing sets (items that map to a form number) are merged per number and
 * written as the form asks: "13 (2) / 21 (1)". Everything else in the cycle —
 * Group B equipment — goes to `others`; it is not a tubing set and does not
 * belong on this form.
 */
export const cycleTubingSummary = (cycle, formIndex) => {
    const sets = new Map();
    const others = new Map();
    (cycle?.loadedEntries || []).forEach(({ item, qty }) => {
        const form = formIndex.get(item);
        if (form) sets.set(form.no, (sets.get(form.no) ?? 0) + qty);
        else others.set(item, (others.get(item) ?? 0) + qty);
    });
    const setList = [...sets.entries()].sort((a, b) => a[0] - b[0]).map(([no, qty]) => ({ no, qty }));
    return {
        sets: setList,
        text: setList.map(s => `${s.no} (${s.qty})`).join(' / '),
        totalSets: setList.reduce((n, s) => n + s.qty, 0),
        others: [...others.entries()].map(([item, qty]) => ({ item, qty }))
    };
};
