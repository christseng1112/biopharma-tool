import { describe, it, expect } from 'vitest';
import { simulateLoad, runGreedySimulation, calculateSchedule, MAX_CYCLES, QUALITY } from '../src/lib/scheduler.js';
import { normalizePatterns, normalizeName } from '../src/lib/normalize.js';
import {
    DEFAULT_AUTOCLAVE_PATTERNS_DATA, DEFAULT_CATALOG, DEFAULT_AUTOCLAVE_GROUP_B,
    DEFAULT_BOM, DEFAULT_DIAGRAMS, DEFAULT_COMPONENTS
} from '../src/data/defaults.js';

const pattern = (zones, id = 1) => ({ id, name: `P${id}`, program: 'P01', zones });
const total = (items) => items.reduce((s, i) => s + i.qty, 0);
const loadedCount = (schedule) =>
    schedule.reduce((s, c) => s + c.loadedItems.reduce((n, l) => n + parseInt(l.match(/\] (\d+)x /)[1], 10), 0), 0);

// A load where greedy's first pick (the pattern that loads the most right
// now) leads to 3 cycles while 2 suffice. The lower bound is 2, so greedy's
// answer cannot be proven and only the search finds the shorter schedule.
// Found by randomized search over small instances; kept verbatim.
const greedyTrap = {
    patterns: [
        pattern([{ name: 'Z1', capacity: 4, allowed: ['C', 'D'] }], 1),
        pattern([{ name: 'Z1', capacity: 3, allowed: ['A'] }, { name: 'Z2', capacity: 3, allowed: ['B'] }], 2),
        pattern([{ name: 'Z0', capacity: 4, allowed: ['B', 'D'] }, { name: 'Z1', capacity: 5, allowed: ['C'] }], 3),
        pattern([{ name: 'Z0', capacity: 5, allowed: ['A', 'B', 'C'] }], 4)
    ],
    inventory: [{ item: 'A', qty: 2 }, { item: 'B', qty: 4 }, { item: 'C', qty: 4 }, { item: 'D', qty: 3 }]
};

describe('simulateLoad', () => {
    it('fills a zone up to its capacity', () => {
        const r = simulateLoad([{ item: 'W', qty: 10 }], pattern([{ name: 'Z', capacity: 4, allowed: ['W'] }]));
        expect(r.loadedCount).toBe(4);
        expect(r.remainingInv[0].qty).toBe(6);
    });

    it('ignores items no zone allows', () => {
        const r = simulateLoad([{ item: 'X', qty: 3 }], pattern([{ name: 'Z', capacity: 4, allowed: ['W'] }]));
        expect(r.loadedCount).toBe(0);
    });

    it('spreads across multiple zones', () => {
        const r = simulateLoad([{ item: 'W', qty: 10 }], pattern([
            { name: 'Z1', capacity: 3, allowed: ['W'] },
            { name: 'Z2', capacity: 2, allowed: ['W'] }
        ]));
        expect(r.loadedCount).toBe(5);
    });

    it('does not mutate the inventory it was given', () => {
        const inv = [{ item: 'W', qty: 10 }];
        simulateLoad(inv, pattern([{ name: 'Z', capacity: 4, allowed: ['W'] }]));
        expect(inv[0].qty).toBe(10);
    });

    describe('zone rules', () => {
        it('caps a subset below the zone capacity', () => {
            // Zone holds 6, but at most 2 may be scissors.
            const r = simulateLoad(
                [{ item: 'Scissor', qty: 6 }],
                pattern([{ name: 'Z', capacity: 6, allowed: ['Scissor'], rules: [{ items: ['Scissor'], max: 2 }] }])
            );
            expect(r.loadedCount).toBe(2);
            expect(r.remainingInv[0].qty).toBe(4);
        });

        it('lets unrestricted items use the remaining capacity', () => {
            const r = simulateLoad(
                [{ item: 'Scissor', qty: 6 }, { item: 'Forceps', qty: 6 }],
                pattern([{ name: 'Z', capacity: 6, allowed: ['Scissor', 'Forceps'], rules: [{ items: ['Scissor'], max: 2 }] }])
            );
            expect(r.loadedCount).toBe(6);
            expect(r.loadPlan.join('|')).toMatch(/2x Scissor/);
            expect(r.loadPlan.join('|')).toMatch(/4x Forceps/);
        });

        it('applies a shared cap across every item in the rule', () => {
            const r = simulateLoad(
                [{ item: 'Scissor', qty: 3 }, { item: 'Clamp', qty: 3 }],
                pattern([{ name: 'Z', capacity: 6, allowed: ['Scissor', 'Clamp'], rules: [{ items: ['Scissor', 'Clamp'], max: 4 }] }])
            );
            expect(r.loadedCount).toBe(4);
        });

        it('a max of 0 blocks the item entirely', () => {
            const r = simulateLoad(
                [{ item: 'Scissor', qty: 3 }],
                pattern([{ name: 'Z', capacity: 6, allowed: ['Scissor'], rules: [{ items: ['Scissor'], max: 0 }] }])
            );
            expect(r.loadedCount).toBe(0);
        });
    });
});

describe('runGreedySimulation', () => {
    it('reports leftover inventory rather than dropping it', () => {
        // One item per cycle, more items than MAX_CYCLES allows.
        const { schedule, remaining } = runGreedySimulation(
            [{ item: 'W', qty: MAX_CYCLES + 25 }],
            [pattern([{ name: 'Z', capacity: 1, allowed: ['W'] }])]
        );
        expect(schedule).toHaveLength(MAX_CYCLES);
        expect(total(remaining)).toBe(25);
        expect(loadedCount(schedule) + total(remaining)).toBe(MAX_CYCLES + 25);
    });

    it('reports leftovers when no pattern can load anything more', () => {
        const { schedule, remaining } = runGreedySimulation(
            [{ item: 'W', qty: 5 }],
            [pattern([{ name: 'Z', capacity: 3, allowed: ['W'], rules: [{ items: ['W'], max: 0 }] }])]
        );
        expect(schedule).toHaveLength(0);
        expect(total(remaining)).toBe(5);
    });

    it('leaves nothing behind when everything fits', () => {
        const { schedule, remaining } = runGreedySimulation(
            [{ item: 'W', qty: 7 }],
            [pattern([{ name: 'Z', capacity: 3, allowed: ['W'] }])]
        );
        expect(remaining).toEqual([]);
        expect(loadedCount(schedule)).toBe(7);
    });
});

describe('calculateSchedule', () => {
    it('accounts for every input item across the three buckets', () => {
        const patterns = [pattern([{ name: 'Z', capacity: 2, allowed: ['W'] }])];
        const inventory = [{ item: 'W', qty: 5 }, { item: 'Unknown', qty: 3 }];
        const r = calculateSchedule(inventory, patterns);
        expect(loadedCount(r.schedule) + total(r.unassignable) + total(r.unscheduled)).toBe(8);
    });

    it('puts items no zone allows into unassignable, not unscheduled', () => {
        const r = calculateSchedule([{ item: 'Gadget', qty: 2 }], [pattern([{ name: 'Z', capacity: 3, allowed: ['W'] }])]);
        expect(r.unassignable).toEqual([{ item: 'Gadget', qty: 2 }]);
        expect(r.unscheduled).toEqual([]);
        expect(r.schedule).toEqual([]);
        expect(r.quality).toBe(QUALITY.INCOMPLETE);
    });

    it('puts items that exceed the cycle ceiling into unscheduled, not unassignable', () => {
        const r = calculateSchedule([{ item: 'W', qty: MAX_CYCLES + 25 }], [pattern([{ name: 'Z', capacity: 1, allowed: ['W'] }])]);
        expect(r.unassignable).toEqual([]);
        expect(total(r.unscheduled)).toBe(25);
        expect(r.schedule).toHaveLength(MAX_CYCLES);
        expect(r.quality).toBe(QUALITY.INCOMPLETE);
    });

    it('returns empty buckets for empty input', () => {
        expect(calculateSchedule([], [pattern([{ name: 'Z', capacity: 1, allowed: ['W'] }])]))
            .toEqual({ schedule: [], unassignable: [], unscheduled: [], quality: QUALITY.OPTIMAL });
    });

    it('numbers cycles from 1', () => {
        const r = calculateSchedule([{ item: 'W', qty: 5 }], [pattern([{ name: 'Z', capacity: 2, allowed: ['W'] }])]);
        expect(r.schedule.map(c => c.cycleNumber)).toEqual([1, 2, 3]);
    });

    it('carries rule overflow into further cycles instead of dropping it', () => {
        const r = calculateSchedule(
            [{ item: 'Scissor', qty: 5 }],
            [pattern([{ name: 'Z', capacity: 6, allowed: ['Scissor'], rules: [{ items: ['Scissor'], max: 2 }] }])]
        );
        expect(r.unscheduled).toEqual([]);
        expect(r.schedule).toHaveLength(3);
        expect(loadedCount(r.schedule)).toBe(5);
    });

    it('prefers the pattern that packs the most per cycle', () => {
        const patterns = [
            pattern([{ name: 'Small', capacity: 1, allowed: ['W'] }], 1),
            pattern([{ name: 'Big', capacity: 4, allowed: ['W'] }], 2)
        ];
        const r = calculateSchedule([{ item: 'W', qty: 8 }], patterns);
        expect(r.schedule).toHaveLength(2);
        expect(r.schedule.every(c => c.pattern.id === 2)).toBe(true);
    });

    it('backtracks to a shorter schedule than the greedy first pick', () => {
        // The previous fixture here never actually needed backtracking: with
        // the deterministic candidate order greedy already found 2 cycles.
        const greedyOnly = calculateSchedule(greedyTrap.inventory, greedyTrap.patterns, { maxIterations: 0 });
        expect(greedyOnly.schedule).toHaveLength(3);
        const r = calculateSchedule(greedyTrap.inventory, greedyTrap.patterns);
        expect(r.schedule).toHaveLength(2);
        expect(r.unscheduled).toEqual([]);
        expect(loadedCount(r.schedule)).toBe(13);
    });

    it('does not mutate the inventory it was given', () => {
        const inv = [{ item: 'W', qty: 5 }];
        calculateSchedule(inv, [pattern([{ name: 'Z', capacity: 2, allowed: ['W'] }])]);
        expect(inv).toEqual([{ item: 'W', qty: 5 }]);
    });
});

describe('default dataset', () => {
    const patterns = normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA);

    it('normalizes without error', () => {
        expect(patterns).toHaveLength(11);
        expect(patterns.every(p => Array.isArray(p.zones) && p.zones.length > 0)).toBe(true);
    });

    it('schedules one of every catalog item without leaving anything unscheduled', () => {
        const inventory = [...new Set(Object.values(DEFAULT_CATALOG).map(c => normalizeName(c.Name)))]
            .map(item => ({ item, qty: 1 }));
        const r = calculateSchedule(inventory, patterns);
        expect(r.unscheduled).toEqual([]);
        expect(loadedCount(r.schedule) + total(r.unassignable)).toBe(inventory.length);
    });

    it('has a zone for every catalog item', () => {
        // No.26 used to be the one exception: the shipped patterns carried No.19
        // where SOP-000077 v10.0+ puts No.26. Pinned so a regression shows.
        const inventory = [...new Set(Object.values(DEFAULT_CATALOG).map(c => normalizeName(c.Name)))]
            .map(item => ({ item, qty: 1 }));
        const { unassignable } = calculateSchedule(inventory, patterns);
        expect(unassignable).toEqual([]);
    });

    // Every catalog entry needs a BOM and a diagram or it drops out of the
    // assembly guide; every BOM code needs a component record or the picking
    // list prints "Unknown". Guards transcription of SOP-000022 revisions.
    it('gives every catalog entry a non-empty BOM and a diagram', () => {
        Object.keys(DEFAULT_CATALOG).forEach(k => {
            expect(DEFAULT_BOM[k], `BOM for No. ${k}`).toBeDefined();
            expect(DEFAULT_BOM[k].length, `BOM rows for No. ${k}`).toBeGreaterThan(0);
            expect(DEFAULT_DIAGRAMS[k], `diagram for No. ${k}`).toBeTruthy();
        });
    });

    it('uses only component codes that exist', () => {
        Object.entries(DEFAULT_BOM).forEach(([k, rows]) => {
            rows.forEach(r => expect(DEFAULT_COMPONENTS[r.Code], `No. ${k} code ${r.Code}`).toBeDefined());
        });
    });

    it('schedules the No.212 variant in the same zones as No.21 (SOP-000022 No.21, second assembly)', () => {
        expect(normalizeName(DEFAULT_CATALOG[212].Name)).toBe(normalizeName(DEFAULT_CATALOG[21].Name));
        expect(DEFAULT_BOM[212]).toEqual([{ Code: 'B0069', Len: 200, Count: 1 }]);
        const r = calculateSchedule([{ item: normalizeName(DEFAULT_CATALOG[212].Name), qty: 1 }], patterns);
        expect(r.unassignable).toEqual([]);
        expect(r.unscheduled).toEqual([]);
    });

    it('schedules one of every Group B item without leaving anything unscheduled', () => {
        const inventory = [...new Set(DEFAULT_AUTOCLAVE_GROUP_B.map(normalizeName))].map(item => ({ item, qty: 1 }));
        const r = calculateSchedule(inventory, patterns);
        expect(r.unscheduled).toEqual([]);
    });
});

describe('structured load entries', () => {
    const entriesMatchStrings = (cycle) => {
        expect(cycle.loadedEntries.map(e => `[${e.zone}] ${e.qty}x ${e.item}`)).toEqual(cycle.loadedItems);
    };

    it('mirror the display strings on the greedy path', () => {
        // A zero search budget leaves the greedy schedule standing.
        const r = calculateSchedule(greedyTrap.inventory, greedyTrap.patterns, { maxIterations: 0 });
        expect(r.quality).toBe(QUALITY.HEURISTIC);
        r.schedule.forEach(entriesMatchStrings);
    });

    it('mirror the display strings on the backtracking path', () => {
        const r = calculateSchedule(
            [{ item: 'W', qty: 3 }, { item: 'V', qty: 2 }],
            [pattern([{ name: 'Z', capacity: 2, allowed: ['W', 'V'] }]), pattern([{ name: 'Y', capacity: 3, allowed: ['W'] }], 2)]
        );
        expect(r.quality).toBe(QUALITY.OPTIMAL);
        r.schedule.forEach(entriesMatchStrings);
    });
});

describe('determinism', () => {
    // The same set of items must produce the same schedule regardless of the
    // order the operator happened to add them in.
    const patterns = [
        pattern([{ name: 'Z1', capacity: 3, allowed: ['A', 'B', 'C'] }, { name: 'Z2', capacity: 2, allowed: ['B', 'C'] }], 1),
        pattern([{ name: 'Z', capacity: 4, allowed: ['A', 'B'] }], 2)
    ];
    const items = [{ item: 'A', qty: 4 }, { item: 'B', qty: 7 }, { item: 'C', qty: 3 }];

    const permutations = (xs) => xs.length <= 1 ? [xs]
        : xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map(p => [x, ...p]));

    it('produces an identical schedule for every input ordering', () => {
        const results = permutations(items).map(inv => calculateSchedule(inv, patterns));
        const first = JSON.stringify(results[0]);
        results.forEach(r => expect(JSON.stringify(r)).toBe(first));
    });

    it('orders unrestricted zone candidates by quantity, then by name', () => {
        const r = simulateLoad(
            [{ item: 'Zebra', qty: 1 }, { item: 'Apple', qty: 5 }, { item: 'Mango', qty: 1 }],
            pattern([{ name: 'Z', capacity: 6, allowed: ['Apple', 'Mango', 'Zebra'] }])
        );
        // Apple (5) first, then Mango and Zebra alphabetically.
        expect(r.loadPlan).toEqual(['[Z] 5x Apple', '[Z] 1x Mango']);
    });

    it('offers the zone to rule-capped items before unrestricted ones', () => {
        const r = simulateLoad(
            [{ item: 'Forceps', qty: 6 }, { item: 'Scissor', qty: 6 }],
            pattern([{ name: 'Z', capacity: 6, allowed: ['Forceps', 'Scissor'], rules: [{ items: ['Scissor'], max: 2 }] }])
        );
        expect(r.loadPlan).toEqual(['[Z] 2x Scissor', '[Z] 4x Forceps']);
    });

    it('constrained-first packing needs fewer cycles than unrestricted-first', () => {
        // Filling the zone with forceps first would strand the capped scissors
        // into a fourth cycle.
        const r = calculateSchedule(
            [{ item: 'Forceps', qty: 6 }, { item: 'Scissor', qty: 6 }],
            [pattern([{ name: 'Z', capacity: 6, allowed: ['Forceps', 'Scissor'], rules: [{ items: ['Scissor'], max: 2 }] }])]
        );
        expect(r.schedule).toHaveLength(3);
        expect(r.unscheduled).toEqual([]);
    });
});

describe('result quality', () => {
    it('reports optimal when the exhaustive search completed', () => {
        const r = calculateSchedule([{ item: 'W', qty: 5 }], [pattern([{ name: 'Z', capacity: 2, allowed: ['W'] }])]);
        expect(r.quality).toBe(QUALITY.OPTIMAL);
    });

    it('reports heuristic when the search runs out of budget', () => {
        const r = calculateSchedule(greedyTrap.inventory, greedyTrap.patterns, { maxIterations: 0 });
        expect(r.quality).toBe(QUALITY.HEURISTIC);
        expect(r.unscheduled).toEqual([]);
        expect(r.schedule).toHaveLength(3);   // greedy's answer; 2 exists
    });

    it('proves a greedy schedule optimal when it meets the lower bound, without searching', () => {
        // 60 of W, at most 5 per cycle: 12 cycles is the floor, and greedy finds 12.
        const r = calculateSchedule([{ item: 'W', qty: 60 }], [pattern([{ name: 'Z', capacity: 5, allowed: ['W'] }])], { maxIterations: 0 });
        expect(r.quality).toBe(QUALITY.OPTIMAL);
        expect(r.schedule).toHaveLength(12);
    });

    it('reports incomplete whenever anything could not be placed', () => {
        const r = calculateSchedule(
            [{ item: 'W', qty: 2 }, { item: 'Nope', qty: 1 }],
            [pattern([{ name: 'Z', capacity: 2, allowed: ['W'] }])]
        );
        expect(r.quality).toBe(QUALITY.INCOMPLETE);
    });

    it('does not claim optimal for a greedy-only answer the bound cannot prove', () => {
        const r = calculateSchedule(greedyTrap.inventory, greedyTrap.patterns, { maxIterations: 0 });
        expect(r.quality).not.toBe(QUALITY.OPTIMAL);
    });

    it('finds the shorter schedule greedy misses once the search may run', () => {
        const r = calculateSchedule(greedyTrap.inventory, greedyTrap.patterns);
        expect(r.quality).toBe(QUALITY.OPTIMAL);
        expect(r.schedule).toHaveLength(2);
    });
});

// Pins the corrections made against SOP-000077 v11.0 Attachment 1.
describe('default patterns match SOP-000077 v11.0', () => {
    const patterns = normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA);
    const zone = (id, name) => patterns.find(p => p.id === id).zones.find(z => z.name === name);
    const n = (sopNo) => normalizeName(DEFAULT_CATALOG[sopNo].Name);
    const loadOnce = (id, inventory) => simulateLoad(inventory, patterns.find(p => p.id === id));

    it('puts No.26, not No.19, in P3 B2, P4 B1/B2 and P5 B2', () => {
        [[3, 'B2 (All)'], [4, 'B1 (All)'], [4, 'B2 (All)'], [5, 'B2 (All)']].forEach(([id, z]) => {
            expect(zone(id, z).allowed).toContain(n(26));
            expect(zone(id, z).allowed).not.toContain(n(19));
        });
    });

    it('keeps No.19 only in P3 B1-3 & B1-4', () => {
        const homes = patterns.flatMap(p => p.zones.filter(z => z.allowed.includes(n(19))).map(z => `${p.id}:${z.name}`));
        expect(homes).toEqual(['3:B1-3 & B1-4']);
    });

    it('allows No.30 in P5 A2', () => {
        expect(zone(5, 'A2 (All)').allowed).toContain(n(30));
    });

    it('names P8 A2 for the two locations it occupies', () => {
        expect(zone(8, 'A2-1 & A2-2').capacity).toBe(8);
    });

    it('loads every item of a multi-item location together, each up to its own maximum', () => {
        const p8b14 = loadOnce(8, [
            { item: '50 cm 3/8 -5/8 C-Flex+ 50 cm 5/16 -1/2 pump grade tubing', qty: 3 },
            { item: '3/4 inch TC cap (2/bag)', qty: 20 },
            { item: 'Hose barb to tri-clamp adaptor (2/bag)', qty: 20 },
            { item: '1-1/2 inch Gasket (2/bag)', qty: 8 },
            { item: '3/4 inch Gasket (5/bag)', qty: 8 }
        ]).loadedEntries.filter(e => e.zone === 'B1-4');
        const took = Object.fromEntries(p8b14.map(e => [e.item, e.qty]));
        expect(took['50 cm 3/8 -5/8 C-Flex+ 50 cm 5/16 -1/2 pump grade tubing']).toBe(1);
        expect(took['3/4 inch TC cap (2/bag)']).toBe(10);
        expect(took['Hose barb to tri-clamp adaptor (2/bag)']).toBe(5);
        expect((took['1-1/2 inch Gasket (2/bag)'] || 0) + (took['3/4 inch Gasket (5/bag)'] || 0)).toBe(12);

        const p7b24 = loadOnce(7, [{ item: 'Pump head cover', qty: 2 }, { item: 'WFI sampling tube', qty: 2 }])
            .loadedEntries.filter(e => e.zone === 'B2-4');
        expect(p7b24.map(e => [e.item, e.qty]).sort()).toEqual([['Pump head cover', 1], ['WFI sampling tube', 1]]);

        const p7a24 = loadOnce(7, [{ item: '1-1/2 Manual Valve', qty: 6 }]).loadedEntries.filter(e => e.zone === 'A2-4');
        expect(p7a24).toEqual([{ zone: 'A2-4', item: '1-1/2 Manual Valve', qty: 1 }]);
    });

    it('sends bellows-sheath probes to P04 and click-in-sheath probes to P10', () => {
        const run = (item) => calculateSchedule([{ item, qty: 2 }], patterns).schedule.map(c => c.pattern.program);
        expect(run('DO Probe (bellows sheath)')).toEqual(['P04']);
        expect(run('pH Probe (bellows sheath)')).toEqual(['P04']);
        expect(run('DO Probe (click-in sheath)')).toEqual(['P10']);
        expect(run('pH Probe (click-in sheath)')).toEqual(['P10']);
    });
});

// The search used to be skipped above 50 items. Typical loads now search to
// completion inside the fixed budget, so the badge can say "optimal".
describe('search on realistic loads', () => {
    const patterns = normalizePatterns(DEFAULT_AUTOCLAVE_PATTERNS_DATA);
    const n = (sopNo) => normalizeName(DEFAULT_CATALOG[sopNo].Name);
    const typical = [[1, 4], [3, 2], [4, 2], [5, 2], [9, 2], [11, 2], [2, 2], [7, 2], [13, 2], [15, 2], [17, 2], [21, 2], [23, 2], [24, 2]]
        .map(([k, qty]) => ({ item: n(k), qty }))
        .concat([{ item: 'Forceps', qty: 30 }, { item: '3/4 Manual Valve', qty: 3 }]);

    it('proves a typical 63-item USP load optimal', () => {
        const r = calculateSchedule(typical, patterns);
        expect(r.quality).toBe(QUALITY.OPTIMAL);
        expect(r.schedule).toHaveLength(5);
    });

    it('never needs more cycles than greedy alone', () => {
        const everything = [...new Set([
            ...Object.values(DEFAULT_CATALOG).map(c => normalizeName(c.Name)),
            ...DEFAULT_AUTOCLAVE_GROUP_B.map(normalizeName)
        ])].map(item => ({ item, qty: 2 }));
        [typical, everything].forEach(inv => {
            const greedy = calculateSchedule(inv, patterns, { maxIterations: 0 });
            expect(calculateSchedule(inv, patterns).schedule.length).toBeLessThanOrEqual(greedy.schedule.length);
        });
    });
});
