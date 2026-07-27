/**
 * Verifies that the published index.html is genuinely self-contained.
 *
 * The tool's whole premise is that it can be copied to a workstation with no
 * internet access and opened. That premise was untrue for a long time — every
 * dependency came from a CDN and the page rendered blank offline — so it is
 * checked here rather than assumed.
 *
 * Static checks always run. The render check runs when Playwright and a
 * Chromium binary are available, and is skipped (not failed) otherwise.
 */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'index.html');

let failures = 0;
const check = (name, ok, detail) => {
    console.log(`  ${ok ? '✓' : '✗'} ${name}${ok || !detail ? '' : `\n      ${detail}`}`);
    if (!ok) failures++;
};

if (!existsSync(target)) {
    console.error('index.html not found — run "npm run build" first.');
    process.exit(1);
}
const html = readFileSync(target, 'utf8');

console.log('\nStatic checks');
const external = [...html.matchAll(/(?:src|href)\s*=\s*"(?:https?:)?\/\/[^"]*"/g)].map(m => m[0]);
check('no external src/href references', external.length === 0, external.join('\n      '));

const fetches = [...html.matchAll(/(?:fetch|XMLHttpRequest|importScripts)\s*\(\s*["'](?:https?:)?\/\//g)];
check('no runtime requests to remote hosts', fetches.length === 0);

check('React is the production build', !/Each child in a list should have a unique/.test(html));
check('no Babel standalone in the page', !/@babel\/standalone|babel\.min\.js/.test(html));
check('no Font Awesome class usage', !/class(Name)?="[^"]*\bfa[srlbd]?\b[^"]*"/.test(html));
check('stylesheet is inlined', /<style>/.test(html));
check('script is inlined', /<script[^>]*>[\s\S]{1000,}<\/script>/.test(html));

console.log(`\n  index.html is ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);

console.log('\nRender check (offline, file://)');

/**
 * Launch a browser, or return null if none is usable.
 *
 * Installing the playwright package does not download a browser binary, so
 * "playwright is importable" is not the same as "a browser can start". The
 * check is skipped rather than failed when no browser is available — the
 * static checks above are the ones that must always hold, and failing the
 * whole run because a developer has not fetched a 150 MB Chromium would make
 * `npm run check` useless on a fresh machine.
 */
const launchBrowser = async () => {
    let chromium;
    try {
        ({ chromium } = await import('playwright'));
    } catch {
        return { browser: null, reason: 'playwright is not installed' };
    }

    // Prefer a system/preinstalled Chromium when one is present.
    const executablePath = [
        process.env.CHROMIUM_PATH,
        '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    ].find(p => p && existsSync(p));

    try {
        const browser = await chromium.launch(executablePath ? { executablePath } : {});
        return { browser, reason: null };
    } catch (err) {
        const detail = String(err.message).split('\n')[0];
        return { browser: null, reason: `no usable browser (${detail})` };
    }
};

const { browser, reason } = await launchBrowser();

if (!browser) {
    console.log(`  – skipped: ${reason}`);
    console.log('    run "npx playwright install chromium" to enable this check');
} else {
    const page = await browser.newPage();
    const requests = [];
    const errors = [];
    page.on('request', r => requests.push(r.url()));
    page.on('pageerror', e => errors.push(String(e.message)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    // Block everything that is not the file itself: this is the closed-network case.
    await page.route('**/*', route => {
        route.request().url().startsWith('file://') ? route.continue() : route.abort();
    });

    await page.goto(pathToFileURL(target).href);
    let mounted = true;
    try {
        await page.waitForSelector('#root h1', { timeout: 20000 });
    } catch {
        mounted = false;
    }

    check('app mounts with all non-file requests blocked', mounted);
    check('only the html file is requested', requests.every(u => u.startsWith('file://')),
        requests.filter(u => !u.startsWith('file://')).join('\n      '));
    check('no page errors', errors.length === 0, errors.join('\n      '));

    if (mounted) {
        for (const tab of ['Picking List', 'Assembly Guide', 'Autoclave Calc', 'Database']) {
            await page.getByRole('button', { name: new RegExp(tab) }).click();
            await page.waitForTimeout(400);
            const body = await page.textContent('#root');
            check(`${tab} tab renders`, body.length > 200);
        }
        check('no page errors after visiting every tab', errors.length === 0, errors.join('\n      '));
    }

    await browser.close();
}

console.log(failures === 0 ? '\nOffline verification passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
