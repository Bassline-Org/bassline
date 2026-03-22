import './index.css'
import { createRoot } from 'react-dom/client'
import { fromPort } from '@bassline/core'
import App from './App'

window.addEventListener('message', e => {
  if (e.data?.type === 'bassline-port' && e.ports[0]) {
    const p = fromPort(e.ports[0])
    const root = createRoot(document.getElementById('root')!)
    root.render(<App send={p.send as any} recv={p.recv as any} />)
  }
})
