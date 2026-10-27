import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const ALLOWED = ['archive/', 'data/', 'methodology/'];
const TYPES: Record<string, string> = {
  '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.webm': 'video/webm',
  '.html': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

// Serves study data from the repo root under /files/ (archive crops, instances, taxonomy),
// limited to the data folders so the dev server never exposes anything else.
function repoFiles(): Plugin {
  return {
    name: 'repo-files',
    configureServer(server) {
      server.middlewares.use('/files', (req, res, next) => {
        const rel = decodeURIComponent((req.url ?? '').split('?')[0]).replace(/^\/+/, '');
        const file = path.resolve(ROOT, rel);
        if (!ALLOWED.some((a) => rel.startsWith(a)) || !file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
        res.setHeader('Content-Type', TYPES[path.extname(file)] ?? 'application/octet-stream');
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig({
  root: __dirname,
  plugins: [react(), repoFiles()],
  server: { port: 5178 },
});
