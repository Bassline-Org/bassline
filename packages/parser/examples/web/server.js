#!/usr/bin/env node
/**
 * Simple static file server for the web example
 */

import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..', '..');

const PORT = 8000;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (req, res) => {
  try {
    // Parse URL and remove query string
    let filePath = req.url.split('?')[0];

    // Redirect root to examples/web/
    if (filePath === '/') {
      res.writeHead(302, { 'Location': '/examples/web/' });
      res.end();
      console.log(`↪ ${req.method} ${req.url} -> /examples/web/`);
      return;
    }

    // Default to index.html for directory requests
    if (filePath === '/examples/web' || filePath === '/examples/web/') {
      filePath = '/examples/web/index.html';
    }

    // Build full file path
    const fullPath = join(rootDir, filePath);

    // Read file
    const data = await readFile(fullPath);

    // Get MIME type
    const ext = extname(filePath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);

    console.log(`✓ ${req.method} ${req.url}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      res.writeHead(404);
      res.end('404 Not Found');
      console.log(`✗ ${req.method} ${req.url} - 404`);
    } else {
      res.writeHead(500);
      res.end('500 Internal Server Error');
      console.error(`✗ ${req.method} ${req.url} - Error:`, error.message);
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}/`);
  console.log(`📂 Serving files from: ${rootDir}`);
  console.log(`\n👉 Open: http://localhost:${PORT}/examples/web/\n`);
});
