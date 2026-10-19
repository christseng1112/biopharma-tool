import { describe, it, expect } from 'vitest';
import { checkDataIntegrity } from '../src/lib/integrity.js';
import { normalizePatterns } from '../src/lib/normalize.js';
import {
    DEFAULT_COMPONENTS, DEFAULT_CATALOG, DEFAULT_DIAGRAMS, DEFAULT_BOM,
    DEFAULT_AUTOCLAVE_PATTERNS_DATA, DEFAULT_AUTOCLAVE_GROUP_B
} from '../src/data/defaults.js';

const defaults = () => ({
    components: DEFAULT_COMPONENTS, catalog: DEFAULT_CATALOG, diagrams: DEFAULT_DIAGRAMS, bom: DEFAULT_BOM,
    patterns: normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA), groupB: DEFAULT_AUTOCLAVE_GROUP_B
});
const categories = (issues) => issues.map(i => i.category);
const P = (zones) => [{ id: 1, name: 'P1', zones }];

describe('checkDataIntegrity', () => {
    it('finds nothing wrong with the shipped data', () => {
        expect(checkDataIntegrity(defaults())).toEqual([]);
    });

    it('flags a set with no BOM, or an empty one, as an error', () => {
        const issues = checkDataIntegrity({ ...defaults(), bom: { ...DEFAULT_BOM, 2: [] } });
        expect(issues).toEqual([expect.objectContaining({ level: 'error', category: 'no-bom', ref: 'No. 2' })]);
        const { 2: _gone, ...without } = DEFAULT_BOM;
        expect(categories(checkDataIntegrity({ ...defaults(), bom: without }))).toEqual(['no-bom']);
    });

    it('flags a BOM code missing from Components as an error', () => {
        const issues = checkDataIntegrity({ ...defaults(), bom: { ...DEFAULT_BOM, 2: [{ Code: 'B9999', Len: 10, Count: 1 }] } });
        expect(issues).toEqual([expect.objectContaining({ level: 'error', category: 'unknown-code', ref: 'No. 2', message: 'B9999' })]);
    });

    it('warns about a set with no diagram', () => {
        expect(categories(checkDataIntegrity({ ...defaults(), diagrams: { ...DEFAULT_DIAGRAMS, 2: '  ' } }))).toEqual(['no-diagram']);
    });

    // The No.26 defect: a catalog item that no zone of any pattern allows.
    it('warns once per name about a set no zone allows, listing every SOP No.', () => {
        const catalog = { ...DEFAULT_CATALOG, 300: { Name: 'New Set', Stock_Code: null }, 301: { Name: 'New Set (Type B)', Stock_Code: 'B1' } };
        const bom = { ...DEFAULT_BOM, 300: [{ Code: 'B0043', Len: 10, Count: 1 }], 301: [{ Code: 'B0043', Len: 10, Count: 1 }] };
        const diagrams = { ...DEFAULT_DIAGRAMS, 300: 'x', 301: 'x' };
        const issues = checkDataIntegrity({ ...defaults(), catalog, bom, diagrams });
        expect(issues).toEqual([expect.objectContaining({ level: 'warning', category: 'no-zone', ref: 'No. 300, No. 301' })]);
        expect(issues[0].message).toContain('庫存品');
    });

    it('warns about Group B equipment no zone allows', () => {
        const issues = checkDataIntegrity({ ...defaults(), groupB: [...DEFAULT_AUTOCLAVE_GROUP_B, 'New Clamp'] });
        expect(issues).toEqual([expect.objectContaining({ category: 'no-zone-b', ref: 'New Clamp' })]);
    });

    it('warns about a zone entry that matches no item (left behind by a rename)', () => {
        const patterns = [...defaults().patterns, ...P([{ name: 'Z', capacity: 1, allowed: ['Old Name'] }])];
        expect(checkDataIntegrity({ ...defaults(), patterns })).toEqual([
            expect.objectContaining({ category: 'orphan', ref: 'P1 / Z', message: 'Old Name' })
        ]);
    });

    it('warns about a zone rule naming an item the zone does not allow', () => {
        const patterns = [...defaults().patterns, ...P([{ name: 'Z', capacity: 2, allowed: ['Forceps'], rules: [{ items: ['Stainless scissor'], max: 1 }] }])];
        expect(categories(checkDataIntegrity({ ...defaults(), patterns }))).toEqual(['rule-item']);
    });

    it('skips the zone checks when no patterns are given', () => {
        const { patterns: _p, ...rest } = defaults();
        expect(checkDataIntegrity({ ...rest, groupB: ['Anything'] })).toEqual([]);
    });

    it('compares names the way the scheduler does (normalized)', () => {
        const patterns = defaults().patterns.map(p => ({ ...p, zones: p.zones.map(z => ({ ...z, allowed: z.allowed.map(a => a.replace(/"/g, '”')) })) }));
        expect(checkDataIntegrity({ ...defaults(), patterns })).toEqual([]);
    });
});
