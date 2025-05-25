import { defineConfig } from "vite";
import commonjs from "vite-plugin-commonjs";
import inject from "@rollup/plugin-inject";
import { resolve } from "path";

const isDevelopment = process.env.NODE_ENV === "development";

export default defineConfig({
  root: resolve(__dirname, "bundle"),
  appType: "mpa",
  publicDir: "public",  build: {
    sourcemap: true,
    minify: !isDevelopment,
    outDir: resolve(__dirname, "../dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      input: {
        profile: resolve(__dirname, "bundle/profile/index.html"),
        food: resolve(__dirname, "bundle/food/index.html"),
        admin: resolve(__dirname, "bundle/admin/index.html"),
        report: resolve(__dirname, "bundle/report/index.html"),
        clock: resolve(__dirname, "bundle/clock/index.html"),
        main: resolve(__dirname, "bundle/index.html"),
      },
      output: {
        manualChunks: undefined,
      },
    },
    target: "es2015",
    commonjsOptions: {
      transformMixedEsModules: true,
      defaultIsModuleExports: true,
    },
  },
  define: {
    global: "window",
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV ?? "production",
    ),
  },
  assetsInclude: ["**/*.jpg", "**/*.png", "**/*.gif"],
  plugins: [
    commonjs(),
    inject({
      $: "jquery",
      jQuery: "jquery",
    }),
  ],
  resolve: {
    alias: {
      '@utils': resolve(__dirname, 'lib/utils'),
      '@dayjs': resolve(__dirname, 'lib/utils/dayjs'),
      '@consts': resolve(__dirname, 'lib/constants'),
      '@language': resolve(__dirname, 'lib/language'),
      stream: "stream-browserify",
    },
  },
  optimizeDeps: {
    include: ["jquery-ui", "d3"],
  },
  server: {
    hmr: true,
    proxy: {
      '/api/v1': { // Changed from '/api/' to be specific for /api/v1 paths
        target: 'http://localhost:1337',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1/, ''), // Strips /api/v1 prefix
      },
      '/api2/': {
        target: 'http://localhost:1337',
        changeOrigin: true,
        // If /api2/* paths also need rewriting to remove the /api2 prefix, add:
        // rewrite: (path) => path.replace(/^\/api2/, ''),
      },
      '/api3/': {
        target: 'http://localhost:1337',
        changeOrigin: true,
        // If /api3/* paths also need rewriting to remove the /api3 prefix, add:
        // rewrite: (path) => path.replace(/^\/api3/, ''),
      }
      // If you had other paths starting with /api/ (but not /api/v1, /api2, or /api3)
      // that were handled by the previous generic '/api/' rule,
      // you might need to add a separate rule for them.
    }
  },
});
