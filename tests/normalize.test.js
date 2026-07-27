import { describe, it, expect } from 'vitest';
import { normalizeName, escapeHtml, normalizePatterns, isPlainObject, reindexByNumber } from '../src/lib/normalize.js';

describe('normalizeName', () => {
    it('returns "" for falsy input', () => {
        expect(normalizeName(undefined)).toBe("");
        expect(normalizeName(null)).toBe("");
        expect(normalizeName("")).toBe("");
    });

    it('folds curly quotes to straight ones', () => {
        expect(normalizeName('a‘b’c')).toBe("a'b'c");
        expect(normalizeName('3/8”x5/8”')).toBe('3/8"x5/8"');
    });

    it('strips a (Type X) suffix', () => {
        // The quote-space rule also applies, hence 1/2"C-Flex rather than 1/2" C-Flex.
        expect(normalizeName('1/2" C-Flex 45 w/ ReadyMate (Type Z)')).toBe('1/2"C-Flex 45 w/ ReadyMate');
        expect(normalizeName('Widget (type a)')).toBe('Widget');
    });

    it('closes the gap after a quote — the v30.6 3/8" Silicone spacing bug', () => {
        expect(normalizeName('3/8” Silicone Tubing Set')).toBe('3/8"Silicone Tubing Set');
    });

    it('trims surrounding whitespace', () => {
        expect(normalizeName('  Forceps  ')).toBe('Forceps');
    });

    it('is idempotent', () => {
        const raw = '  1/2” C-Flex-3/8” Pump Tubing Set (Type B) ';
        expect(normalizeName(normalizeName(raw))).toBe(normalizeName(raw));
    });
});

describe('escapeHtml', () => {
    it('escapes all five HTML-significant characters', () => {
        expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
    });

    it('escapes & first so entities are not double-broken', () => {
        expect(escapeHtml('a&lt;b')).toBe('a&amp;lt;b');
    });

    it('neutralises a script payload', () => {
        expect(escapeHtml('<script>alert(1)</script>')).not.toContain('<script>');
    });

    it('neutralises an attribute-breakout payload', () => {
        expect(escapeHtml('x" onerror="alert(1)')).toBe('x&quot; onerror=&quot;alert(1)');
    });

    it('renders null/undefined as empty string, not "null"', () => {
        expect(escapeHtml(null)).toBe("");
        expect(escapeHtml(undefined)).toBe("");
    });

    it('stringifies numbers', () => {
        expect(escapeHtml(30)).toBe('30');
        expect(escapeHtml(0)).toBe('0');
    });
});

describe('normalizePatterns', () => {
    it('normalizes and dedupes zone allowed lists', () => {
        const out = normalizePatterns([{
            id: 1, zones: [{ name: 'Z', capacity: 2, allowed: ['Widget (Type A)', 'Widget (Type B)', 'Widget'] }]
        }]);
        expect(out[0].zones[0].allowed).toEqual(['Widget']);
    });

    it('normalizes and dedupes rule item lists', () => {
        const out = normalizePatterns([{
            id: 1, zones: [{ name: 'Z', capacity: 6, allowed: ['Scissor'], rules: [{ items: ['Scissor', 'Scissor (Type A)'], max: 2 }] }]
        }]);
        expect(out[0].zones[0].rules[0].items).toEqual(['Scissor']);
        expect(out[0].zones[0].rules[0].max).toBe(2);
    });

    it('leaves rules undefined when the zone has none', () => {
        const out = normalizePatterns([{ id: 1, zones: [{ name: 'Z', capacity: 1, allowed: [] }] }]);
        expect(out[0].zones[0].rules).toBeUndefined();
    });

    it('tolerates missing patterns / zones / allowed', () => {
        expect(normalizePatterns(undefined)).toEqual([]);
        expect(normalizePatterns([{ id: 1 }])[0].zones).toEqual([]);
        expect(normalizePatterns([{ id: 1, zones: [{ name: 'Z' }] }])[0].zones[0].allowed).toEqual([]);
    });

    it('does not mutate its input', () => {
        const input = [{ id: 1, zones: [{ name: 'Z', capacity: 1, allowed: ['Widget (Type A)'] }] }];
        normalizePatterns(input);
        expect(input[0].zones[0].allowed).toEqual(['Widget (Type A)']);
    });
});

describe('isPlainObject', () => {
    it('accepts objects only', () => {
        expect(isPlainObject({})).toBe(true);
        expect(isPlainObject([])).toBe(false);
        expect(isPlainObject(null)).toBe(false);
        expect(isPlainObject("x")).toBe(false);
        expect(isPlainObject(undefined)).toBe(false);
    });
});

describe('reindexByNumber', () => {
    it('converts string keys back to numbers', () => {
        expect(reindexByNumber({ "1": 'a', "12": 'b' })).toEqual({ 1: 'a', 12: 'b' });
    });

    it('tolerates null/undefined', () => {
        expect(reindexByNumber(undefined)).toEqual({});
    });
});
