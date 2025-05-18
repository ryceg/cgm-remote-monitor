import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from my.test.env
dotenv.config({ path: path.resolve(__dirname, 'my.test.env') });

export default defineConfig({
  test: {
    globals: true, // Use Vitest global APIs
    environment: 'jsdom', // Or 'node' if your tests don't need a browser-like environment
    setupFiles: [], // Add global setup files if needed, e.g., for polyfills or global mocks
    // You can define global variables or mocks here if needed
    // globalSetup: './tests/globalSetup.js', // Example for a global setup script
  },
});
