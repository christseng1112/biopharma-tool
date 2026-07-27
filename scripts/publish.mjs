import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Copies the single-file build to ./index.html — the file that is actually
// distributed, and the one committed to the repository. Kept CRLF to match
// .gitattributes so the published artifact stays byte-stable.

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, 'dist', 'index.html');
const target = join(root, 'index.html');

if (!existsSync(built)) {
    console.error(`publish: ${built} not found — run "vite build" first.`);
    process.exit(1);
}

let html = readFileSync(built, 'utf8');

// Attribute references, CSS url()/@import, and single-quoted variants all
// reach the network. Checking only double-quoted src/href left CSS able to
// pull in a remote font or image without the guard noticing.
const external = [
    ...html.matchAll(/(?:src|href)\s*=\s*["'](?:https?:)?\/\/[^"']+["']/gi),
    ...html.matchAll(/url\(\s*["']?(?:https?:)?\/\/[^)]+\)/gi),
    ...html.matchAll(/@import\s+(?:url\()?\s*["'](?:https?:)?\/\/[^"']+["']/gi)
].map(m => m[0]);

if (external.length > 0) {
    console.error('publish: build still references external resources, refusing to publish:');
    external.forEach(e => console.error('  ' + e));
    process.exit(1);
}

html = html.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
writeFileSync(target, html, 'utf8');

console.log(`publish: wrote index.html (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB, no external requests)`);
