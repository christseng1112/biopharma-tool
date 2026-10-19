import { describe, it, expect } from 'vitest';
import { withCatalogNames, addAssignment } from '../src/lib/plan.js';

const row = (over = {}) => ({ id: 'a', Stage: 'Harvest', 'SOP No.': 21, Name: 'Pump Tubing Set 620', Qty: 2, Is_Stock: false, Material_Code: null, ...over });

describe('withCatalogNames', () => {
    it('reads the catalog\'s current name, not the one stored at creation', () => {
        const [a] = withCatalogNames([row()], { 21: { Name: 'Pump Tubing Set 620 (renamed)' } });
        expect(a.Name).toBe('Pump Tubing Set 620 (renamed)');
        expect(a.Qty).toBe(2);
    });

    it('keeps the stored name when the SOP No. is not in the catalog', () => {
        expect(withCatalogNames([row()], {})[0].Name).toBe('Pump Tubing Set 620');
    });

    it('does not mutate the stored rows', () => {
        const stored = [row()];
        withCatalogNames(stored, { 21: { Name: 'X' } });
        expect(stored[0].Name).toBe('Pump Tubing Set 620');
    });

    it('returns the same row object when nothing changed', () => {
        const stored = [row()];
        expect(withCatalogNames(stored, { 21: { Name: 'Pump Tubing Set 620' } })[0]).toBe(stored[0]);
    });
});

describe('addAssignment', () => {
    it('adds to the existing row for the same stage, set and stock handling', () => {
        const out = addAssignment([row()], row({ id: 'b', Qty: 3 }));
        expect(out).toHaveLength(1);
        expect(out[0]).toMatchObject({ id: 'a', Qty: 5 });
    });

    it('keeps rows separate when the stage differs', () => {
        expect(addAssignment([row()], row({ id: 'b', Stage: 'Production Medium' }))).toHaveLength(2);
    });

    it('keeps rows separate when the set differs', () => {
        expect(addAssignment([row()], row({ id: 'b', 'SOP No.': 212 }))).toHaveLength(2);
    });

    it('keeps a stock row apart from an assembled row of the same set', () => {
        const stock = row({ id: 'b', Is_Stock: true, Material_Code: 'B0316' });
        expect(addAssignment([row()], stock)).toHaveLength(2);
    });

    it('treats a string SOP No. from an import like its number', () => {
        expect(addAssignment([row({ 'SOP No.': '21' })], row({ id: 'b' }))).toHaveLength(1);
    });

    it('appends to an empty plan', () => {
        expect(addAssignment([], row())).toEqual([row()]);
    });
});
