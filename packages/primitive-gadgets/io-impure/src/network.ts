/**
 * Network primitive gadgets
 * These are impure gadgets that perform network I/O operations
 */

import type { PrimitiveGadget } from '@bassline/core'

export function httpFetch(): PrimitiveGadget {
  return {
    id: 'http-fetch',
    name: 'HTTP Fetch',
    inputs: ['url', 'method', 'headers', 'body', 'trigger'],
    outputs: ['response', 'status', 'headers', 'error'],
    activation: (inputs) => inputs.has('url') && inputs.has('trigger'),
    body: async (inputs) => {
      const url = String(inputs.get('url'))
      const method = inputs.get('method') as string || 'GET'
      const headers = inputs.get('headers') as Record<string, string> || {}
      const body = inputs.get('body')
      
      try {
        const options: RequestInit = {
          method,
          headers
        }
        
        if (body !== undefined && method !== 'GET' && method !== 'HEAD') {
          options.body = typeof body === 'string' ? body : JSON.stringify(body)
        }
        
        const response = await fetch(url, options)
        
        const contentType = response.headers.get('content-type') || ''
        let responseData
        
        if (contentType.includes('application/json')) {
          responseData = await response.json()
        } else if (contentType.includes('text/')) {
          responseData = await response.text()
        } else {
          // For binary data, return as base64
          const buffer = await response.arrayBuffer()
          responseData = Buffer.from(buffer).toString('base64')
        }
        
        // Convert headers to plain object
        const responseHeaders: Record<string, string> = {}
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value
        })
        
        return new Map([
          ['response', responseData],
          ['status', response.status],
          ['headers', responseHeaders],
          ['error', response.ok ? null : `HTTP ${response.status}`]
        ])
      } catch (error) {
        return new Map([
          ['response', null],
          ['status', 0],
          ['headers', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Performs HTTP requests',
    category: 'io',
    isPure: false
  }
}

export function httpPost(): PrimitiveGadget {
  return {
    id: 'http-post',
    name: 'HTTP POST',
    inputs: ['url', 'data', 'headers', 'trigger'],
    outputs: ['response', 'status', 'error'],
    activation: (inputs) => inputs.has('url') && inputs.has('data') && inputs.has('trigger'),
    body: async (inputs) => {
      const url = String(inputs.get('url'))
      const data = inputs.get('data')
      const headers = inputs.get('headers') as Record<string, string> || {}
      
      try {
        const isJson = !headers['content-type'] || headers['content-type'].includes('json')
        
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': isJson ? 'application/json' : headers['content-type'],
            ...headers
          },
          body: isJson ? JSON.stringify(data) : String(data)
        })
        
        const contentType = response.headers.get('content-type') || ''
        let responseData
        
        if (contentType.includes('application/json')) {
          responseData = await response.json()
        } else {
          responseData = await response.text()
        }
        
        return new Map([
          ['response', responseData],
          ['status', response.status],
          ['error', response.ok ? null : `HTTP ${response.status}`]
        ])
      } catch (error) {
        return new Map([
          ['response', null],
          ['status', 0],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Performs HTTP POST requests',
    category: 'io',
    isPure: false
  }
}

export function httpGet(): PrimitiveGadget {
  return {
    id: 'http-get',
    name: 'HTTP GET',
    inputs: ['url', 'headers', 'trigger'],
    outputs: ['response', 'status', 'error'],
    activation: (inputs) => inputs.has('url') && inputs.has('trigger'),
    body: async (inputs) => {
      const url = String(inputs.get('url'))
      const headers = inputs.get('headers') as Record<string, string> || {}
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers
        })
        
        const contentType = response.headers.get('content-type') || ''
        let responseData
        
        if (contentType.includes('application/json')) {
          responseData = await response.json()
        } else {
          responseData = await response.text()
        }
        
        return new Map([
          ['response', responseData],
          ['status', response.status],
          ['error', response.ok ? null : `HTTP ${response.status}`]
        ])
      } catch (error) {
        return new Map([
          ['response', null],
          ['status', 0],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Performs HTTP GET requests',
    category: 'io',
    isPure: false
  }
}

export function websocket(): PrimitiveGadget {
  return {
    id: 'websocket',
    name: 'WebSocket',
    inputs: ['url', 'message', 'connect', 'disconnect'],
    outputs: ['received', 'connected', 'error'],
    activation: (inputs) => inputs.has('url') && (inputs.has('connect') || inputs.has('message')),
    body: async (inputs) => {
      // Note: This is a simplified implementation
      // Real WebSocket support would require special runtime handling
      // to manage connection lifecycle and message streams
      
      const url = String(inputs.get('url'))
      const message = inputs.get('message')
      const connect = Boolean(inputs.get('connect'))
      const disconnect = Boolean(inputs.get('disconnect'))
      
      return new Map([
        ['received', null],
        ['connected', false],
        ['error', 'WebSocket requires special runtime support for persistent connections']
      ])
    },
    description: 'WebSocket connection (requires runtime support)',
    category: 'io',
    isPure: false
  }
}

export function graphql(): PrimitiveGadget {
  return {
    id: 'graphql',
    name: 'GraphQL Query',
    inputs: ['url', 'query', 'variables', 'headers', 'trigger'],
    outputs: ['data', 'errors', 'status', 'error'],
    activation: (inputs) => inputs.has('url') && inputs.has('query') && inputs.has('trigger'),
    body: async (inputs) => {
      const url = String(inputs.get('url'))
      const query = String(inputs.get('query'))
      const variables = inputs.get('variables') || {}
      const headers = inputs.get('headers') as Record<string, string> || {}
      
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: JSON.stringify({
            query,
            variables
          })
        })
        
        const result = await response.json() as any
        
        return new Map([
          ['data', result.data || null],
          ['errors', result.errors || null],
          ['status', response.status],
          ['error', response.ok ? null : `HTTP ${response.status}`]
        ])
      } catch (error) {
        return new Map([
          ['data', null],
          ['errors', null],
          ['status', 0],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Executes GraphQL queries',
    category: 'io',
    isPure: false
  }
}