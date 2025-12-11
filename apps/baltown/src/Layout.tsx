import { A, useLocation } from '@solidjs/router'
import { createSignal, Show, ParentProps } from 'solid-js'
import { ImportButton } from './components/ImportExport'

import './App.css'

export default function Layout(props: ParentProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = createSignal(true)

  return (
    <div class="app">
      {/* Header */}
      <header class="header">
        <div class="header-left">
          <button class="menu-btn" onClick={() => setSidebarOpen(!sidebarOpen())}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12h18M3 6h18M3 18h18"/>
            </svg>
          </button>
          <A href="/" class="logo">baltown</A>
        </div>
        <nav class="header-nav">
          <A href="/browse" class={location.pathname === '/browse' ? 'active' : ''}>Browse</A>
          <A href="/templates" class={location.pathname === '/templates' ? 'active' : ''}>Templates</A>
          <A href="/compose" class={location.pathname === '/compose' ? 'active' : ''}>Compose</A>
        </nav>
        <div class="header-right">
          <ImportButton />
          <span class="peer-badge">anonymous</span>
        </div>
      </header>

      <div class="main-container">
        {/* Sidebar */}
        <Show when={sidebarOpen()}>
          <aside class="sidebar">
            <div class="sidebar-section">
              <h3>Quick Links</h3>
              <A href="/browse">All Vals</A>
              <A href="/templates">Templates</A>
              <A href="/compose">New Val</A>
            </div>
            <div class="sidebar-section">
              <h3>Val Types</h3>
              <A href="/browse?type=propagator">Propagators</A>
              <A href="/browse?type=recipe">Recipes</A>
              <A href="/browse?type=handler">Handlers</A>
              <A href="/browse?type=cell">Cells</A>
            </div>
            <div class="sidebar-section">
              <h3>Resources</h3>
              <A href="/cells">Live Cells</A>
              <A href="/browse?resource=propagators">Propagators</A>
              <A href="/browse?resource=handlers">Handlers</A>
            </div>
          </aside>
        </Show>

        {/* Main Content */}
        <main class="content">
          {props.children}
        </main>
      </div>
    </div>
  )
}
