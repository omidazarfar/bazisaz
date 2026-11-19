import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Two separate builds, each one self-contained HTML file:
//   vite build                 → dist/index.html          the player (wrapped into the APK)
//   vite build --mode editor   → dist-editor/editor.html  the editor
// They are built separately because a single-file build can only inline one page.
export default defineConfig(({ mode }) => {
  const editor = mode === 'editor';
  return {
    plugins: [react(), viteSingleFile()],
    build: {
      target: 'es2022',
      assetsInlineLimit: 100_000_000,
      outDir: editor ? 'dist-editor' : 'dist',
      rollupOptions: { input: editor ? 'editor.html' : 'index.html' },
    },
  };
});
