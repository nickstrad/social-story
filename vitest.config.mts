import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          include: ["src/server/**/*.test.ts"],
          environment: "node",
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "client",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["src/server/**"],
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts", "./vitest.setup.client.ts"],
        },
      },
    ],
  },
})
