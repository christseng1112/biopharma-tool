/**
 * Autoclave load scheduling (SOP-000077).
 *
 * A `pattern` describes one autoclave cycle: a list of zones, each with a
 * capacity, a list of allowed item names, and optional `rules` capping how many
 * of a given subset may go in that zone (e.g. a zone holds 6 items but at most
 * 2 of them may be scissors).
 */

/** Hard ceiling on cycles in one schedule. Anything beyond this is reported, never dropped. */
export const MAX_CYCLES = 100;

/** Backtracking is only attempted below this item count, and only up to MAX_ITERATIONS. */
export const BACKTRACK_ITEM_LIMIT = 50;
export const MAX_ITERATIONS = 3000;

/** Load as much of `inventory` as fits into a single run of `pattern`. */
export const simulateLoad = (inventory, pattern) => {
    const tempInv = inventory.map(i => ({ ...i }));
    let totalLoaded = 0;
    const loadPlan = [];
    const zoneUsage = (pattern.zones || []).map(z => ({ ...z, used: 0, assignedItems: {} }));

    for (let i = 0; i < zoneUsage.length; i++) {
        const zone = zoneUsage[i];
        const candidates = tempInv.filter(inv => zone.allowed.includes(inv.item) && inv.qty > 0);
        for (const cand of candidates) {
            let space = zone.capacity - zone.used;
            if (zone.rules) {
                for (const rule of zone.rules) {
                    if (rule.items.includes(cand.item)) {
                        let currentRuleUsage = 0;
                        rule.items.forEach(ruleItem => { currentRuleUsage += (zone.assignedItems[ruleItem] || 0); });
                        space = Math.min(space, rule.max - currentRuleUsage);
                    }
                }
            }
            if (space > 0) {
                const take = Math.min(space, cand.qty);
                zone.used += take;
                zone.assignedItems[cand.item] = (zone.assignedItems[cand.item] || 0) + take;
                cand.qty -= take;
                totalLoaded += take;
                loadPlan.push(`[${zone.name}] ${take}x ${cand.item}`);
            }
        }
    }
    return { loadedCount: totalLoaded, loadPlan, remainingInv: tempInv };
};

/**
 * Repeatedly pick the pattern that loads the most remaining items.
 *
 * Returns the leftover inventory alongside the schedule. Both loop exits (the
 * cycle ceiling and the "nothing loadable" break) used to discard whatever was
 * left, so the caller saw a schedule that silently covered fewer items than
 * were requested.
 */
export const runGreedySimulation = (inventory, patterns) => {
    let currentInventory = inventory.map(i => ({ ...i }));
    const schedule = [];
    let safety = 0;
    while (currentInventory.some(i => i.qty > 0) && safety++ < MAX_CYCLES) {
        let best = null;
        let maxLoaded = -1;
        for (const p of patterns) {
            const res = simulateLoad(currentInventory, p);
            if (res.loadedCount > maxLoaded) {
                maxLoaded = res.loadedCount;
                best = { pattern: p, ...res };
            }
        }
        if (!best || best.loadedCount === 0) break;
        currentInventory = best.remainingInv;
        schedule.push({ pattern: best.pattern, loadedItems: best.loadPlan });
    }
    const remaining = currentInventory.filter(i => i.qty > 0).map(i => ({ ...i }));
    return { schedule, remaining };
};

/**
 * Build a sterilization schedule.
 *
 * Every input item ends up in exactly one of three buckets:
 *   schedule     — placed in a cycle
 *   unassignable — no zone of any pattern allows this item name
 *   unscheduled  — allowed somewhere, but could not be placed within MAX_CYCLES
 */
export const calculateSchedule = (inventory, patterns) => {
    const allAllowedItems = new Set(patterns.flatMap(p => (p.zones || []).flatMap(z => z.allowed)));
    const cleanInventory = [];
    const unassignable = [];
    inventory.forEach(item => {
        if (allAllowedItems.has(item.item)) cleanInventory.push({ ...item });
        else unassignable.push({ ...item });
    });

    if (cleanInventory.length === 0) return { schedule: [], unassignable, unscheduled: [] };

    const greedy = runGreedySimulation(cleanInventory, patterns);
    let bestSchedule = greedy.schedule;
    let bestRemaining = greedy.remaining;
    // Only a schedule that consumes everything is a valid upper bound for pruning.
    // Using an incomplete greedy result here would prune away valid complete solutions.
    let minCycles = bestRemaining.length === 0 ? bestSchedule.length : Infinity;

    const totalItems = cleanInventory.reduce((s, i) => s + i.qty, 0);
    if (totalItems < BACKTRACK_ITEM_LIMIT) {
        let iterations = 0;
        const solve = (currentInv, currentPath) => {
            iterations++;
            if (iterations > MAX_ITERATIONS) return;
            if (currentPath.length >= minCycles || currentPath.length >= MAX_CYCLES) return;
            if (currentInv.every(i => i.qty <= 0)) {
                minCycles = currentPath.length;
                bestSchedule = [...currentPath];
                bestRemaining = [];
                return;
            }
            const candidates = [];
            for (const pattern of patterns) {
                const res = simulateLoad(currentInv, pattern);
                if (res.loadedCount > 0) candidates.push({ pattern, ...res });
            }
            candidates.sort((a, b) => b.loadedCount - a.loadedCount);
            for (const cand of candidates) {
                solve(cand.remainingInv, [...currentPath, { pattern: cand.pattern, loadedItems: cand.loadPlan }]);
            }
        };
        solve(cleanInventory, []);
    }

    const finalSchedule = bestSchedule.map((c, i) => ({ ...c, cycleNumber: i + 1 }));
    return { schedule: finalSchedule, unassignable, unscheduled: bestRemaining };
};
