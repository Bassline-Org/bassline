import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'

const BLT_DIR = join(homedir(), '.blt')
const CONNECTIONS_FILE = join(BLT_DIR, 'connections.json')

export interface Connection {
  id: string
  name: string
  url: string
  color?: string
}

interface ConnectionsData {
  connections: Connection[]
  default: string | null
}

function ensureDir() {
  if (!existsSync(BLT_DIR)) {
    mkdirSync(BLT_DIR, { recursive: true })
  }
}

function loadData(): ConnectionsData {
  ensureDir()
  try {
    return JSON.parse(readFileSync(CONNECTIONS_FILE, 'utf8'))
  } catch {
    return { connections: [], default: null }
  }
}

function saveData(data: ConnectionsData) {
  ensureDir()
  writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2))
}

export function loadConnections(): Connection[] {
  return loadData().connections
}

export function getDefaultConnectionId(): string | null {
  return loadData().default
}

export function getConnection(id: string): Connection | null {
  const data = loadData()
  return data.connections.find(c => c.id === id) || null
}

export function addConnection(name: string, url: string, color?: string): Connection {
  const data = loadData()

  // Check if a connection with this URL already exists
  const existing = data.connections.find(c => c.url === url)
  if (existing) {
    return existing
  }

  const connection: Connection = {
    id: randomUUID(),
    name,
    url,
    color,
  }
  data.connections.push(connection)
  // If this is the first connection, make it default
  if (data.connections.length === 1) {
    data.default = connection.id
  }
  saveData(data)
  return connection
}

export function updateConnection(id: string, updates: Partial<Omit<Connection, 'id'>>): Connection | null {
  const data = loadData()
  const index = data.connections.findIndex(c => c.id === id)
  if (index === -1) return null
  data.connections[index] = { ...data.connections[index], ...updates }
  saveData(data)
  return data.connections[index]
}

export function deleteConnection(id: string): boolean {
  const data = loadData()
  const index = data.connections.findIndex(c => c.id === id)
  if (index === -1) return false
  data.connections.splice(index, 1)
  // If we deleted the default, pick a new one
  if (data.default === id) {
    data.default = data.connections.length > 0 ? data.connections[0].id : null
  }
  saveData(data)
  return true
}

export function setDefaultConnection(id: string): boolean {
  const data = loadData()
  if (!data.connections.find(c => c.id === id)) return false
  data.default = id
  saveData(data)
  return true
}

// Check if a URL is reachable
export async function testConnection(url: string): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const response = await fetch(`${url}?uri=bl:///`, { signal: controller.signal })
    clearTimeout(timeout)
    return response.ok
  } catch {
    return false
  }
}
