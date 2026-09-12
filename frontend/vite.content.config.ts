import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Manifest V3 content scripts run as classic scripts, not ES modules, so
// this bundles the ChatGPT content script (and everything it imports,
// including the tokenizer) into one self-contained IIFE file. Built as a
// separate pass from the popup/background config so that config can keep
// emitting plain ES modules.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/chatgpt/index.ts'),
      formats: ['iife'],
      name: 'TokeNitrateContent',
      fileName: () => 'content.js',
    },
  },
})
