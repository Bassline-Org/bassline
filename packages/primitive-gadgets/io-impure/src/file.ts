/**
 * File system primitive gadgets
 * These are impure gadgets that perform file I/O operations
 */

import type { PrimitiveGadget } from '@bassline/core'
import * as fs from 'fs/promises'
import * as path from 'path'
import { watch } from 'chokidar'

export function fileRead(): PrimitiveGadget {
  return {
    id: 'file-read',
    name: 'File Read',
    inputs: ['path', 'encoding'],
    outputs: ['content', 'error'],
    activation: (inputs) => inputs.has('path'),
    body: async (inputs) => {
      const filePath = String(inputs.get('path'))
      const encoding = inputs.get('encoding') as BufferEncoding | undefined
      
      try {
        const content = await fs.readFile(filePath, encoding || 'utf-8')
        return new Map([
          ['content', content],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['content', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Reads content from a file',
    category: 'io',
    isPure: false
  }
}

export function fileWrite(): PrimitiveGadget {
  return {
    id: 'file-write',
    name: 'File Write',
    inputs: ['path', 'content', 'encoding'],
    outputs: ['success', 'error'],
    activation: (inputs) => inputs.has('path') && inputs.has('content'),
    body: async (inputs) => {
      const filePath = String(inputs.get('path'))
      const content = inputs.get('content')
      const encoding = inputs.get('encoding') as BufferEncoding | undefined
      
      try {
        // Ensure directory exists
        const dir = path.dirname(filePath)
        await fs.mkdir(dir, { recursive: true })
        
        // Write file
        await fs.writeFile(filePath, String(content), encoding || 'utf-8')
        return new Map([
          ['success', true],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['success', false],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Writes content to a file',
    category: 'io',
    isPure: false
  }
}

export function fileAppend(): PrimitiveGadget {
  return {
    id: 'file-append',
    name: 'File Append',
    inputs: ['path', 'content', 'encoding'],
    outputs: ['success', 'error'],
    activation: (inputs) => inputs.has('path') && inputs.has('content'),
    body: async (inputs) => {
      const filePath = String(inputs.get('path'))
      const content = inputs.get('content')
      const encoding = inputs.get('encoding') as BufferEncoding | undefined
      
      try {
        await fs.appendFile(filePath, String(content), encoding || 'utf-8')
        return new Map([
          ['success', true],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['success', false],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Appends content to a file',
    category: 'io',
    isPure: false
  }
}

export function fileExists(): PrimitiveGadget {
  return {
    id: 'file-exists',
    name: 'File Exists',
    inputs: ['path'],
    outputs: ['exists', 'error'],
    activation: (inputs) => inputs.has('path'),
    body: async (inputs) => {
      const filePath = String(inputs.get('path'))
      
      try {
        await fs.access(filePath)
        return new Map([
          ['exists', true],
          ['error', null]
        ])
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          return new Map([
            ['exists', false],
            ['error', null]
          ])
        }
        return new Map([
          ['exists', null],
          ['error', error.message]
        ])
      }
    },
    description: 'Checks if a file exists',
    category: 'io',
    isPure: false
  }
}

export function fileDelete(): PrimitiveGadget {
  return {
    id: 'file-delete',
    name: 'File Delete',
    inputs: ['path'],
    outputs: ['success', 'error'],
    activation: (inputs) => inputs.has('path'),
    body: async (inputs) => {
      const filePath = String(inputs.get('path'))
      
      try {
        await fs.unlink(filePath)
        return new Map([
          ['success', true],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['success', false],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Deletes a file',
    category: 'io',
    isPure: false
  }
}

export function dirList(): PrimitiveGadget {
  return {
    id: 'dir-list',
    name: 'Directory List',
    inputs: ['path', 'recursive'],
    outputs: ['files', 'error'],
    activation: (inputs) => inputs.has('path'),
    body: async (inputs) => {
      const dirPath = String(inputs.get('path'))
      const recursive = Boolean(inputs.get('recursive'))
      
      try {
        if (recursive) {
          // Recursive directory listing
          const files: string[] = []
          
          async function readDirRecursive(dir: string): Promise<void> {
            const entries = await fs.readdir(dir, { withFileTypes: true })
            
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name)
              if (entry.isDirectory()) {
                await readDirRecursive(fullPath)
              } else {
                files.push(fullPath)
              }
            }
          }
          
          await readDirRecursive(dirPath)
          return new Map([
            ['files', files],
            ['error', null]
          ])
        } else {
          // Simple directory listing
          const files = await fs.readdir(dirPath)
          return new Map([
            ['files', files],
            ['error', null]
          ])
        }
      } catch (error) {
        return new Map([
          ['files', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Lists files in a directory',
    category: 'io',
    isPure: false
  }
}

export function fileStats(): PrimitiveGadget {
  return {
    id: 'file-stats',
    name: 'File Stats',
    inputs: ['path'],
    outputs: ['stats', 'error'],
    activation: (inputs) => inputs.has('path'),
    body: async (inputs) => {
      const filePath = String(inputs.get('path'))
      
      try {
        const stats = await fs.stat(filePath)
        return new Map([
          ['stats', {
            size: stats.size,
            isFile: stats.isFile(),
            isDirectory: stats.isDirectory(),
            created: stats.birthtime,
            modified: stats.mtime,
            accessed: stats.atime
          }],
          ['error', null]
        ])
      } catch (error) {
        return new Map([
          ['stats', null],
          ['error', error instanceof Error ? error.message : String(error)]
        ])
      }
    },
    description: 'Gets file statistics',
    category: 'io',
    isPure: false
  }
}

// Note: File watching is more complex and would require special handling
// in the runtime to manage subscriptions and cleanup
export function fileWatch(): PrimitiveGadget {
  return {
    id: 'file-watch',
    name: 'File Watch',
    inputs: ['path', 'enable'],
    outputs: ['event', 'filePath', 'error'],
    activation: (inputs) => inputs.has('path') && inputs.has('enable'),
    body: async (inputs) => {
      const watchPath = String(inputs.get('path'))
      const enable = Boolean(inputs.get('enable'))
      
      if (!enable) {
        // Return empty when disabled
        return new Map()
      }
      
      // Note: This is a simplified implementation
      // Real implementation would need to manage watcher lifecycle
      return new Map([
        ['event', 'watching'],
        ['filePath', watchPath],
        ['error', 'File watching requires special runtime support']
      ])
    },
    description: 'Watches for file changes (requires runtime support)',
    category: 'io',
    isPure: false
  }
}