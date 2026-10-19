/**
 * Shared data shapes, as JSDoc typedefs.
 *
 * There is no runtime code here. JSDoc typedefs are module-scoped, so each
 * consumer imports the ones it uses with an import-typedef line at the top of
 * the file (see scheduler.js or reports.js for the pattern).
 *
 * These exist because the string↔number boundary in this data has been the
 * common root of several defects: a blank Qty producing NaN, a cleared zone
 * capacity making a zone silently accept nothing, a rule without `max` making
 * ruleCapFor return NaN. Writing the intended shapes down makes the places
 * that must coerce and validate explicit.
 */

/**
 * A raw material or fitting. Keyed by material code in the components map.
 * @typedef {object} Component
 * @property {string} Name  Display name, shown on reports.
 * @property {string} Unit  Informational only ("cm" / "ea"); reports derive the
 *                          real unit from whether a BOM row carries a length.
 */

/**
 * A tubing set in the catalog. Keyed by SOP No.
 * @typedef {object} CatalogEntry
 * @property {string} Name              Matched against autoclave zone allow-lists
 *                                      after normalizeName, so renaming detaches
 *                                      the item from its zones.
 * @property {string|null} [Stock_Code] Present when the set is stocked rather
 *                                      than assembled. May arrive as a number
 *                                      from a hand-edited config.
 */

/**
 * One line of a bill of materials.
 * @typedef {object} BomPart
 * @property {string} Code    Key into the components map.
 * @property {number} [Len]   Segment length in cm. Absent or 0 means the row is
 *                            counted in pieces rather than measured in length.
 * @property {number} [Count] Segments per set; defaults to 1.
 */

/**
 * A cap on how many of a subset of items may go in one zone — the "a zone holds
 * six but at most two scissors" rule.
 * @typedef {object} ZoneRule
 * @property {string[]} items Normalized item names the cap applies to, jointly.
 * @property {number} max     Combined ceiling. Must be finite: NaN here makes
 *                            the zone refuse the item forever.
 */

/**
 * One region of an autoclave pattern.
 * @typedef {object} Zone
 * @property {string} name
 * @property {number} capacity      Total slots. Must be finite.
 * @property {string[]} allowed     Normalized item names this zone accepts.
 * @property {ZoneRule[]} [rules]   Absent rather than empty when there are none.
 */

/**
 * One autoclave cycle configuration.
 * @typedef {object} Pattern
 * @property {number} id
 * @property {string} name
 * @property {string} program
 * @property {string} [description]
 * @property {Zone[]} zones
 */

/**
 * A planned tubing set within a process stage.
 * @typedef {object} Assignment
 * @property {string} id
 * @property {string} Stage
 * @property {number} Qty                  Always a positive integer; the UI
 *                                         rejects blank and non-numeric input.
 * @property {string} Name                 Snapshot of the catalog name at the
 *                                         time of adding, not a live reference.
 * @property {boolean} Is_Stock
 * @property {string|null} Material_Code
 */

/**
 * One line of the sterilization queue.
 * @typedef {object} InventoryItem
 * @property {string} item  Normalized name.
 * @property {number} qty
 * @property {string} [source]  'planner' | 'manual' | 'planner+manual'
 */

/**
 * One scheduled autoclave run.
 * @typedef {object} ScheduleCycle
 * @property {Partial<Pattern>} pattern  Report generation tolerates a pattern
 *                                       still being edited, so fields may be absent.
 * @property {string[]} loadedItems  Human-readable lines: "[Zone] 2x Item".
 * @property {number} [cycleNumber]  Assigned by calculateSchedule, 1-based.
 */

/**
 * Every input item lands in exactly one of schedule / unassignable / unscheduled.
 * @typedef {object} ScheduleResult
 * @property {ScheduleCycle[]} schedule
 * @property {InventoryItem[]} unassignable  No zone of any pattern allows it.
 * @property {InventoryItem[]} unscheduled   Allowed, but not placed within MAX_CYCLES.
 * @property {'optimal'|'heuristic'|'incomplete'} quality
 */

/**
 * The exported / imported config payload.
 * @typedef {object} ConfigPayload
 * @property {string} version
 * @property {Assignment[]} assignments
 * @property {string[]} stage_list
 * @property {object} database
 */

/**
 * Every section of a config is optional — a payload carrying only
 * `assignments` is valid — so `value` is the validated input as given, not a
 * guaranteed-complete ConfigPayload. Callers apply each section only if present.
 * @typedef {object} ValidationResult
 * @property {boolean} ok
 * @property {string[]} errors  Named, human-readable; empty when ok.
 * @property {Partial<ConfigPayload>|null} value  Populated only when ok.
 */

export {};
