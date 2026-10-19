/**
 * Browser end-to-end tests against the built artifact (the root index.html —
 * the exact file that gets distributed), opened over file:// like an operator
 * would.
 *
 * These cover behavior that unit tests cannot: dialog flows, localStorage
 * autosave, downloads, and the wiring between editors and the schedule.
 * Run with `npm run test:e2e`. Skips (exit 0) when no browser is available,
 * same policy as verify-offline — a missing Chromium must not fail a fresh
 * checkout, but a real assertion failure always exits non-zero.
 */
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { launchBrowser, SKIP_HINT } from '../../scripts/launch-browser.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP_URL = pathToFileURL(join(root, 'index.html')).href;
// The autosave writer debounces for 1 s; wait longer before reading it back.
const AUTOSAVE_FLUSH_MS = 1600;

const { browser, reason } = await launchBrowser();
if (!browser) {
    console.log(`e2e: skipped — ${reason}`);
    console.log(`     ${SKIP_HINT}`);
    process.exit(0);
}

let failures = 0;
const ok = (name, cond, detail) => {
    console.log(`  ${cond ? '✓' : '✗'} ${name}${cond || !detail ? '' : `\n      ${detail}`}`);
    if (!cond) failures++;
};

/** Fresh page with cleared storage. `dialog.action` is switchable per step. */
const freshPage = async () => {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true });
    const dialog = { action: 'dismiss', messages: [] };
    page.on('dialog', async d => {
        dialog.messages.push(d.message());
        await (dialog.action === 'accept' ? d.accept() : d.dismiss());
    });
    await page.goto(APP_URL);
    await page.waitForSelector('#root h1');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForSelector('#root h1');
    return { page, dialog };
};

const readAutosave = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('BIOPHARMA_AUTOSAVE')));

const addAssignment = async (page, qty = 2) => {
    await page.locator('input[type=number]').first().fill(String(qty));
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.waitForTimeout(200);
};

const scenarios = [];
const scenario = (name, fn) => scenarios.push({ name, fn });

// ---------------------------------------------------------------- planner ---

scenario('Qty guard: blank quantity disables Add instead of producing NaN', async ({ page }) => {
    await page.locator('input[type=number]').first().fill('');
    ok('Add is disabled', await page.getByRole('button', { name: 'Add', exact: true }).isDisabled());
    ok('validation hint shown', await page.locator('text=請輸入大於 0 的整數').isVisible());
    await page.locator('input[type=number]').first().fill('3');
    ok('Add re-enables', await page.getByRole('button', { name: 'Add', exact: true }).isEnabled());
});

scenario('Stage delete asks for confirmation and cancel keeps the data', async ({ page, dialog }) => {
    await addAssignment(page);
    dialog.action = 'dismiss'; // answer "cancel"
    await page.selectOption('select >> nth=0', 'Production Medium');
    await page.locator('.bg-red-500').nth(1).click(); // minus button (nth(0) is the sidebar toggle)
    await page.waitForTimeout(300);
    ok('confirm dialog appeared', dialog.messages.length === 1, JSON.stringify(dialog.messages));
    ok('dialog states how many assignments go', /1 筆 Assignment/.test(dialog.messages[0] || ''));
    ok('cancel keeps the assignment', /Production Medium/.test(await page.textContent('#root')));
});

// ---------------------------------------------------------------- reports ---

scenario('Report escaping: a hostile component name renders as text', async ({ page }) => {
    await addAssignment(page);
    await page.getByRole('button', { name: /Database/ }).click();
    await page.waitForTimeout(300);
    const editor = page.locator('div').filter({ hasText: /Manage Components/ }).last();
    const row = editor.locator('input');
    await row.nth(0).fill('B0326'); // referenced by catalog No. 1's BOM
    await row.nth(1).fill('<img src=x onerror="window.__XSS=1">');
    await row.nth(2).fill('cm');
    await editor.getByRole('button', { name: 'Update' }).click();
    await editor.getByRole('button', { name: 'Save Changes' }).click();
    await page.getByRole('button', { name: /Picking List/ }).click();
    await page.waitForTimeout(400);
    ok('payload did not execute', await page.evaluate(() => window.__XSS === undefined));
    ok('no injected <img> in the report', await page.locator('#root .custom-table img').count() === 0);
    ok('payload displayed as text', /<img src=x onerror=/.test(await page.textContent('#root')));
});

// ------------------------------------------------------- autosave / import ---

scenario('Corrupt autosave is quarantined, never overwritten', async ({ page }) => {
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('BIOPHARMA_AUTOSAVE', '{ not json'); });
    await page.reload();
    await page.waitForSelector('#root h1');
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    ok('error banner shown', /自動存檔讀取失敗/.test(await page.textContent('#root')));
    const backups = await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('_CORRUPT_')));
    ok('original payload backed up', backups.length === 1, JSON.stringify(backups));
    ok('backup content intact', await page.evaluate(k => localStorage.getItem(k), backups[0]) === '{ not json');
});

scenario('Invalid import is rejected by name and leaves state untouched', async ({ page }) => {
    const before = await page.textContent('#root');
    await page.setInputFiles('input[type=file]', {
        name: 'bad.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ stage_list: 'nope', database: { bom: { 1: 'nope' } } }))
    });
    await page.waitForTimeout(600);
    const txt = await page.textContent('#root');
    ok('rejection banner names the fields', /stage_list/.test(txt) && /bom/.test(txt));
    ok('nothing was applied', /未套用任何資料/.test(txt));
    ok('stages unchanged', before.includes('Production Medium') && txt.includes('Production Medium'));
});

scenario('Valid import applies and normalizes patterns', async ({ page }) => {
    await page.setInputFiles('input[type=file]', {
        name: 'good.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({
            version: '30.12', assignments: [], stage_list: ['匯入成功階段'],
            database: { autoclave: { patterns: [{ id: 1, name: 'P', program: 'P01', zones: [{ name: 'Z', capacity: 2, allowed: ['Widget  (Type A)'] }] }] } }
        }))
    });
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    ok('imported stage visible', /匯入成功階段/.test(await page.textContent('#root')));
    const allowed = (await readAutosave(page)).database.autoclave.patterns[0].zones[0].allowed;
    ok('pattern names normalized on import', allowed[0] === 'Widget', JSON.stringify(allowed));
});

// ---------------------------------------------------------------- catalog ---

scenario('Catalog delete is staged until Save Changes', async ({ page, dialog }) => {
    await page.getByRole('button', { name: /Database/ }).click();
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS); // first autosave lands
    const bomBefore = (await readAutosave(page)).database.bom;
    dialog.action = 'accept'; // answer "yes" to the delete confirm
    const cat = page.locator('div').filter({ hasText: /Manage Catalog/ }).last();
    await cat.locator('tbody tr').last().getByRole('button').click();
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    ok('BOM untouched before Save Changes',
        JSON.stringify((await readAutosave(page)).database.bom) === JSON.stringify(bomBefore));
    ok('pending-delete notice shown', /待刪除/.test(await page.textContent('#root')));
    await cat.getByRole('button', { name: 'Save Changes' }).click();
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    ok('BOM entry removed only on commit',
        Object.keys((await readAutosave(page)).database.bom).length === Object.keys(bomBefore).length - 1);
});

// -------------------------------------------------------------- autoclave ---

scenario('Zone capacity input never stores NaN', async ({ page }) => {
    await page.getByRole('button', { name: /Autoclave Calc/ }).click();
    await page.waitForTimeout(600);
    await page.locator('.cursor-pointer', { hasText: 'Pattern 1 (MFG USP)' }).first().click();
    await page.waitForTimeout(400);
    await page.locator('input[title="Zone capacity"]').first().fill('');
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    const cap = (await readAutosave(page)).database.autoclave.patterns[0].zones[0].capacity;
    ok('cleared capacity stored as a finite number', Number.isFinite(cap), `capacity=${JSON.stringify(cap)}`);
});

scenario('Schedule shows a scoped quality badge and downloads with provenance', async ({ page }) => {
    await addAssignment(page);
    await page.getByRole('button', { name: /Autoclave Calc/ }).click();
    await page.waitForTimeout(800);
    ok('quality badge visible', /(最佳解|近似解|不完整)/.test(await page.textContent('#root')));

    const dir = mkdtempSync(join(tmpdir(), 'e2e-dl-'));
    try {
        const [dl] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: /Download/ }).click()
        ]);
        const path = join(dir, 'schedule.html');
        await dl.saveAs(path);
        const html = readFileSync(path, 'utf8');
        ok('download carries provenance + uncontrolled statement', /UNCONTROLLED DOCUMENT/.test(html));
        ok('download lists the cycle load', /Cycle 1/.test(html) && /custom-table/.test(html));
        ok('download has no external references', !/(src|href)="https?:/.test(html));
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

scenario('Zone rules are editable and guard their max against NaN', async ({ page }) => {
    await page.getByRole('button', { name: /Autoclave Calc/ }).click();
    await page.waitForTimeout(600);
    await page.locator('.cursor-pointer', { hasText: 'Pattern 1 (MFG USP)' }).first().click();
    await page.waitForTimeout(400);

    await page.getByRole('button', { name: '+ Rule' }).first().click();
    await page.waitForTimeout(200);
    ok('empty rule warns it is inert', /尚未選擇品項/.test(await page.textContent('#root')));

    const maxInput = page.locator('input[title="此限制內所有品項的合計上限"]').first();
    await maxInput.fill('2');
    const ruleSelect = page.locator('select', { has: page.locator('option', { hasText: '加入受限品項' }) }).first();
    await ruleSelect.selectOption({ index: 1 });
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    const rules = (await readAutosave(page)).database.autoclave.patterns[0].zones[0].rules;
    ok('rule persisted with max=2 and one item',
        Array.isArray(rules) && rules.some(r => r.max === 2 && r.items.length === 1), JSON.stringify(rules));

    await maxInput.fill('');
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    const rules2 = (await readAutosave(page)).database.autoclave.patterns[0].zones[0].rules;
    ok('cleared max stored as 0, not NaN', (rules2 || []).every(r => Number.isFinite(r.max)), JSON.stringify(rules2));

    await page.getByRole('button', { name: 'Delete rule' }).first().click();
    await page.waitForTimeout(AUTOSAVE_FLUSH_MS);
    const rules3 = (await readAutosave(page)).database.autoclave.patterns[0].zones[0].rules;
    ok('deleting the only rule drops the key', rules3 === undefined, JSON.stringify(rules3));
});

scenario('Typing in the pattern editor stays responsive and never shows a stale result as current', async ({ page }) => {
    await addAssignment(page, 3);
    await page.getByRole('button', { name: /Autoclave Calc/ }).click();
    await page.waitForTimeout(800);
    await page.locator('.cursor-pointer', { hasText: 'Pattern 1 (MFG USP)' }).first().click();
    await page.waitForTimeout(400);

    const nameInput = page.locator('input[placeholder="Name"]').first();
    const typed = 'Pattern 1 RENAMED';
    await nameInput.fill('');
    // Type character by character: this is the path that used to run a ~143 ms
    // synchronous schedule computation per keystroke.
    await nameInput.pressSequentially(typed, { delay: 15 });
    ok('no characters dropped while typing', await nameInput.inputValue() === typed, await nameInput.inputValue());

    // Whatever the timing, the two states must be self-consistent: either the
    // recalculating badge is up and Download is disabled, or neither is true.
    const settled = async () => {
        const recalculating = await page.locator('text=計算中 (recalculating)').count() > 0;
        const dl = page.getByRole('button', { name: /Download/ });
        const disabled = await dl.count() > 0 ? await dl.isDisabled() : null;
        return { recalculating, disabled };
    };
    const mid = await settled();
    ok('download is disabled whenever the badge is showing',
        !mid.recalculating || mid.disabled === true, JSON.stringify(mid));

    await page.waitForTimeout(1200);
    const after = await settled();
    ok('recalculation finishes', after.recalculating === false, JSON.stringify(after));
    ok('download is enabled once settled', after.disabled === false, JSON.stringify(after));
    ok('the rename took effect', /Pattern 1 RENAMED/.test(await page.textContent('#root')));
});

// --------------------------------------------------------- export / backups ---

scenario('Config export filenames are timestamped so they do not overwrite', async ({ page }) => {
    const dir = mkdtempSync(join(tmpdir(), 'e2e-cfg-'));
    try {
        const [dl] = await Promise.all([
            page.waitForEvent('download'),
            page.getByRole('button', { name: /Export/ }).click()
        ]);
        const name = dl.suggestedFilename();
        ok('filename carries a date and time', /^biopharma_prod_config_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(name), name);
        await dl.saveAs(join(dir, name));
        const payload = JSON.parse(readFileSync(join(dir, name), 'utf8'));
        ok('exported payload is a valid config', typeof payload.version === 'string' && !!payload.database);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

// localStorage has a quota; unbounded quarantine copies could eventually make
// the ordinary autosave fail, losing live work in order to keep stale copies.
scenario('Quarantined autosave backups are capped at three', async ({ page }) => {
    for (let i = 0; i < 5; i++) {
        await page.evaluate(i => {
            localStorage.setItem('BIOPHARMA_AUTOSAVE', `{ not json ${i}`);
        }, i);
        await page.reload();
        await page.waitForSelector('#root h1');
        await page.waitForTimeout(300);
    }
    const backups = await page.evaluate(() => Object.keys(localStorage).filter(k => k.includes('_CORRUPT_')));
    ok('at most three backups retained', backups.length <= 3, `${backups.length}: ${JSON.stringify(backups)}`);
    ok('the newest corrupt payload is among them',
        (await Promise.all(backups.map(k => page.evaluate(x => localStorage.getItem(x), k))))
            .some(v => /not json 4/.test(v || '')));
});

// ------------------------------------------------------------------ runner ---

for (const { name, fn } of scenarios) {
    console.log(`\n${name}`);
    const ctx = await freshPage();
    try {
        await fn(ctx);
    } catch (err) {
        failures++;
        console.log(`  ✗ scenario threw: ${String(err.message).split('\n')[0]}`);
    } finally {
        await ctx.page.close();
    }
}

await browser.close();
console.log(failures === 0 ? '\ne2e: all scenarios passed.\n' : `\ne2e: ${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
