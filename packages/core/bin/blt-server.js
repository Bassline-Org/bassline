#!/usr/bin/env node
/**
 * Bassline BL/T Server CLI
 *
 * A TCP server that speaks the BL/T (Bassline Text) protocol.
 * Connect with netcat, telnet, or any TCP client.
 *
 * Usage:
 *   node bin/blt-server.js [options]
 *
 * Options:
 *   --port, -p     Port to listen on (default: 9000)
 *   --cell, -c     Pre-populate cells (format: path=value)
 *   --help, -h     Show help
 *
 * Examples:
 *   node bin/blt-server.js
 *   node bin/blt-server.js -p 9001
 *   node bin/blt-server.js -c counter=0 -c name=alice
 *
 * Connect with netcat:
 *   nc localhost 9000
 *   VERSION BL/1.0
 *   READ bl:///cell/counter
 */

import { createBassline } from '../src/setup.js';

function parseArgs(args) {
  const opts = {
    port: 9000,
    cells: []
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
Bassline BL/T Server

A TCP server that speaks the BL/T (Bassline Text) protocol.
Connect with netcat, telnet, or any TCP client.

Usage: node bin/blt-server.js [options]

Options:
  --port, -p <port>    Port to listen on (default: 9000)
  --cell, -c <k=v>     Pre-populate a cell (can repeat)
  --help, -h           Show this help

Examples:
  node bin/blt-server.js
  node bin/blt-server.js -p 9001
  node bin/blt-server.js -c counter=0 -c name=alice

Protocol (BL/T):
  VERSION BL/1.0              Negotiate protocol version
  READ bl:///cell/counter     Read a value
  WRITE bl:///cell/counter 42 Write a value
  SUBSCRIBE bl:///cell/counter Subscribe to changes
  UNSUBSCRIBE s1              Unsubscribe from a stream
  INFO bl:///cell/counter     Get mirror capabilities

Responses:
  OK [value]                  Success
  ERROR code message          Failure
  STREAM id                   Subscription created
  EVENT stream value          Value changed

netcat session:
  $ nc localhost 9000
  VERSION BL/1.0
  VERSION BL/1.0
  WRITE bl:///cell/x 42
  OK
  READ bl:///cell/x
  OK 42
  INFO bl:///cell/x
  OK {"readable":true,"writable":true,"ordering":"causal"}
`);
      process.exit(0);
    }

    if (arg === '--port' || arg === '-p') {
      opts.port = parseInt(args[++i], 10);
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

  // Pre-populate cells
  for (const { path, value } of opts.cells) {
    const ref = `bl:///cell/${path}`;
    bl.write(ref, value);
    console.log(`  ${ref} = ${JSON.stringify(value)}`);
  }

  // Start server
  const server = bl.resolve(`bl:///server/tcp?port=${opts.port}`);
  server.write({ action: 'start' });

  console.log(`
Bassline BL/T server running on tcp://localhost:${opts.port}

Connect with netcat:
  nc localhost ${opts.port}

Example session:
  VERSION BL/1.0
  VERSION BL/1.0
  WRITE bl:///cell/counter 0
  OK
  READ bl:///cell/counter
  OK 0
  SUBSCRIBE bl:///cell/counter
  EVENT s1 0
  STREAM s1

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
