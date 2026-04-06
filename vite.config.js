import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

function getGitHash() {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch {
    return 'dev';
  }
}

function getSharedSaveRoot() {
  // Check if running from release folder (portable/standalone)
  const releasePattern = /Nebula Havoc-win32-x64[/\\]resources[/\\]app/i;
  const cwd = process.cwd();
  if (releasePattern.test(cwd)) {
    const releasePath = cwd.replace(/[/\\]resources[/\\]app.*/, '');
    return releasePath;
  }
  // Otherwise use Documents
  return path.join(os.homedir(), 'Documents', 'Nebula Havoc');
}

function createExportApiPlugin() {
  return {
    name: 'dev-export-api',
    configureServer(server) {
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.method === 'POST' && req.url === '/api/dev/export-save-file') {
            let body = '';
            req.setEncoding('utf8');
            req.on('data', (chunk) => { body += chunk; });
            req.on('end', async () => {
              try {
                const { filename, content } = JSON.parse(body);
                if (!filename || !content) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ ok: false, error: 'Missing filename or content' }));
                  return;
                }

                const saveDir = path.join(getSharedSaveRoot(), 'save-exports');
                fs.mkdirSync(saveDir, { recursive: true });
                const filePath = path.join(saveDir, filename);
                fs.writeFileSync(filePath, content, 'utf8');
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: true, filePath }));
              } catch (error) {
                console.error('[Dev Export API] Error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: error.message }));
              }
            });
            return;
          }
          next();
        });
      };
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  define: {
    'import.meta.env.VITE_BUILD_HASH': JSON.stringify(getGitHash()),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    createExportApiPlugin(),
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true,
      navigationNotifier: true,
      analyticsTracker: true,
      visualEditAgent: true
    }),
    react(),
  ],
});