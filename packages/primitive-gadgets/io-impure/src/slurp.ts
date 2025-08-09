/**
 * Polymorphic slurp gadget - inspired by Clojure
 * Reads data from various sources based on the URL scheme
 */

import type { PrimitiveGadget } from '@bassline/core'
import * as fs from 'fs/promises'
import * as path from 'path'

export function slurp(): PrimitiveGadget {
  return {
    id: 'slurp',
    name: 'Slurp',
    inputs: ['source', 'encoding', 'trigger'],
    outputs: ['content', 'error'],
    activation: (inputs) => inputs.has('source') && inputs.has('trigger'),
    body: async (inputs) => {
      const source = String(inputs.get('source'))
      const encoding = inputs.get('encoding') as BufferEncoding | undefined
      
      try {
        // Determine source type by URL scheme or pattern
        if (source.startsWith('http://') || source.startsWith('https://')) {
          // HTTP/HTTPS source
          const response = await fetch(source)
          
          if (!response.ok) {
            return new Map([
              ['content', null],
              ['error', `HTTP ${response.status}: ${response.statusText}`]
            ])
          }
          
          const contentType = response.headers.get('content-type') || ''
          let content
          
          if (contentType.includes('application/json')) {
            content = await response.json()
          } else {
            content = await response.text()
          }
          
          return new Map([
            ['content', content],
            ['error', null]
          ])
        } else if (source.startsWith('file://')) {
          // File URL
          const filePath = source.slice(7) // Remove 'file://' prefix
          const content = await fs.readFile(filePath, encoding || 'utf-8')
          
          return new Map([
            ['content', content],
            ['error', null]
          ])
        } else if (source.startsWith('data:')) {
          // Data URL
          const [header, data] = source.split(',')
          const isBase64 = header.includes('base64')
          
          let content
          if (isBase64) {
            content = Buffer.from(data, 'base64').toString(encoding || 'utf-8')
          } else {
            content = decodeURIComponent(data)
          }
          
          return new Map([
            ['content', content],
            ['error', null]
          ])
        } else if (source.startsWith('/') || source.includes(path.sep) || /^[A-Za-z]:/.test(source)) {
          // Local file path (absolute or contains path separator or Windows drive letter)
          const content = await fs.readFile(source, encoding || 'utf-8')
          
          // Try to parse JSON if it looks like JSON
          if (source.endsWith('.json')) {
            try {
              return new Map([
                ['content', JSON.parse(content as string)],
                ['error', null]
              ])
            } catch {
              // If JSON parsing fails, return as string
              return new Map([
                ['content', content],
                ['error', null]
              ])
            }
          }
          
          return new Map([
            ['content', content],
            ['error', null]
          ])
        } else {
          // Unknown source type
          return new Map([
            ['content', null],
            ['error', `Unknown source type for: ${source}`]
          ])
        }
      } catch (error) {
        return new Map([
          ['content', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Reads content from various sources (files, HTTP, data URLs)',
    category: 'io',
    isPure: false
  }
}

export function spit(): PrimitiveGadget {
  return {
    id: 'spit',
    name: 'Spit',
    inputs: ['destination', 'content', 'encoding', 'trigger'],
    outputs: ['success', 'error'],
    activation: (inputs) => inputs.has('destination') && inputs.has('content') && inputs.has('trigger'),
    body: async (inputs) => {
      const destination = String(inputs.get('destination'))
      const content = inputs.get('content')
      const encoding = inputs.get('encoding') as BufferEncoding | undefined
      
      try {
        // Determine destination type
        if (destination.startsWith('http://') || destination.startsWith('https://')) {
          // HTTP POST
          const response = await fetch(destination, {
            method: 'POST',
            headers: {
              'Content-Type': typeof content === 'object' ? 'application/json' : 'text/plain'
            },
            body: typeof content === 'object' ? JSON.stringify(content) : String(content)
          })
          
          return new Map([
            ['success', response.ok],
            ['error', response.ok ? null : `HTTP ${response.status}: ${response.statusText}`]
          ])
        } else if (destination.startsWith('file://')) {
          // File URL
          const filePath = destination.slice(7)
          const dir = path.dirname(filePath)
          await fs.mkdir(dir, { recursive: true })
          
          const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content)
          await fs.writeFile(filePath, data, encoding || 'utf-8')
          
          return new Map([
            ['success', true],
            ['error', null]
          ])
        } else if (destination.startsWith('/') || destination.includes(path.sep) || /^[A-Za-z]:/.test(destination)) {
          // Local file path
          const dir = path.dirname(destination)
          await fs.mkdir(dir, { recursive: true })
          
          const data = typeof content === 'object' ? JSON.stringify(content, null, 2) : String(content)
          await fs.writeFile(destination, data, encoding || 'utf-8')
          
          return new Map([
            ['success', true],
            ['error', null]
          ])
        } else {
          return new Map([
            ['success', false],
            ['error', `Unknown destination type for: ${destination}`]
          ])
        }
      } catch (error) {
        return new Map([
          ['success', false],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Writes content to various destinations (files, HTTP)',
    category: 'io',
    isPure: false
  }
}