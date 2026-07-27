import { describe, it, expect } from 'vitest';
import { generatePickingListHTML, generateAssemblyGuideHTML, provenanceHTML } from '../src/lib/reports.js';
import { APP_VERSION } from '../src/lib/config.js';

const components = {
    'B1': { Name: 'C-Flex tubing', Unit: 'cm' },
    'C1': { Name: 'Barb connector', Unit: 'ea' }
};
const bom = {
    1: [{ Code: 'B1', Len: 30, Count: 2 }, { Code: 'C1', Count: 1 }],
    2: [{ Code: 'B1', Len: 45, Count: 1 }]
};
const catalog = {
    1: { Name: 'Set One', Stock_Code: null },
    9: { Name: 'Stock Set', Stock_Code: 'S001' }
};

const task = (over = {}) => ({ Stage: 'Harvest', 'SOP No.': 1, Qty: 1, Is_Stock: false, Material_Code: null, Name: 'Set One', ...over });

describe('generatePickingListHTML — quantities', () => {
    it('multiplies segment length by segment count by set quantity', () => {
        const html = generatePickingListHTML([task({ Qty: 3 })], bom, components, catalog);
        expect(html).toContain('180 cm'); // 30 cm x 2 segments x 3 sets
    });

    it('states cutting detail consistent with the total', () => {
        const html = generatePickingListHTML([task({ Qty: 3 })], bom, components, catalog);
        expect(html).toContain('30 cm x 6'); // 2 segments x 3 sets
    });

    it('counts non-tubing parts in ea, not cm', () => {
        const html = generatePickingListHTML([task({ Qty: 3 })], bom, components, catalog);
        expect(html).toContain('3 ea'); // Count 1 x Qty 3
    });

    it('sums the same material across different SOP numbers', () => {
        const html = generatePickingListHTML(
            [task({ 'SOP No.': 1, Qty: 1 }), task({ 'SOP No.': 2, Qty: 2 })],
            bom, components, catalog
        );
        // 30x2x1 = 60, plus 45x1x2 = 90 → 150
        expect(html).toContain('150 cm');
        expect(html).toContain('45 cm x 2');
        expect(html).toContain('30 cm x 2');
    });

    it('lists cutting lengths longest first', () => {
        const html = generatePickingListHTML(
            [task({ 'SOP No.': 1, Qty: 1 }), task({ 'SOP No.': 2, Qty: 1 })],
            bom, components, catalog
        );
        expect(html.indexOf('45 cm x')).toBeLessThan(html.indexOf('30 cm x'));
    });

    it('routes stock items to the stock table and out of raw materials', () => {
        const html = generatePickingListHTML(
            [task({ 'SOP No.': 9, Qty: 4, Is_Stock: true, Material_Code: 'S001' })],
            bom, components, catalog
        );
        expect(html).toContain('Stock Sets');
        expect(html).toContain('Stock Set');
        expect(html).toContain('4 ea');
        expect(html).toContain('No raw materials required');
    });

    it('says so when there is nothing to pick', () => {
        expect(generatePickingListHTML([], bom, components, catalog)).toContain('No raw materials required');
    });

    it('falls back to Unknown for a material code with no component record', () => {
        const html = generatePickingListHTML([task()], { 1: [{ Code: 'GHOST', Count: 1 }] }, components, catalog);
        expect(html).toContain('Unknown');
    });
});

describe('generateAssemblyGuideHTML', () => {
    it('emits a section per stage that has assemblable tasks', () => {
        const html = generateAssemblyGuideHTML(['Harvest', 'Empty Stage'], [task()], bom, components, { 1: 'A-[B]-C' });
        expect(html).toContain('Harvest');
        expect(html).not.toContain('Empty Stage');
    });

    it('excludes stock items', () => {
        const html = generateAssemblyGuideHTML(['Harvest'], [task({ Is_Stock: true, Material_Code: 'S001' })], bom, components, {});
        expect(html).not.toContain('Set One');
    });

    it('shows total length with the segment breakdown when there is more than one segment', () => {
        const html = generateAssemblyGuideHTML(['Harvest'], [task({ Qty: 3 })], bom, components, {});
        expect(html).toContain('180 cm');
        expect(html).toContain('(6 x 30 cm)');
    });

    it('spans the assembly cell across every BOM row', () => {
        const html = generateAssemblyGuideHTML(['Harvest'], [task()], bom, components, {});
        expect(html).toContain('rowspan="2"'); // SOP 1 has two BOM lines
    });
});

describe('report escaping', () => {
    const payload = '<img src=x onerror="alert(1)">';

    it('escapes component names in the picking list', () => {
        const html = generatePickingListHTML([task()], bom, { 'B1': { Name: payload, Unit: 'cm' }, 'C1': components.C1 }, catalog);
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img');
    });

    it('escapes material codes in the picking list', () => {
        const html = generatePickingListHTML([task()], { 1: [{ Code: '<b>X</b>', Count: 1 }] }, components, catalog);
        expect(html).not.toContain('<b>X</b>');
    });

    it('escapes stock set names in the picking list', () => {
        const html = generatePickingListHTML(
            [task({ Is_Stock: true, Material_Code: 'S001' })],
            bom, components, { 9: { Name: payload, Stock_Code: 'S001' } }
        );
        expect(html).not.toContain('<img');
    });

    it('escapes stage names in the assembly guide', () => {
        const html = generateAssemblyGuideHTML([payload], [task({ Stage: payload })], bom, components, {});
        expect(html).not.toContain('<img');
    });

    it('escapes assembly names in the assembly guide', () => {
        const html = generateAssemblyGuideHTML(['Harvest'], [task({ Name: payload })], bom, components, {});
        expect(html).not.toContain('<img');
    });

    it('escapes the ASCII diagram in the assembly guide', () => {
        const html = generateAssemblyGuideHTML(['Harvest'], [task()], bom, components, { 1: '<b>diagram</b>' });
        expect(html).not.toContain('<b>diagram</b>');
        expect(html).toContain('&lt;b&gt;diagram&lt;/b&gt;');
    });

    it('leaves the report\'s own markup intact', () => {
        const html = generatePickingListHTML([task()], bom, components, catalog);
        expect(html).toContain('<table class="custom-table">');
        expect(html).toContain('<div class="report-container">');
    });
});

describe('provenance header', () => {
    const at = new Date(2026, 6, 27, 14, 5, 9); // 2026-07-27 14:05:09 local

    it('records the generation timestamp to the second', () => {
        expect(provenanceHTML({ title: 'T', generatedAt: at })).toContain('2026-07-27 14:05:09');
    });

    it('zero-pads single-digit date parts', () => {
        const html = provenanceHTML({ title: 'T', generatedAt: new Date(2026, 0, 5, 9, 8, 7) });
        expect(html).toContain('2026-01-05 09:08:07');
    });

    it('records the tool version', () => {
        expect(provenanceHTML({ title: 'T', generatedAt: at })).toContain(`v${APP_VERSION}`);
    });

    it('names the data source when one is known', () => {
        expect(provenanceHTML({ title: 'T', sourceLabel: 'batch_42.json v30.11', generatedAt: at }))
            .toContain('batch_42.json v30.11');
    });

    it('says so explicitly when running on built-in defaults', () => {
        expect(provenanceHTML({ title: 'T', generatedAt: at })).toContain('built-in defaults');
    });

    it('marks the document as uncontrolled', () => {
        const html = provenanceHTML({ title: 'T', generatedAt: at });
        expect(html).toContain('UNCONTROLLED DOCUMENT');
        expect(html).toContain('非受控文件');
    });

    it('escapes the source label', () => {
        expect(provenanceHTML({ title: 'T', sourceLabel: '<img src=x onerror=alert(1)>', generatedAt: at }))
            .not.toContain('<img');
    });

    it('falls back to now when handed an invalid date', () => {
        expect(provenanceHTML({ title: 'T', generatedAt: new Date('nonsense') })).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });
});

describe('reports carry provenance', () => {
    const at = new Date(2026, 6, 27, 14, 5, 9);
    const prov = { sourceLabel: 'shift_a.json', generatedAt: at };

    it('does not repeat the document title inside the header', () => {
        const html = provenanceHTML({ title: 'Total Material Picking List', generatedAt: at });
        expect(html).not.toContain('Total Material Picking List');
    });

    it('picking list includes the header', () => {
        const html = generatePickingListHTML([task()], bom, components, catalog, prov);
        expect(html).toContain('2026-07-27 14:05:09');
        expect(html).toContain('shift_a.json');
        expect(html).toContain('UNCONTROLLED DOCUMENT');
        expect(html).toContain('Total Material Picking List');
    });

    it('assembly guide includes the header', () => {
        const html = generateAssemblyGuideHTML(['Harvest'], [task()], bom, components, {}, prov);
        expect(html).toContain('2026-07-27 14:05:09');
        expect(html).toContain('shift_a.json');
        expect(html).toContain('Biopharma Assembly Guide');
    });

    it('still emits the header when the report has no rows', () => {
        const html = generatePickingListHTML([], bom, components, catalog, prov);
        expect(html).toContain('UNCONTROLLED DOCUMENT');
        expect(html).toContain('No raw materials required');
    });

    it('places the header before the data tables', () => {
        const html = generatePickingListHTML([task()], bom, components, catalog, prov);
        expect(html.indexOf('provenance')).toBeLessThan(html.indexOf('custom-table'));
    });
});
