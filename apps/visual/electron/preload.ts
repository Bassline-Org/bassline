import { ipcRenderer } from 'electron'

ipcRenderer.on('port', e => {
  const port = e.ports[0]
  window.postMessage({ type: 'bassline-port' }, '*', [port])
})
