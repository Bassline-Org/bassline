/* @refresh reload */
import { render } from 'solid-js/web'
import { Router, Route } from '@solidjs/router'
import { Bassline } from '@bassline/core'
import { createRemoteRoutes } from '@bassline/remote-browser'
import { BasslineProvider, WebSocketProvider } from '@bassline/solid'
import Layout from './Layout'
import Home from './pages/Home'
import Browse from './pages/Browse'
import Compose from './pages/Compose'
import ValView from './pages/ValView'
import VersionHistory from './pages/VersionHistory'
import Cells from './pages/Cells'
import TemplateGallery from './pages/templates/TemplateGallery'

// Configuration
const WS_PORT = 9112
const WS_URL = `ws://localhost:${WS_PORT}`

// Create Bassline instance with remote routes
const bl = new Bassline()
bl.install(createRemoteRoutes())

// Connect to daemon
bl.put('bl:///remote/ws/daemon', {}, {
  uri: WS_URL,
  mount: '/r'  // Access remote resources via bl:///r/*
})

// Render app
render(() => (
  <WebSocketProvider url={WS_URL}>
    <BasslineProvider value={bl}>
      <Router root={Layout}>
        <Route path="/" component={Home} />
        <Route path="/browse" component={Browse} />
        <Route path="/compose" component={Compose} />
        <Route path="/compose/:type" component={Compose} />
        <Route path="/v/:owner/:name" component={ValView} />
        <Route path="/v/:owner/:name/edit" component={Compose} />
        <Route path="/v/:owner/:name/versions" component={VersionHistory} />
        <Route path="/cells" component={Cells} />
        <Route path="/templates" component={TemplateGallery} />
      </Router>
    </BasslineProvider>
  </WebSocketProvider>
), document.getElementById('root')!)
