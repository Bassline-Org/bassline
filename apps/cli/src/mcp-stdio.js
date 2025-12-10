#!/usr/bin/env node
/**
 * MCP (Model Context Protocol) stdio server for Bassline.
 *
 * This connects to a running Bassline daemon via HTTP and exposes
 * its capabilities as MCP tools that Claude Code can use.
 *
 * Usage:
 *   BL_URL=http://localhost:9111 node mcp-stdio.js
 *
 * Configure in .mcp.json or via Claude Code:
 *   claude mcp add bassline --command "node /path/to/mcp-stdio.js"
 */

import { createInterface } from 'readline'

const BL_URL = process.env.BL_URL || 'http://localhost:9111'

// MCP tool definitions
const TOOLS = [
  {
    name: 'bassline_get',
    description: 'Get a resource from Bassline by URI. Returns the resource headers and body. Common URIs: bl:///cells (list cells), bl:///data (list data), bl:///propagators (list propagators), bl:///types (list types), bl:///links (list link queries).',
    inputSchema: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description: 'Resource URI (e.g., bl:///cells/counter, bl:///data/users, bl:///types)'
        }
      },
      required: ['uri']
    }
  },
  {
    name: 'bassline_put',
    description: 'Put/update a resource in Bassline. For cells, use bl:///cells/<name> with body {lattice: "maxNumber"|"minNumber"|"setUnion"|"lww"}. For cell values, use bl:///cells/<name>/value with the value as body.',
    inputSchema: {
      type: 'object',
      properties: {
        uri: {
          type: 'string',
          description: 'Resource URI'
        },
        body: {
          description: 'Resource body (any JSON value)'
        }
      },
      required: ['uri', 'body']
    }
  },
  {
    name: 'bassline_list',
    description: 'List resources at a path. Shorthand for GET on directory-like resources.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Path to list (e.g., cells, data, data/users, propagators, types)'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'bassline_links',
    description: 'Query links to or from a resource. Use "to" for backlinks (what references this?), "from" for forward refs (what does this reference?).',
    inputSchema: {
      type: 'object',
      properties: {
        direction: {
          type: 'string',
          enum: ['to', 'from'],
          description: 'Link direction: "to" for backlinks, "from" for forward refs'
        },
        uri: {
          type: 'string',
          description: 'Resource URI to query links for'
        }
      },
      required: ['direction', 'uri']
    }
  }
]

// HTTP client for Bassline daemon
async function blGet(uri) {
  const res = await fetch(`${BL_URL}?uri=${encodeURIComponent(uri)}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GET ${uri} failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function blPut(uri, body) {
  const res = await fetch(`${BL_URL}?uri=${encodeURIComponent(uri)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PUT ${uri} failed: ${res.status} ${text}`)
  }
  return res.json()
}

// Tool handlers
const handlers = {
  async bassline_get({ uri }) {
    try {
      const result = await blGet(uri)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },

  async bassline_put({ uri, body }) {
    try {
      const result = await blPut(uri, body)
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },

  async bassline_list({ path }) {
    try {
      const uri = `bl:///${path.replace(/^\//, '')}`
      const result = await blGet(uri)
      const entries = result.body?.entries || result.body
      return { content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  },

  async bassline_links({ direction, uri }) {
    try {
      const path = uri.replace('bl:///', '')
      const linksUri = `bl:///links/${direction}/${path}`
      const result = await blGet(linksUri)
      return { content: [{ type: 'text', text: JSON.stringify(result.body, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }
    }
  }
}

// MCP protocol handler
function handleRequest(request) {
  const { method, params, id } = request

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'bassline',
            version: '1.0.0'
          }
        }
      }

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      }

    case 'tools/call':
      // Handle async tool calls
      return handleToolCall(params, id)

    case 'notifications/initialized':
    case 'notifications/cancelled':
      // No response needed for notifications
      return null

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      }
  }
}

async function handleToolCall(params, id) {
  const { name, arguments: args } = params
  const handler = handlers[name]

  if (!handler) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32602,
        message: `Unknown tool: ${name}`
      }
    }
  }

  try {
    const result = await handler(args || {})
    return {
      jsonrpc: '2.0',
      id,
      result
    }
  } catch (err) {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        content: [{ type: 'text', text: `Error: ${err.message}` }],
        isError: true
      }
    }
  }
}

// Main: Read JSON-RPC from stdin, write responses to stdout
async function main() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  })

  // Log to stderr so it doesn't interfere with MCP protocol
  const log = (...args) => console.error('[bassline-mcp]', ...args)

  log(`Starting MCP server, connecting to ${BL_URL}`)

  rl.on('line', async (line) => {
    if (!line.trim()) return

    try {
      const request = JSON.parse(line)
      log('Request:', request.method, request.id || '(notification)')

      const response = await handleRequest(request)

      if (response) {
        const responseStr = JSON.stringify(response)
        log('Response:', responseStr.slice(0, 100) + (responseStr.length > 100 ? '...' : ''))
        console.log(responseStr)
      }
    } catch (err) {
      log('Parse error:', err.message)
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }))
    }
  })

  rl.on('close', () => {
    log('Connection closed')
    process.exit(0)
  })
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
