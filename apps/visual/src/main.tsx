import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { fromPort } from '@bassline/core'
import type { Reader, Writer } from '@bassline/core'
import App from './App'
import type { InboundMsg } from './graph/xyflow'

function fromGraphPort(port: MessagePort): [Reader<InboundMsg>, Writer] {
  return fromPort(port) as [Reader<InboundMsg>, Writer]
}

window.addEventListener('message', e => {
  if (e.data?.type === 'bassline-port' && e.ports[0]) {
    const [reader, writer] = fromGraphPort(e.ports[0])
    const root = createRoot(document.getElementById('root')!)
    root.render(
      <StrictMode>
        <App reader={reader} writer={writer} />
      </StrictMode>
    )
  }
})
