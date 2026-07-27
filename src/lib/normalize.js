/**
 * Item names arrive from several sources that spell the same thing differently:
 * the catalog, hand-maintained autoclave pattern zones, and imported config
 * files. Zone matching is by exact string, so everything must pass through the
 * same normalization or items silently fail to match any zone.
 */
export const normalizeName = (name) => {
    if (!name) return "";
    let n = name;
    n = n.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
    n = n.replace(/\s*\(Type\s+[A-Za-z0-9]+\)/i, "");
    n = n.replace(/([”"’'])\s+([A-Za-z])/g, '$1$2'); // Fix spaces around quotes
    return n.trim();
};

/**
 * Every value interpolated into a generated report must go through this.
 * Report HTML is rendered via dangerouslySetInnerHTML and the fields it
 * interpolates are user-editable (Database tab) and importable (config JSON).
 */
export const escapeHtml = (value) => {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

/**
 * Single normalization path, shared by initialization, reset, import and
 * autosave load. Initialization and reset previously carried duplicated copies
 * of this and the import/autosave paths had none, which broke zone matching for
 * any config that had not already been normalized.
 */
export const normalizePatterns = (patterns) => (patterns || []).map(p => ({
    ...p,
    zones: (p.zones || []).map(z => ({
        ...z,
        allowed: [...new Set((z.allowed || []).map(normalizeName))],
        rules: z.rules
            ? z.rules.map(r => ({ ...r, items: [...new Set((r.items || []).map(normalizeName))] }))
            : undefined
    }))
}));

export const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Catalog / diagrams / bom are keyed by numeric SOP No.; JSON turns those into strings. */
export const reindexByNumber = (obj) => {
    const out = {};
    Object.keys(obj || {}).forEach(k => { out[parseInt(k, 10)] = obj[k]; });
    return out;
};
