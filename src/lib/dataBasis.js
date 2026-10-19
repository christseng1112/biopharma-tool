import { DEFAULT_DATA_BASIS_REFERENCE } from '../data/defaults.js';

/**
 * Records which controlled document the SOP data (components, catalog, diagrams,
 * BOM) was checked against, so that when the SOP is revised it is clear which
 * revision the tool reflects.
 *
 * The basis is stored with a fingerprint of the data at the moment it was
 * recorded. Any later change — in the Database tab, or by hand-editing an
 * exported JSON — makes the current fingerprint differ, and the reports say so
 * instead of continuing to claim the original document as their basis.
 *
 * Shape: { reference: "SOP-000022 v9.0", fingerprint: "1a2b3c4d" } | null
 */

/** Key-sorted serialization: equal data always yields the same string. */
export const canonicalJson = (value) => {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        return `{${Object.keys(value).sort()
            .filter(k => value[k] !== undefined)
            .map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`)
            .join(',')}}`;
    }
    return JSON.stringify(value ?? null);
};

/** FNV-1a 32-bit. Change detection only — not a security measure. */
const fnv1a = (str) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
};

export const sopDataFingerprint = ({ components, catalog, diagrams, bom }) =>
    fnv1a(canonicalJson({ components, catalog, diagrams, bom }));

export const makeDataBasis = (reference, sopData) => ({
    reference: String(reference).trim(),
    fingerprint: sopDataFingerprint(sopData)
});

export const defaultDataBasis = (sopData) => makeDataBasis(DEFAULT_DATA_BASIS_REFERENCE, sopData);

export const NOT_RECORDED_LABEL = '未記錄 (not recorded) — 請於 Database 分頁核對資料後記錄依據文件';

export const describeDataBasis = (basis, currentFingerprint) => {
    if (!basis || !basis.reference) return NOT_RECORDED_LABEL;
    if (basis.fingerprint !== currentFingerprint) {
        return `${basis.reference} — ⚠️ 記錄後資料已修改 (modified since recorded)`;
    }
    return basis.reference;
};
