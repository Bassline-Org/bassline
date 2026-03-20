import { app, BrowserWindow, MessageChannelMain, MessagePortMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import { fromPort, net, consume, isEOF } from '@bassline/core'
import { entryWriter, isEntryResultMsg, type EntryReadSelector, type StorageMsg } from '../src/storage/messages'
import { createSqliteStorage } from '../src/storage/sqlite'
import { createGraphService, seedDefaultGraph } from '../src/graph/service'

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
  const slot = storageNet()
  slot.send({ type: 'entry-read', qid, select })
  while (true) {
    const msg = await slot.recv()
    if (isEOF(msg)) break
    if (isEntryResultMsg(msg) && msg.qid === qid) {
      slot.close()
      return msg.entries
    }
  }
  return []
}

async function getGraphService() {
  if (!graphService) {
    const storageSlot = storageNet()
    graphService = createGraphService({
      history: await readStorageEntries({ space: 'graph', key: 'ops' }),
      persist: entryWriter(storageSlot.send),
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
      seedDefaultGraph(slot.send)
      slot.close()
    }

    const graphSlot = graphJoin()
    const ipc = fromPort(adaptPort(port1))
    consume(graphSlot.recv, msg => ipc.send(msg))
    consume(ipc.recv, msg => graphSlot.send(msg as any))

    mainWindow!.webContents.postMessage('port', null, [port2])
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
