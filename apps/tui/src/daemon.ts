import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Path to bl.js relative to this file
const BL_PATH = resolve(__dirname, '../../../../apps/cli/bin/bl.js')
// Project root - daemon needs this as cwd for relative paths in bootstrap
const PROJECT_ROOT = resolve(__dirname, '../../../..')

export function startDaemon(mode = 'naked', port = 9111) {
  const child = spawn('node', [BL_PATH, mode], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, BL_PORT: String(port) },
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return port
}

export function findAvailablePort(startPort = 9111, maxPort = 9120) {
  // Simple approach: just return the start port
  // In a real implementation, we'd check which ports are free
  return startPort
}
