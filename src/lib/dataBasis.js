import { DEFAULT_DATA_BASIS_REFERENCE, DEFAULT_PATTERN_BASIS_REFERENCE, DEFAULT_AUTOCLAVE_PATTERNS_DATA } from '../data/defaults.js';
import { normalizePatterns } from './normalize.js';

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
 *
 * The autoclave loading patterns come from a different controlled document
 * (SOP-000077 Attachment 1) and are edited in a different tab, so they carry a
 * basis of their own with the same shape (`pattern_basis` in the config).
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

/**
 * Patterns are normalized on every load path, so the fingerprint is taken over
 * the normalized form: a raw default and its normalized state must agree.
 */
export const patternsFingerprint = (patterns) => fnv1a(canonicalJson(normalizePatterns(patterns)));

export const makePatternBasis = (reference, patterns) => ({
    reference: String(reference).trim(),
    fingerprint: patternsFingerprint(patterns)
});

export const defaultPatternBasis = () => makePatternBasis(DEFAULT_PATTERN_BASIS_REFERENCE, DEFAULT_AUTOCLAVE_PATTERNS_DATA);

export const NOT_RECORDED_LABEL = '未記錄 (not recorded) — 請於 Database 分頁核對資料後記錄依據文件';

export const describeDataBasis = (basis, currentFingerprint) => {
    if (!basis || !basis.reference) return NOT_RECORDED_LABEL;
    if (basis.fingerprint !== currentFingerprint) {
        return `${basis.reference} — ⚠️ 記錄後資料已修改 (modified since recorded)`;
    }
    return basis.reference;
};
