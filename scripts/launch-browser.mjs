import { existsSync } from 'node:fs';

/**
 * Launch a Playwright Chromium, or explain why one cannot start.
 *
 * Shared by verify-offline.mjs and the e2e runner. Installing the playwright
 * package does not download a browser binary, so "playwright is importable"
 * is not the same as "a browser can start" — callers treat a null browser as
 * a skip, never as a failure, and print `reason` with the fix.
 */
export const launchBrowser = async () => {
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

export const SKIP_HINT = 'run "npx playwright install chromium" to enable this check';
