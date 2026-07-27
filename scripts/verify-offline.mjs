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
let chromium, executablePath;
try {
    ({ chromium } = await import('playwright'));
    executablePath = [
        '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
        process.env.CHROMIUM_PATH
    ].find(p => p && existsSync(p));
} catch {
    // playwright not installed
}

if (!chromium) {
    console.log('  – skipped (playwright not installed)');
} else {
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
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
