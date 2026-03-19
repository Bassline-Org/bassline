import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// @ts-ignore -- @bassline/core is untyped JS
import { fromPort } from '@bassline/core'
import App from './App'

window.addEventListener('message', e => {
  if (e.data?.type === 'bassline-port' && e.ports[0]) {
    const [reader, writer] = fromPort(e.ports[0])
    const root = createRoot(document.getElementById('root')!)
    root.render(
      <StrictMode>
        <App reader={reader} writer={writer} />
      </StrictMode>
    )
  }
})
