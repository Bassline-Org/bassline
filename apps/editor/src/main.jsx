import { createRoot } from 'react-dom/client'
import { Bassline } from '@bassline/core'
import { createRemoteRoutes } from '@bassline/remote-browser'
import { BasslineProvider } from '@bassline/react'
import App from './App.jsx'
import './styles/main.css'

// Create browser-side Bassline
const bl = new Bassline()
bl.install(createRemoteRoutes())

// Connect to daemon (mount at /local so bl:///local/data → remote bl:///data)
bl.put('bl:///remote/ws/local', {}, {
  uri: 'ws://localhost:9112',
  mount: '/local'
})

createRoot(document.getElementById('root')).render(
  <BasslineProvider value={bl}>
    <App />
  </BasslineProvider>
)
