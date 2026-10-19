/**
 * Local-time formatting shared by the report provenance headers and the export
 * filename, so a downloaded config and the report generated beside it agree on
 * what time it is. Deliberately local time, not UTC: the reader is an operator
 * on the production floor comparing against a wall clock.
 */

const pad = (n) => String(n).padStart(2, '0');

/** A Date, or now if the argument is missing or unusable. */
const safeDate = (d) => (d instanceof Date && !Number.isNaN(d.getTime())) ? d : new Date();

/** `2026-07-27 14:05:09` — for display inside a document. */
export const formatTimestamp = (date) => {
    const d = safeDate(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} `
        + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/** `2026-07-27_1405` — filename-safe, sorts chronologically. */
export const formatFileStamp = (date) => {
    const d = safeDate(date);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
};
