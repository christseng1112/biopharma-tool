import { defineConfig } from 'vitest/config';

// Separate from vite.config.js: the build has its root at src/ so that the
// single-file output lands correctly, but tests live at the project root and
// import across src/ and tests/.
export default defineConfig({
    test: {
        include: ['tests/**/*.test.js'],
        environment: 'node'
    }
});
