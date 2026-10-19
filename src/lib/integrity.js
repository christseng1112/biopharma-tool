import { normalizeName } from './normalize.js';

/**
 * Cross-checks the editable data for the defects that otherwise only show up
 * later, as a wrong or incomplete report: a set with no BOM drops out of the
 * picking list, a BOM code with no component prints "Unknown", an item no
 * zone allows is reported unassignable at scheduling time (No.26 sat like
 * that for months), and a zone entry left behind by a rename matches nothing.
 *
 * The shipped defaults are pinned clean by tests; this covers data the user
 * has edited or imported. Names are compared normalized, exactly as the
 * scheduler compares them. Zone checks are skipped when `patterns` is not
 * given (the app passes none until its patterns have loaded).
 */

export const ISSUE_LEVEL = { ERROR: 'error', WARNING: 'warning' };

/** Display order and headings for the categories. */
export const ISSUE_CATEGORIES = [
    ['no-bom', '管組沒有 BOM（不會出現在領料單與裝配工單）'],
    ['unknown-code', 'BOM 料號不存在於 Components（報表顯示 Unknown）'],
    ['no-diagram', '管組沒有示意圖'],
    ['no-zone', '管組沒有任何滅菌 Zone 允許（排程時列為 Unassignable）'],
    ['no-zone-b', 'Group B 器具沒有任何滅菌 Zone 允許'],
    ['orphan', 'Zone 允許清單中的名稱對不到任何品項（多為改名後遺留）'],
    ['rule-item', 'Zone 限制中的品項不在該 Zone 的允許清單內（限制不生效）']
];

/**
 * @param {{components?: object, catalog?: object, diagrams?: object, bom?: object, patterns?: any[], groupB?: string[]}} data
 * @returns {{level: string, category: string, ref: string, message: string}[]}
 */
export const checkDataIntegrity = ({ components = {}, catalog = {}, diagrams = {}, bom = {}, patterns, groupB = [] }) => {
    const issues = [];
    const checkZones = Array.isArray(patterns);
    const add = (level, category, ref, message) => issues.push({ level, category, ref, message });

    const zoneItems = new Set();
    (patterns || []).forEach(p => (p.zones || []).forEach(z => (z.allowed || []).forEach(a => zoneItems.add(normalizeName(a)))));

    // Variants share a normalized name (13 and 132), so a zone problem is
    // reported once per name, listing every SOP No. that carries it.
    const noZone = new Map();
    Object.entries(catalog || {}).forEach(([no, entry]) => {
        const ref = `No. ${no}`;
        const rows = bom?.[no];
        if (!Array.isArray(rows) || rows.length === 0) add(ISSUE_LEVEL.ERROR, 'no-bom', ref, entry?.Name ?? '');
        if (!String(diagrams?.[no] ?? '').trim()) add(ISSUE_LEVEL.WARNING, 'no-diagram', ref, entry?.Name ?? '');
        (Array.isArray(rows) ? rows : []).forEach(row => {
            if (!components?.[row?.Code]) add(ISSUE_LEVEL.ERROR, 'unknown-code', ref, `${row?.Code ?? '(空白)'}`);
        });
        const name = normalizeName(entry?.Name);
        if (checkZones && name && !zoneItems.has(name)) {
            const seen = noZone.get(name) ?? { nos: [], stock: false };
            seen.nos.push(no);
            seen.stock = seen.stock || String(entry?.Stock_Code ?? '').trim() !== '';
            noZone.set(name, seen);
        }
    });
    noZone.forEach(({ nos, stock }, name) => add(
        ISSUE_LEVEL.WARNING, 'no-zone', nos.map(n => `No. ${n}`).join(', '),
        stock ? `${name}（庫存品，勾選 Include Stock 時才需滅菌）` : name
    ));

    if (!checkZones) return issues;

    const groupBNames = new Set((groupB || []).map(normalizeName));
    groupBNames.forEach(name => { if (name && !zoneItems.has(name)) add(ISSUE_LEVEL.WARNING, 'no-zone-b', name, name); });

    const known = new Set([...Object.values(catalog || {}).map(e => normalizeName(e?.Name)), ...groupBNames]);
    (patterns || []).forEach(p => (p.zones || []).forEach(z => {
        const where = `${p.name ?? `Pattern ${p.id}`} / ${z.name}`;
        const allowed = new Set((z.allowed || []).map(normalizeName));
        allowed.forEach(a => { if (!known.has(a)) add(ISSUE_LEVEL.WARNING, 'orphan', where, a); });
        (z.rules || []).forEach(r => (r.items || []).forEach(item => {
            const n = normalizeName(item);
            if (!allowed.has(n)) add(ISSUE_LEVEL.WARNING, 'rule-item', where, n);
        }));
    }));

    return issues;
};
