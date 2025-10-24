import { defineConfig } from "tsup";

export default defineConfig([
  // UI bundle
  {
    entry: {
      ui: "src/ui/CallModal.tsx",
      provider: "src/ui/MeetingProvider.tsx",
      index: "src/index.ts",
    },
    format: ["esm"],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    skipNodeModulesBundle: true,
    tsconfig: "tsconfig.ui.json",
  },

  // Server bundle
  {
    entry: {
      server: "src/server/router.ts",
    },
    format: ["esm"],
    platform: "node",
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
    skipNodeModulesBundle: true,
    tsconfig: "tsconfig.server.json",
  },
]);
