import { readFileSync, appendFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'

const HISTORY_FILE = join(homedir(), '.blt_history')

export function loadHistory() {
  try {
    return readFileSync(HISTORY_FILE, 'utf8').trim().split('\n').filter(Boolean)
  } catch {
    return []
  }
}

export function appendHistory(cmd) {
  appendFileSync(HISTORY_FILE, cmd + '\n')
}
