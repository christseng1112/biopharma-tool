import { describe, it, expect } from 'vitest';
import { simulateLoad, runGreedySimulation, calculateSchedule, MAX_CYCLES, QUALITY } from '../src/lib/scheduler.js';
import { normalizePatterns, normalizeName } from '../src/lib/normalize.js';
import { DEFAULT_AUTOCLAVE_PATTERNS_DATA, DEFAULT_CATALOG, DEFAULT_AUTOCLAVE_GROUP_B } from '../src/data/defaults.js';

const pattern = (zones, id = 1) => ({ id, name: `P${id}`, program: 'P01', zones });
const total = (items) => items.reduce((s, i) => s + i.qty, 0);
const loadedCount = (schedule) =>
    schedule.reduce((s, c) => s + c.loadedItems.reduce((n, l) => n + parseInt(l.match(/\] (\d+)x /)[1], 10), 0), 0);

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
        // Greedy takes Wide first (loads 4), leaving A and B needing a cycle each = 3 cycles.
        // Splitting across the two narrow patterns finishes in 2.
        const patterns = [
            pattern([{ name: 'Wide', capacity: 4, allowed: ['A', 'B'] }], 1),
            pattern([{ name: 'NarrowA', capacity: 3, allowed: ['A'] }], 2),
            pattern([{ name: 'NarrowB', capacity: 3, allowed: ['B'] }], 3)
        ];
        const r = calculateSchedule([{ item: 'A', qty: 3 }, { item: 'B', qty: 3 }], patterns);
        expect(r.schedule).toHaveLength(2);
        expect(r.unscheduled).toEqual([]);
        expect(loadedCount(r.schedule)).toBe(6);
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
        expect(patterns).toHaveLength(10);
        expect(patterns.every(p => Array.isArray(p.zones) && p.zones.length > 0)).toBe(true);
    });

    it('schedules one of every catalog item without leaving anything unscheduled', () => {
        const inventory = [...new Set(Object.values(DEFAULT_CATALOG).map(c => normalizeName(c.Name)))]
            .map(item => ({ item, qty: 1 }));
        const r = calculateSchedule(inventory, patterns);
        expect(r.unscheduled).toEqual([]);
        expect(loadedCount(r.schedule) + total(r.unassignable)).toBe(inventory.length);
    });

    it('has exactly one catalog item missing from every pattern zone', () => {
        // Known data gap, documented in the README. This test exists to make the
        // gap visible: if it changes, the data changed and the README needs an update.
        const inventory = [...new Set(Object.values(DEFAULT_CATALOG).map(c => normalizeName(c.Name)))]
            .map(item => ({ item, qty: 1 }));
        const { unassignable } = calculateSchedule(inventory, patterns);
        expect(unassignable.map(u => u.item)).toEqual(['1"Braided Silicone Tubing Set']);
    });

    it('schedules one of every Group B item without leaving anything unscheduled', () => {
        const inventory = [...new Set(DEFAULT_AUTOCLAVE_GROUP_B.map(normalizeName))].map(item => ({ item, qty: 1 }));
        const r = calculateSchedule(inventory, patterns);
        expect(r.unscheduled).toEqual([]);
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

    it('reports heuristic when there are too many items to search', () => {
        const r = calculateSchedule([{ item: 'W', qty: 60 }], [pattern([{ name: 'Z', capacity: 5, allowed: ['W'] }])]);
        expect(r.quality).toBe(QUALITY.HEURISTIC);
        expect(r.unscheduled).toEqual([]);
        expect(r.schedule).toHaveLength(12);
    });

    it('reports incomplete whenever anything could not be placed', () => {
        const r = calculateSchedule(
            [{ item: 'W', qty: 2 }, { item: 'Nope', qty: 1 }],
            [pattern([{ name: 'Z', capacity: 2, allowed: ['W'] }])]
        );
        expect(r.quality).toBe(QUALITY.INCOMPLETE);
    });

    it('does not claim optimal for a greedy-only answer', () => {
        // 60 items is above BACKTRACK_ITEM_LIMIT, so no search runs.
        const r = calculateSchedule([{ item: 'W', qty: 60 }], [pattern([{ name: 'Z', capacity: 7, allowed: ['W'] }])]);
        expect(r.quality).not.toBe(QUALITY.OPTIMAL);
    });
});
