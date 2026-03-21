import { app, BrowserWindow, MessageChannelMain, MessagePortMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { fromPort, net, consume } from '@bassline/core'
import { request } from '@bassline/ontology'
import {
  isEntryResultMsg,
  type EntryReadSelector,
  type EntryResultMsg,
  type StorageMsg,
} from '../src/ontology/storage/schema'
import { storage } from '../src/ontology/storage/slang'
import { createSqliteStorage } from '../src/ontology/storage/sqlite'
import { createGraphService, type GraphMutationMsg } from '@bassline/ontology/graph'
import { graphView } from '../src/ontology/xyflow/slang'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function adaptPort(electronPort: MessagePortMain) {
  return {
    postMessage: (data: unknown) => electronPort.postMessage(data),
    set onmessage(fn: (e: { data: unknown }) => void) {
      electronPort.on('message', e => fn({ data: e.data }))
      electronPort.start()
    },
    set onmessageerror(_fn: (e: unknown) => void) {},
  }
}

function observe(label: string, slot: { recv: () => Promise<unknown> }) {
  consume(slot.recv, (msg: unknown) => console.log(`[${label}]`, JSON.stringify(msg)))
}

const dbPath = path.join(app.getPath('userData'), 'homebass.db')
const db = new Database(dbPath)
const storageNet = net<StorageMsg>()
createSqliteStorage(storageNet(), db)

let graphService: ReturnType<typeof createGraphService> | null = null
let observingGraph = false

async function readStorageEntries(select: EntryReadSelector) {
  const qid = crypto.randomUUID()
  const result = await request<EntryResultMsg>(
    storageNet,
    { type: 'entry-read', qid, select },
    (msg): msg is EntryResultMsg => isEntryResultMsg(msg) && msg.qid === qid
  )
  return result?.entries ?? []
}

async function getGraphService() {
  if (!graphService) {
    const entries = await readStorageEntries({ space: 'graph', key: 'ops' })
    const storageSlot = storageNet(0)
    const s = storage(storageSlot.send)
    let head: string | null = entries.at(-1)?.id ?? null

    graphService = createGraphService({
      history: entries.map(e => e.msg as GraphMutationMsg),
      persist: (mutation: GraphMutationMsg) => {
        const id = crypto.randomUUID()
        s.appendEntry({ id, space: 'graph', key: 'ops', msg: mutation, prev: head })
        head = id
      },
    })
  }
  if (!observingGraph) {
    observe('graph', graphService())
    observingGraph = true
  }
  return graphService
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  })

  mainWindow.webContents.once('did-finish-load', async () => {
    const { port1, port2 } = new MessageChannelMain()
    const graphJoin = await getGraphService()

    if ((await readStorageEntries({ space: 'graph', key: 'ops', limit: 1 })).length === 0) {
      const slot = graphJoin()
      const g = graphView(slot.send)
      g.addNode('n1')
      g.position('n1', 100, 150)
      g.label('n1', 'Hello')
      g.addNode('n2')
      g.position('n2', 350, 200)
      g.label('n2', 'World')
      slot.close()
    }

    const graphSlot = graphJoin()
    const ipc = fromPort(adaptPort(port1))
    consume(graphSlot.recv, msg => ipc.send(msg))
    consume(ipc.recv, msg => graphSlot.send(msg as any))

    mainWindow!.webContents.postMessage('port', null, [port2])

    mainWindow!.once('closed', () => {
      graphSlot.close()
      ipc.close()
    })
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
