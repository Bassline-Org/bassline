import { app, BrowserWindow, MessageChannelMain, MessagePortMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import type { Reader, Writer } from '@bassline/core'
import { fromPort, net } from '@bassline/core'
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

function observe(label: string, [reader]: [Reader, Writer]) {
  reader.sink((msg: unknown) => console.log(`[${label}]`, JSON.stringify(msg)))
}

const collectN =
  (n: number) =>
  async <T>(reader: Reader<T>) => {
    const values: T[] = []
    await reader.take(n).sink(value => void values.push(value))
    return values
  }

const dbPath = path.join(app.getPath('userData'), 'homebass.db')
const db = new Database(dbPath)
const storageNet = net<StorageMsg>()
createSqliteStorage(storageNet.join(), db)

let graphService: ReturnType<typeof createGraphService> | null = null
let observingGraph = false

async function readStorageEntries(select: EntryReadSelector) {
  const qid = crypto.randomUUID()
  const [reader, writer] = storageNet.join()
  writer.send({ type: 'entry-read', qid, select })
  const [result] = await reader
    .filter(isEntryResultMsg)
    .filter(msg => msg.qid === qid)
    .thru(collectN(1))
  writer.close()
  return result.entries
}

async function getGraphService() {
  if (!graphService) {
    const [_storageReader, storageWriter] = storageNet.join()
    graphService = createGraphService({
      history: await readStorageEntries({ space: 'graph', key: 'ops' }),
      persist: entryWriter(storageWriter),
    })
  }
  if (!observingGraph) {
    observe('graph', graphService.join())
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
    const graph = await getGraphService()

    if ((await readStorageEntries({ space: 'graph', key: 'ops', limit: 1 })).length === 0) {
      const [_reader, writer] = graph.join()
      seedDefaultGraph(writer)
      writer.close()
    }

    const [rNet, wNet] = graph.join()
    const [rPort, wPort] = fromPort(adaptPort(port1))
    rNet.sink(wPort)
    rPort.sink(wNet)

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
