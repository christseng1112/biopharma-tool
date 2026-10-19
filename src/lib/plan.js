/**
 * Pure helpers for the assignment list (the plan).
 */

/**
 * An assignment stores the catalog name it was created with. Everything that
 * reads the plan should use the catalog's current name instead: after a
 * rename (and the matching zone update) the autoclave used to look up the
 * old name, so planned sets turned up as unassignable, and the assembly
 * guide kept printing the old name. Falls back to the stored name when the
 * SOP No. is no longer in the catalog.
 *
 * The stored assignments are left untouched; this is a read-time view.
 */
export const withCatalogNames = (assignments, catalog) => (assignments || []).map(a => {
    const current = catalog?.[a['SOP No.']]?.Name;
    return current && current !== a.Name ? { ...a, Name: current } : a;
});

const sameLine = (a, b) =>
    a.Stage === b.Stage
    && Number(a['SOP No.']) === Number(b['SOP No.'])
    && Boolean(a.Is_Stock) === Boolean(b.Is_Stock)
    && (a.Material_Code ?? null) === (b.Material_Code ?? null);

/**
 * Add a row to the plan. Adding the same set to the same stage again used to
 * create a second row, so one quantity was split across two places; it now
 * adds to the existing row (keeping its id). Rows that differ in stage, set,
 * or stock handling stay separate.
 */
export const addAssignment = (assignments, row) => {
    const list = assignments || [];
    const existing = list.find(a => sameLine(a, row));
    if (!existing) return [...list, row];
    return list.map(a => (a === existing ? { ...a, Qty: a.Qty + row.Qty } : a));
};
