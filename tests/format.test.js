import { describe, it, expect } from 'vitest';
import { formatTimestamp, formatFileStamp } from '../src/lib/format.js';

describe('formatTimestamp', () => {
    it('formats local time to the second', () => {
        expect(formatTimestamp(new Date(2026, 6, 27, 14, 5, 9))).toBe('2026-07-27 14:05:09');
    });

    it('zero-pads every single-digit part', () => {
        expect(formatTimestamp(new Date(2026, 0, 5, 9, 8, 7))).toBe('2026-01-05 09:08:07');
    });

    it('falls back to now for an unusable date', () => {
        expect(formatTimestamp(new Date('nonsense'))).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
        expect(formatTimestamp(undefined)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
});

describe('formatFileStamp', () => {
    it('is filename-safe: no colons or spaces', () => {
        const stamp = formatFileStamp(new Date(2026, 6, 27, 14, 5, 9));
        expect(stamp).toBe('2026-07-27_1405');
        expect(stamp).not.toMatch(/[:\s/\\]/);
    });

    it('sorts chronologically as plain text', () => {
        const a = formatFileStamp(new Date(2026, 0, 5, 9, 8));
        const b = formatFileStamp(new Date(2026, 6, 27, 14, 5));
        const c = formatFileStamp(new Date(2026, 6, 27, 14, 6));
        expect([c, a, b].sort()).toEqual([a, b, c]);
    });

    it('falls back to now for an unusable date', () => {
        expect(formatFileStamp(new Date('nonsense'))).toMatch(/^\d{4}-\d{2}-\d{2}_\d{4}$/);
    });

    it('produces distinct names for exports a minute apart', () => {
        expect(formatFileStamp(new Date(2026, 6, 27, 14, 5)))
            .not.toBe(formatFileStamp(new Date(2026, 6, 27, 14, 6)));
    });
});
