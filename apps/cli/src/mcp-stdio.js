#!/usr/bin/env node
/**
 * MCP stdio server for Bassline.
 *
 * Loads a blit using createBlits() and exposes the `bl` tool.
 * Also provides Ollama service at /ollama/*.
 *
 * Environment:
 *   BL_BLIT - Path to blit file (default: ~/.bassline/default.blit)
 *   OLLAMA_BASE_URL - Ollama server URL (default: http://localhost:11434)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { homedir } from 'node:os'
import { mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { routes } from '@bassline/core'
import { createBlits } from '@bassline/blit'
import { createOllama, createSlurp, createBarf } from '@bassline/services'

const blitPath = process.env.BL_BLIT || join(homedir(), '.bassline', 'default.blit')

// Ensure directory exists
const dir = blitPath.substring(0, blitPath.lastIndexOf('/'))
if (dir && !existsSync(dir)) {
  mkdirSync(dir, { recursive: true })
}

// Create services
const ollama = createOllama()
const slurp = createSlurp()
const barf = createBarf()

// Create blits manager
const blits = createBlits()

// Load the default blit
await blits.put({ path: '/app' }, { path: blitPath })

// Wrap blits to forward to /app
const blitKit = {
  get: h => blits.get({ ...h, path: '/app' + h.path }),
  put: (h, body) => blits.put({ ...h, path: '/app' + h.path }, body),
}

// Composite kit: services + blit
const kit = routes({
  ollama,
  slurp,
  barf,
  unknown: blitKit,
})

// Tool definition
const BL_TOOL = {
  name: 'bl',
  description: `Interact with Bassline resources using the native protocol.

Use GET {path:"/"} to explore available resources.
Use GET {path:"/guide"} to learn how the system works.

Key paths:
- /cells/* - Lattice-based state (monotonic merge)
- /store/* - Key/value storage
- /fn/* - Stored functions
- /tcl/eval - Evaluate TCL scripts (persistent state)
- /guide - System documentation (readable and writable)
- /ollama/* - Local LLM via Ollama (chat, generate, models)
- /slurp - Fetch from URI (http, file) via GET with uri header
- /barf - Write to URI (http, file) via PUT with uri header

Headers control routing and behavior. Common headers:
- path: Resource path (required)
- uri: For slurp/barf, the target URI (e.g., "https://example.com")
- type: Content type hint (e.g., "json", "text", "tcl/dict")`,
  inputSchema: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['get', 'put'],
        description: 'HTTP-like method: get to read, put to write',
      },
      headers: {
        type: 'object',
        description: 'Request headers including path',
        properties: {
          path: { type: 'string', description: 'Resource path (e.g., /cells/counter)' },
          type: { type: 'string', description: 'Content type for body (e.g., tcl/dict, js/num)' },
        },
        required: ['path'],
      },
      body: {
        description: 'Body for PUT requests (string, object, or array)',
      },
    },
    required: ['method', 'headers'],
  },
}

// Create MCP server
const server = new Server({ name: 'bassline', version: '1.0.0' }, { capabilities: { tools: {} } })

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [BL_TOOL],
}))

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args } = request.params

  if (name !== 'bl') {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
      isError: true,
    }
  }

  try {
    const { method, headers, body } = args
    const result = method === 'get' ? await kit.get(headers) : await kit.put(headers, body)
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    }
  } catch (err) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }],
      isError: true,
    }
  }
})

// Start server
const transport = new StdioServerTransport()
await server.connect(transport)
