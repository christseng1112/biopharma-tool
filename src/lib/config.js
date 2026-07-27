import { isPlainObject } from './normalize.js';

/** Single source of truth for the version shown in the UI and written to exports. */
export const APP_VERSION = "30.11";

export const AUTOSAVE_KEY = "BIOPHARMA_AUTOSAVE";

/**
 * The key is deliberately version-free. Bumping the app version must not
 * silently orphan a user's saved work; migration is driven by the `version`
 * field inside the payload instead. Older versioned keys are read once and
 * migrated forward.
 */
export const LEGACY_AUTOSAVE_KEYS = ["BIOPHARMA_AUTOSAVE_V30_10"];

/**
 * Validate an imported or restored config before any of it reaches state.
 * Returns { ok, errors, value }; `value` is only populated when ok is true.
 *
 * Import previously applied its payload field by field with no validation, so a
 * malformed file left the app half-populated — and autosaved in that state.
 */
export const validateConfig = (data) => {
    const errors = [];
    if (!isPlainObject(data)) return { ok: false, errors: ["設定檔最外層必須是一個物件"], value: null };

    if (data.assignments !== undefined && !Array.isArray(data.assignments)) errors.push("assignments 必須是陣列");
    if (data.stage_list !== undefined && !Array.isArray(data.stage_list)) errors.push("stage_list 必須是陣列");

    const db = data.database;
    if (db !== undefined && !isPlainObject(db)) errors.push("database 必須是物件");

    if (isPlainObject(db)) {
        if (db.components !== undefined && !isPlainObject(db.components)) errors.push("database.components 必須是物件 (code -> {Name, Unit})");
        if (db.catalog !== undefined && !isPlainObject(db.catalog)) errors.push("database.catalog 必須是物件 (SOP No. -> {Name, Stock_Code})");
        if (db.diagrams !== undefined && !isPlainObject(db.diagrams)) errors.push("database.diagrams 必須是物件 (SOP No. -> string)");
        if (db.bom !== undefined && !isPlainObject(db.bom)) errors.push("database.bom 必須是物件 (SOP No. -> 陣列)");

        // Entry shapes matter as much as container shapes: a null catalog entry
        // passes an "is it an object" check and then throws during render.
        if (isPlainObject(db.components)) {
            Object.entries(db.components).forEach(([k, v]) => {
                if (!isPlainObject(v)) errors.push(`database.components["${k}"] 必須是物件 {Name, Unit}`);
            });
        }
        if (isPlainObject(db.catalog)) {
            Object.entries(db.catalog).forEach(([k, v]) => {
                if (!isPlainObject(v)) errors.push(`database.catalog["${k}"] 必須是物件 {Name, Stock_Code}`);
            });
        }
        if (isPlainObject(db.diagrams)) {
            Object.entries(db.diagrams).forEach(([k, v]) => {
                if (v !== null && typeof v !== 'string') errors.push(`database.diagrams["${k}"] 必須是字串`);
            });
        }
        if (isPlainObject(db.bom)) {
            Object.entries(db.bom).forEach(([k, v]) => {
                if (!Array.isArray(v)) { errors.push(`database.bom["${k}"] 必須是陣列`); return; }
                v.forEach((part, i) => {
                    if (!isPlainObject(part)) errors.push(`database.bom["${k}"][${i}] 必須是物件 {Code, Len?, Count?}`);
                });
            });
        }
        const ac = db.autoclave;
        if (ac !== undefined && !isPlainObject(ac)) errors.push("database.autoclave 必須是物件");
        if (isPlainObject(ac)) {
            if (ac.patterns !== undefined && !Array.isArray(ac.patterns)) errors.push("database.autoclave.patterns 必須是陣列");
            if (Array.isArray(ac.patterns)) {
                ac.patterns.forEach((p, i) => {
                    if (!isPlainObject(p)) { errors.push(`patterns[${i}] 必須是物件`); return; }
                    if (!Array.isArray(p.zones)) { errors.push(`patterns[${i}].zones 必須是陣列`); return; }
                    p.zones.forEach((z, j) => {
                        if (!isPlainObject(z)) { errors.push(`patterns[${i}].zones[${j}] 必須是物件`); return; }
                        if (!Array.isArray(z.allowed)) errors.push(`patterns[${i}].zones[${j}].allowed 必須是陣列`);
                        if (z.capacity !== undefined && !Number.isFinite(z.capacity)) {
                            errors.push(`patterns[${i}].zones[${j}].capacity 必須是數字`);
                        }
                        // A rule missing `max` makes ruleCapFor return NaN, and the
                        // zone then silently refuses the item forever. Reject it at
                        // the door instead of letting the schedule come out wrong.
                        if (z.rules !== undefined) {
                            if (!Array.isArray(z.rules)) {
                                errors.push(`patterns[${i}].zones[${j}].rules 必須是陣列`);
                            } else {
                                z.rules.forEach((r, k) => {
                                    const at = `patterns[${i}].zones[${j}].rules[${k}]`;
                                    if (!isPlainObject(r)) { errors.push(`${at} 必須是物件 {items, max}`); return; }
                                    if (!Array.isArray(r.items)) errors.push(`${at}.items 必須是陣列`);
                                    if (!Number.isFinite(r.max)) errors.push(`${at}.max 必須是數字`);
                                });
                            }
                        }
                    });
                });
            }
            if (ac.inventory_group_b !== undefined && !Array.isArray(ac.inventory_group_b)) errors.push("database.autoclave.inventory_group_b 必須是陣列");
            if (ac.manual_cart !== undefined && !Array.isArray(ac.manual_cart)) errors.push("database.autoclave.manual_cart 必須是陣列");
        }
    }

    return errors.length > 0 ? { ok: false, errors, value: null } : { ok: true, errors: [], value: data };
};
