import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * The tool is distributed as one HTML file that operators open directly from a
 * network share — often on machines with no internet access. viteSingleFile
 * inlines every asset so the build output has zero external requests, and
 * `npm run build` copies it to ./index.html (see scripts/publish.mjs).
 */
export default defineConfig({
    root: 'src',
    plugins: [react(), viteSingleFile()],
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        // Inline everything; nothing may be emitted as a separate file.
        assetsInlineLimit: 100 * 1024 * 1024,
        cssCodeSplit: false,
        // The file is opened via file:// as well as http://, so keep the output
        // conservative rather than relying on modern module loading.
        target: 'es2019',
        rollupOptions: {
            output: { inlineDynamicImports: true }
        }
    }
});
