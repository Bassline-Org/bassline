/**
 * Shell Resource
 *
 * Execute shell commands from the visual editor.
 *
 * PUT /shell { cmd: "...", cwd?: "...", timeout?: 30000 }
 * Returns { stdout, stderr, code }
 */

import { resource } from '@bassline/core'
import { exec } from 'child_process'
import { promisify } from 'util'
import { homedir } from 'os'

const execAsync = promisify(exec)

// Expand ~ to home directory
function expandTilde(path: string): string {
  if (path.startsWith('~/')) {
    return homedir() + path.slice(1)
  }
  if (path === '~') {
    return homedir()
  }
  return path
}

interface ShellRequest {
  cmd: string
  cwd?: string
  timeout?: number
}

interface ShellResponse {
  stdout: string
  stderr: string
  code: number
}

export function createShellResource() {
  return resource({
    get: async () => ({
      headers: { type: 'shell' },
      body: {
        description: 'Execute shell commands',
        usage: 'PUT /shell { cmd: "...", cwd?: "...", timeout?: 30000 }',
      },
    }),

    put: async (_h: unknown, body: unknown) => {
      const { cmd, cwd, timeout = 30000 } = body as ShellRequest

      if (!cmd) {
        return {
          headers: { condition: 'error' },
          body: { error: 'cmd is required' },
        }
      }

      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: cwd ? expandTilde(cwd) : undefined,
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        })

        return {
          headers: { status: 'ok' },
          body: { stdout, stderr, code: 0 } as ShellResponse,
        }
      } catch (err: unknown) {
        const error = err as { stdout?: string; stderr?: string; code?: number; message?: string }
        return {
          headers: { status: 'error' },
          body: {
            stdout: error.stdout || '',
            stderr: error.stderr || error.message || 'Unknown error',
            code: error.code || 1,
          } as ShellResponse,
        }
      }
    },
  })
}
