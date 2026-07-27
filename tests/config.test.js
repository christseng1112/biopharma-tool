import { describe, it, expect } from 'vitest';
import { validateConfig, APP_VERSION } from '../src/lib/config.js';
import { normalizePatterns, reindexByNumber, normalizeName } from '../src/lib/normalize.js';
import { calculateSchedule } from '../src/lib/scheduler.js';
import {
    DEFAULT_COMPONENTS, DEFAULT_CATALOG, DEFAULT_DIAGRAMS, DEFAULT_BOM,
    DEFAULT_STAGES, DEFAULT_AUTOCLAVE_GROUP_B, DEFAULT_AUTOCLAVE_PATTERNS_DATA
} from '../src/data/defaults.js';

const defaultPayload = () => ({
    version: APP_VERSION,
    assignments: [],
    stage_list: DEFAULT_STAGES,
    database: {
        components: DEFAULT_COMPONENTS,
        catalog: DEFAULT_CATALOG,
        diagrams: DEFAULT_DIAGRAMS,
        bom: DEFAULT_BOM,
        autoclave: {
            patterns: normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA),
            inventory_group_b: DEFAULT_AUTOCLAVE_GROUP_B,
            manual_cart: []
        }
    }
});

describe('validateConfig — accepts', () => {
    it('the default payload', () => {
        const r = validateConfig(defaultPayload());
        expect(r.errors).toEqual([]);
        expect(r.ok).toBe(true);
    });

    it('a payload with only some sections present', () => {
        expect(validateConfig({ assignments: [] }).ok).toBe(true);
        expect(validateConfig({}).ok).toBe(true);
    });
});

describe('validateConfig — rejects', () => {
    const rejects = (data, match) => {
        const r = validateConfig(data);
        expect(r.ok).toBe(false);
        expect(r.value).toBeNull();
        expect(r.errors.join(' ')).toMatch(match);
    };

    it('a non-object at the top level', () => {
        rejects(null, /最外層/);
        rejects([], /最外層/);
        rejects("{}", /最外層/);
    });

    it('assignments that is not an array', () => rejects({ assignments: {} }, /assignments/));
    it('stage_list that is not an array', () => rejects({ stage_list: 'a,b' }, /stage_list/));
    it('database that is not an object', () => rejects({ database: [] }, /database/));
    it('components as an array', () => rejects({ database: { components: [] } }, /components/));
    it('catalog as an array', () => rejects({ database: { catalog: [] } }, /catalog/));
    it('a bom entry that is not an array', () => rejects({ database: { bom: { 1: 'nope' } } }, /bom\["1"\]/));
    it('patterns that is not an array', () => rejects({ database: { autoclave: { patterns: {} } } }, /patterns/));
    it('a pattern with no zones', () => rejects({ database: { autoclave: { patterns: [{ id: 1 }] } } }, /zones/));
    it('a zone with no allowed list', () => rejects({ database: { autoclave: { patterns: [{ id: 1, zones: [{ name: 'Z' }] }] } } }, /allowed/));
    it('manual_cart that is not an array', () => rejects({ database: { autoclave: { manual_cart: {} } } }, /manual_cart/));

    it('reports every problem at once rather than stopping at the first', () => {
        const r = validateConfig({ assignments: {}, stage_list: {}, database: { components: [] } });
        expect(r.errors.length).toBe(3);
    });
});

describe('export → import round trip', () => {
    it('survives JSON serialization unchanged', () => {
        const payload = defaultPayload();
        const round = JSON.parse(JSON.stringify(payload));
        expect(validateConfig(round).ok).toBe(true);
        expect(round.database.components).toEqual(payload.database.components);
        expect(round.database.autoclave.patterns).toEqual(payload.database.autoclave.patterns);
        expect(round.stage_list).toEqual(payload.stage_list);
    });

    it('recovers numeric SOP keys that JSON turned into strings', () => {
        const round = JSON.parse(JSON.stringify(defaultPayload()));
        expect(Object.keys(round.database.bom).every(k => typeof k === 'string')).toBe(true);
        const restored = reindexByNumber(round.database.bom);
        expect(restored[1]).toEqual(DEFAULT_BOM[1]);
        expect(Object.keys(restored).length).toBe(Object.keys(DEFAULT_BOM).length);
    });

    it('produces the same schedule before and after a round trip', () => {
        const payload = defaultPayload();
        const inventory = [...new Set(Object.values(DEFAULT_CATALOG).map(c => normalizeName(c.Name)))]
            .map(item => ({ item, qty: 1 }));

        const before = calculateSchedule(inventory, payload.database.autoclave.patterns);
        const round = JSON.parse(JSON.stringify(payload));
        const after = calculateSchedule(inventory, normalizePatterns(round.database.autoclave.patterns));

        expect(after.schedule.length).toBe(before.schedule.length);
        expect(after.unassignable).toEqual(before.unassignable);
        expect(after.unscheduled).toEqual(before.unscheduled);
    });
});

describe('importing an un-normalized config', () => {
    it('matches zones only after normalization', () => {
        // A hand-edited or pre-v30.6 config: curly quotes, a (Type X) suffix, a stray space.
        const raw = [{
            id: 1, name: 'P', program: 'P01',
            zones: [{ name: 'Z', capacity: 2, allowed: ['3/8” Silicone Tubing Set (Type A)'] }]
        }];
        const item = normalizeName('3/8” Silicone Tubing Set');

        const withoutNormalizing = calculateSchedule([{ item, qty: 2 }], raw);
        expect(withoutNormalizing.unassignable).toHaveLength(1);

        const withNormalizing = calculateSchedule([{ item, qty: 2 }], normalizePatterns(raw));
        expect(withNormalizing.unassignable).toEqual([]);
        expect(withNormalizing.schedule).toHaveLength(1);
    });
});

describe('validateConfig — entry shapes', () => {
    const rejects = (data, match) => {
        const r = validateConfig(data);
        expect(r.ok).toBe(false);
        expect(r.errors.join(' ')).toMatch(match);
    };

    // A null entry passes an "is the container an object" check and then throws
    // during render, which is what the ErrorBoundary exists to catch. Catching
    // it at import time is better than catching it after the screen goes blank.
    it('a null catalog entry', () => rejects({ database: { catalog: { 1: null } } }, /catalog\["1"\]/));
    it('a string catalog entry', () => rejects({ database: { catalog: { 1: 'Set One' } } }, /catalog\["1"\]/));
    it('a null component entry', () => rejects({ database: { components: { B1: null } } }, /components\["B1"\]/));
    it('a non-string diagram', () => rejects({ database: { diagrams: { 1: { a: 1 } } } }, /diagrams\["1"\]/));
    it('a non-object bom part', () => rejects({ database: { bom: { 1: ['B1'] } } }, /bom\["1"\]\[0\]/));

    it('accepts a null diagram and a null Stock_Code', () => {
        const r = validateConfig({
            database: { diagrams: { 1: null }, catalog: { 1: { Name: 'X', Stock_Code: null } } }
        });
        expect(r.errors).toEqual([]);
    });

    it('still accepts the default payload after the extra checks', () => {
        expect(validateConfig(defaultPayload()).errors).toEqual([]);
    });
});
