import { createRoot } from 'react-dom/client'
import { Bassline } from '@bassline/core'
import { createRemoteRoutes } from '@bassline/remote-browser'
import { BasslineProvider, WebSocketProvider } from '@bassline/react'
import App from './App.jsx'
import './styles/main.css'

// Configuration - can be overridden via environment
const WS_PORT = import.meta.env.VITE_BL_WS_PORT || 9112

// Create browser-side Bassline with remote connection
const bl = new Bassline()
bl.install(createRemoteRoutes())

// Connect to daemon via WebSocket
// Access remote resources via bl:///r/* (e.g., bl:///r/cells → remote bl:///cells)
bl.put(
  'bl:///remote/ws/daemon',
  {},
  {
    uri: `ws://localhost:${WS_PORT}`,
    mount: '/r',
  }
)

createRoot(document.getElementById('root')).render(
  <WebSocketProvider url={`ws://localhost:${WS_PORT}`}>
    <BasslineProvider value={bl}>
      <App />
    </BasslineProvider>
  </WebSocketProvider>
)
