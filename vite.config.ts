/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { blog } from './scripts/vite-plugin-blog.ts'

const apiPort = process.env.API_PORT ?? '8787'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), blog()],
  build: {
    // The blog post page carries the Markdown renderer with maths typesetting (KaTeX), about 500 kB;
    // it's only loaded when a post is opened.
    chunkSizeWarningLimit: 600,
  },
  server: {
    proxy: {
      '/api': `http://localhost:${apiPort}`,
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'server/**/*.test.ts', 'shared/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
