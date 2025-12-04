#!/usr/bin/env node
/**
 * Bassline HTTP Server CLI
 *
 * Usage:
 *   node bin/server.js [options]
 *
 * Options:
 *   --port, -p     Port to listen on (default: 8080)
 *   --auth, -a     Enable auth with comma-separated tokens
 *   --cell, -c     Pre-populate cells (format: path=value)
 *   --help, -h     Show help
 *
 * Examples:
 *   node bin/server.js
 *   node bin/server.js -p 3000
 *   node bin/server.js -a secret1,secret2
 *   node bin/server.js -c counter=0 -c name=alice
 */

import { createBassline } from '../src/setup.js';

function parseArgs(args) {
  const opts = {
    port: 8080,
    auth: null,
    cells: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
Bassline HTTP Server

Usage: node bin/server.js [options]

Options:
  --port, -p <port>    Port to listen on (default: 8080)
  --auth, -a <tokens>  Enable auth with comma-separated tokens
  --cell, -c <k=v>     Pre-populate a cell (can repeat)
  --help, -h           Show this help

Examples:
  node bin/server.js
  node bin/server.js -p 3000
  node bin/server.js -a secret1,secret2
  node bin/server.js -c counter=0 -c name=alice
  node bin/server.js -p 3000 -a mytoken -c counter=0

curl examples:
  curl http://localhost:8080/bl/cell/counter
  curl -X PUT -d '42' http://localhost:8080/bl/cell/counter
  curl http://localhost:8080/bl/cell/counter?sse=1
`);
      process.exit(0);
    }

    if (arg === '--port' || arg === '-p') {
      opts.port = parseInt(args[++i], 10);
    } else if (arg === '--auth' || arg === '-a') {
      opts.auth = args[++i].split(',');
    } else if (arg === '--cell' || arg === '-c') {
      const [path, ...valueParts] = args[++i].split('=');
      const valueStr = valueParts.join('=');
      let value;
      try {
        value = JSON.parse(valueStr);
      } catch {
        // Try parsing as primitive
        if (valueStr === 'true') value = true;
        else if (valueStr === 'false') value = false;
        else if (valueStr === 'null') value = null;
        else if (/^-?\d+(\.\d+)?$/.test(valueStr)) value = parseFloat(valueStr);
        else value = valueStr;
      }
      opts.cells.push({ path, value });
    }
  }

  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const bl = createBassline();

  // Set up auth tokens if provided
  if (opts.auth) {
    bl.write('bl:///cell/_auth/tokens', opts.auth);
    console.log(`Auth enabled with ${opts.auth.length} token(s)`);
  }

  // Pre-populate cells
  for (const { path, value } of opts.cells) {
    const ref = `bl:///cell/${path}`;
    bl.write(ref, value);
    console.log(`  ${ref} = ${JSON.stringify(value)}`);
  }

  // Start server
  const authParam = opts.auth ? '&auth=true' : '';
  const server = bl.resolve(`bl:///server/http?port=${opts.port}${authParam}`);
  server.write({ action: 'start' });

  console.log(`
Bassline HTTP server running on http://localhost:${opts.port}

Endpoints:
  GET  /bl/cell/<name>       Read a cell
  PUT  /bl/cell/<name>       Write a cell
  GET  /bl/cell/<name>?sse=1 Subscribe to changes (SSE)
  GET  /bl/fold/sum?sources=<refs>  Read a fold

Examples:
  curl http://localhost:${opts.port}/bl/cell/counter
  curl -X PUT -d '42' http://localhost:${opts.port}/bl/cell/counter
${opts.auth ? `  curl -H "Authorization: Bearer ${opts.auth[0]}" http://localhost:${opts.port}/bl/cell/counter` : ''}

Press Ctrl+C to stop
`);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.dispose();
    bl.dispose();
    process.exit(0);
  });
}

main();
