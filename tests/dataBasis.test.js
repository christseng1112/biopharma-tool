import { describe, it, expect } from 'vitest';
import {
    canonicalJson, sopDataFingerprint, makeDataBasis, defaultDataBasis,
    describeDataBasis, NOT_RECORDED_LABEL, patternsFingerprint, defaultPatternBasis
} from '../src/lib/dataBasis.js';
import { reindexByNumber, normalizePatterns } from '../src/lib/normalize.js';
import {
    DEFAULT_COMPONENTS, DEFAULT_CATALOG, DEFAULT_DIAGRAMS, DEFAULT_BOM, DEFAULT_DATA_BASIS_REFERENCE,
    DEFAULT_AUTOCLAVE_PATTERNS_DATA, DEFAULT_PATTERN_BASIS_REFERENCE
} from '../src/data/defaults.js';

const defaults = () => ({
    components: DEFAULT_COMPONENTS, catalog: DEFAULT_CATALOG, diagrams: DEFAULT_DIAGRAMS, bom: DEFAULT_BOM
});

describe('canonicalJson', () => {
    it('does not depend on key order', () => {
        expect(canonicalJson({ b: 1, a: { d: 2, c: 3 } })).toBe(canonicalJson({ a: { c: 3, d: 2 }, b: 1 }));
    });

    it('keeps array order', () => {
        expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
    });

    it('distinguishes null from a missing key', () => {
        expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
    });
});

describe('sopDataFingerprint', () => {
    it('is an 8-digit hex string', () => {
        expect(sopDataFingerprint(defaults())).toMatch(/^[0-9a-f]{8}$/);
    });

    // Autosave and export go through JSON, which turns numeric SOP keys into
    // strings; the app then reindexes them. Neither may look like an edit.
    it('survives a JSON round trip and reindexing', () => {
        const round = JSON.parse(JSON.stringify(defaults()));
        const restored = {
            components: round.components,
            catalog: reindexByNumber(round.catalog),
            diagrams: reindexByNumber(round.diagrams),
            bom: reindexByNumber(round.bom)
        };
        expect(sopDataFingerprint(restored)).toBe(sopDataFingerprint(defaults()));
    });

    it('changes when a single BOM length changes', () => {
        const bom = { ...DEFAULT_BOM, 1: DEFAULT_BOM[1].map((p, i) => (i === 0 ? { ...p, Len: p.Len + 1 } : p)) };
        expect(sopDataFingerprint({ ...defaults(), bom })).not.toBe(sopDataFingerprint(defaults()));
    });

    it('changes when a catalog stock code changes', () => {
        const catalog = { ...DEFAULT_CATALOG, 1: { ...DEFAULT_CATALOG[1], Stock_Code: 'B9999' } };
        expect(sopDataFingerprint({ ...defaults(), catalog })).not.toBe(sopDataFingerprint(defaults()));
    });
});

describe('describeDataBasis', () => {
    const fp = sopDataFingerprint(defaults());

    it('names the document when the data is unchanged', () => {
        expect(describeDataBasis(defaultDataBasis(defaults()), fp)).toBe(DEFAULT_DATA_BASIS_REFERENCE);
    });

    it('flags data modified after the basis was recorded', () => {
        const label = describeDataBasis(defaultDataBasis(defaults()), '00000000');
        expect(label).toContain(DEFAULT_DATA_BASIS_REFERENCE);
        expect(label).toContain('modified since recorded');
    });

    it('says not recorded when there is no basis', () => {
        expect(describeDataBasis(null, fp)).toBe(NOT_RECORDED_LABEL);
        expect(describeDataBasis(undefined, fp)).toBe(NOT_RECORDED_LABEL);
    });

    it('trims the recorded reference', () => {
        expect(makeDataBasis('  SOP-000022 v10.0 ', defaults()).reference).toBe('SOP-000022 v10.0');
    });
});

describe('patternsFingerprint', () => {
    // The app holds normalized patterns, saves them through JSON, and
    // normalizes again on load. None of that may read as an edit.
    it('is the same for raw defaults, normalized state and a JSON round trip', () => {
        const normalized = normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA);
        const round = JSON.parse(JSON.stringify(normalized));
        const fp = patternsFingerprint(DEFAULT_AUTOCLAVE_PATTERNS_DATA);
        expect(patternsFingerprint(normalized)).toBe(fp);
        expect(patternsFingerprint(round)).toBe(fp);
        expect(patternsFingerprint(normalizePatterns(round))).toBe(fp);
    });

    it('changes when a zone capacity changes', () => {
        const edited = normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA);
        edited[0].zones[0] = { ...edited[0].zones[0], capacity: edited[0].zones[0].capacity + 1 };
        expect(patternsFingerprint(edited)).not.toBe(patternsFingerprint(DEFAULT_AUTOCLAVE_PATTERNS_DATA));
    });

    it('defaults to SOP-000077 v11.0 for the shipped patterns', () => {
        const basis = defaultPatternBasis();
        expect(basis.reference).toBe(DEFAULT_PATTERN_BASIS_REFERENCE);
        expect(describeDataBasis(basis, patternsFingerprint(normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA)))).toBe('SOP-000077 v11.0');
    });
});
