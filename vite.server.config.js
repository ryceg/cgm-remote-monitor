import { defineConfig } from 'vite';
import { resolve } from 'path';
import { spawn } from 'child_process';

let serverProcess = null;

export default defineConfig({
  root: resolve(__dirname),
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Proxy all requests to the Node.js server
      '^(?!/@vite|/node_modules).*': {
        target: 'http://localhost:1337',
        changeOrigin: true,
        configure: () => {
          // Start the Node.js server when the proxy is configured
          if (!serverProcess) {
            console.log('Starting Node.js server...');
            serverProcess = spawn('node', ['--inspect=9229', 'src/lib/server/server.js'], {
              stdio: 'inherit',
              shell: true,
              env: { ...process.env, PORT: '1337' }
            });

            serverProcess.on('error', (err) => {
              console.error('Failed to start server:', err);
            });

            serverProcess.on('exit', (code) => {
              console.log(`Server process exited with code ${code}`);
              serverProcess = null;
            });
          }
        }
      }
    }
  },
  plugins: [
    {
      name: 'server-lifecycle',
      buildStart() {
        // Cleanup on build start
        if (serverProcess) {
          serverProcess.kill();
          serverProcess = null;
        }
      },
      buildEnd() {
        // Cleanup on build end
        if (serverProcess) {
          serverProcess.kill();
          serverProcess = null;
        }
      }
    }
  ]
});
