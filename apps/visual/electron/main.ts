import { app, BrowserWindow, MessageChannelMain, MessagePortMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'
import type { Reader, Writer } from '@bassline/core'
import { fromPort } from '@bassline/core'
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

const dbPath = path.join(app.getPath('userData'), 'homebass.db')
const db = new Database(dbPath)
let graphService: ReturnType<typeof createGraphService> | null = null
let observingGraph = false

function getGraphService() {
  if (!graphService) graphService = createGraphService(db)
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

  mainWindow.webContents.once('did-finish-load', () => {
    const { port1, port2 } = new MessageChannelMain()
    const service = getGraphService()

    // Bridge graph net to renderer via port
    const [rNet, wNet] = service.join()
    const [rPort, wPort] = fromPort(adaptPort(port1))
    rNet.sink(wPort)
    rPort.sink(wNet)

    // Send port to renderer
    mainWindow!.webContents.postMessage('port', null, [port2])

    // Seed on first run through the public graph surface.
    if (service.isEmpty()) {
      const [_reader, writer] = service.join()
      seedDefaultGraph(writer)
      writer.close()
    }
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
