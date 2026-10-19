import { describe, it, expect } from 'vitest';
import { buildFormNumberIndex, assembledAmounts, cycleTubingSummary } from '../src/lib/forms.js';
import { calculateSchedule } from '../src/lib/scheduler.js';
import { normalizeName, normalizePatterns } from '../src/lib/normalize.js';
import { DEFAULT_CATALOG, DEFAULT_AUTOCLAVE_PATTERNS_DATA } from '../src/data/defaults.js';

const assign = (stage, sopNo, qty, extra = {}) => ({
    Stage: stage, 'SOP No.': sopNo, Name: DEFAULT_CATALOG[sopNo]?.Name ?? `X${sopNo}`, Qty: qty,
    Is_Stock: false, Material_Code: null, ...extra
});

describe('buildFormNumberIndex', () => {
    const index = buildFormNumberIndex(DEFAULT_CATALOG);
    const noOf = (sopNo) => index.get(normalizeName(DEFAULT_CATALOG[sopNo].Name)).no;

    it('folds assembly variants into their base form number', () => {
        expect(noOf(132)).toBe(13);
        expect(noOf(142)).toBe(14);
        expect(noOf(212)).toBe(21);
    });

    it('maps every base number 1–30 to itself', () => {
        for (let n = 1; n <= 30; n++) expect(noOf(n)).toBe(n);
    });

    it('names the base set without its (Type …) suffix', () => {
        expect(index.get(normalizeName(DEFAULT_CATALOG[13].Name)).name).toBe('1/2" C-Flex 45 w/ ReadyMate');
    });

    it('folds a user-added (Type …) variant into its base number too', () => {
        const catalog = { ...DEFAULT_CATALOG, 150: { Name: '3/8” C-Flex Tubing Set (Type B2)', Stock_Code: null } };
        expect(buildFormNumberIndex(catalog).get(normalizeName(catalog[150].Name)).no).toBe(28);
    });
});

describe('assembledAmounts (Attachment 2 Part A)', () => {
    const plan = [
        assign('Production Medium', 13, 2),
        assign('Harvest', 132, 1),
        assign('Harvest', 21, 1),
        assign('Production Medium', 212, 3),
        assign('Harvest', 1, 4)
    ];

    it('sums each form number across stages and variants, in number order', () => {
        const rows = assembledAmounts(plan, DEFAULT_CATALOG);
        expect(rows.map(r => [r.no, r.total])).toEqual([[1, 4], [13, 3], [21, 4]]);
    });

    it('keeps the variant and stage split behind each total', () => {
        const row = assembledAmounts(plan, DEFAULT_CATALOG).find(r => r.no === 21);
        expect(row.variants.map(v => [v.sopNo, v.qty])).toEqual([[21, 1], [212, 3]]);
        expect(row.stages).toEqual(expect.arrayContaining([{ stage: 'Harvest', qty: 1 }, { stage: 'Production Medium', qty: 3 }]));
    });

    it('excludes stock sets — they are picked, not assembled', () => {
        const rows = assembledAmounts([assign('Harvest', 15, 2, { Is_Stock: true, Material_Code: 'B0316' })], DEFAULT_CATALOG);
        expect(rows).toEqual([]);
    });

    it('counts only the selected stages', () => {
        const rows = assembledAmounts(plan, DEFAULT_CATALOG, ['Harvest']);
        expect(rows.map(r => [r.no, r.total])).toEqual([[1, 4], [13, 1], [21, 1]]);
    });

    it('omits numbers whose amount is zero', () => {
        expect(assembledAmounts([assign('Harvest', 1, 0)], DEFAULT_CATALOG)).toEqual([]);
    });

    it('still counts an assignment whose catalog entry was deleted', () => {
        const rows = assembledAmounts([{ Stage: 'H', 'SOP No.': 99, Name: 'Gone Set', Qty: 2, Is_Stock: false }], DEFAULT_CATALOG);
        expect(rows).toEqual([expect.objectContaining({ no: 99, name: 'Gone Set', total: 2 })]);
    });
});

describe('cycleTubingSummary (Attachment 2 Part B)', () => {
    const index = buildFormNumberIndex(DEFAULT_CATALOG);
    const n = (sopNo) => normalizeName(DEFAULT_CATALOG[sopNo].Name);

    it('writes "Number (amount)" separated by slashes, in number order, variants folded', () => {
        const cycle = { loadedEntries: [
            { zone: 'B2', item: n(21), qty: 1 },
            { zone: 'A1', item: n(13), qty: 2 },
            { zone: 'B2', item: n(21), qty: 1 }
        ] };
        const s = cycleTubingSummary(cycle, index);
        expect(s.text).toBe('13 (2) / 21 (2)');
        expect(s.totalSets).toBe(4);
        expect(s.others).toEqual([]);
    });

    it('keeps Group B equipment off the tubing-set line', () => {
        const s = cycleTubingSummary({ loadedEntries: [{ zone: 'B1', item: 'Forceps', qty: 5 }, { zone: 'A1', item: n(1), qty: 1 }] }, index);
        expect(s.text).toBe('1 (1)');
        expect(s.others).toEqual([{ item: 'Forceps', qty: 5 }]);
    });

    it('accounts for every tubing set in a real schedule', () => {
        const patterns = normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA);
        const inventory = [{ item: n(13), qty: 3 }, { item: n(21), qty: 2 }, { item: n(1), qty: 2 }];
        const { schedule } = calculateSchedule(inventory, patterns);
        const sum = schedule.reduce((t, c) => t + cycleTubingSummary(c, index).totalSets, 0);
        expect(sum).toBe(7);
    });
});
