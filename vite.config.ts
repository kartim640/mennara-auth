import path from "node:path"
import { fileURLToPath } from "node:url"

import { defineConfig } from "vite"
import dts from "vite-plugin-dts"

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    dts({
      include: ["src"],
      exclude: ["**/*.test.ts"],
    }),
  ],
  build: {
    lib: {
      entry: {
        index: path.resolve(rootDirectory, "src/index.ts"),
        "identity/index": path.resolve(rootDirectory, "src/identity/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      external: [/^@mennara\//],
    },
    sourcemap: true,
  },
})
