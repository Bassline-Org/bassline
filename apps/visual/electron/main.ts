import { app, BrowserWindow, MessageChannelMain, MessagePortMain } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { net, fromPort } from '@bassline/core'
import { store } from '../src/graph/store'
import { graph } from '../src/graph/messages'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function adaptPort(electronPort: MessagePortMain) {
  return {
    postMessage: (data: any) => electronPort.postMessage(data),
    set onmessage(fn: (e: { data: any }) => void) {
      electronPort.on('message', e => fn({ data: e.data }))
      electronPort.start()
    },
    set onmessageerror(_fn: (e: any) => void) {},
  }
}

function observe(label: string, [reader]: [any, any]) {
  reader.sink((msg: any) => console.log(`[${label}]`, JSON.stringify(msg)))
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

    const graphNet = net()

    // Observer participant
    observe('graph', graphNet.join())

    // Store participant
    store(graphNet.join())

    // Bridge graph net to renderer via port
    const [rNet, wNet] = graphNet.join()
    const [rPort, wPort] = fromPort(adaptPort(port1))
    rNet.sink(wPort)
    rPort.sink(wNet)

    // Send port to renderer
    mainWindow!.webContents.postMessage('port', null, [port2])

    // Seed initial graph
    const g = graph({ send: (msg: any) => graphNet.send(msg) } as any)
    g.addNode('n1')
    g.position('n1', 100, 150)
    g.label('n1', 'Hello')
    g.addNode('n2')
    g.position('n2', 350, 200)
    g.label('n2', 'World')
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
