import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: {
    rolldownOptions: {
      // Radix/motion ship "use client" directives; harmless in a client bundle.
      onwarn(warning, warn) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') warn(warning)
      },
    },
  },
  plugins: [
    // PGlite loads WASM/data files at runtime: keep it external and copy the
    // whole package into .output (`pkg*` = full trace).
    nitro({
      traceDeps: ['@electric-sql/pglite*', 'pg'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})
