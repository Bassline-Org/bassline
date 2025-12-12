/**
 * AppLayout - Three-panel layout wrapper
 *
 * Layout structure:
 * ┌──────────────────────────────────────────────┐
 * │                   Toolbar                     │
 * ├──────────┬───────────────────────────────────┤
 * │          │                                    │
 * │ Sidebar  │           Main Content            │
 * │  (nav)   │                                    │
 * │          │                                    │
 * └──────────┴───────────────────────────────────┘
 */
export default function AppLayout({ toolbar, sidebar, children, sidebarCollapsed = false }) {
  return (
    <div className={`app-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="app-layout-toolbar">{toolbar}</div>
      <div className="app-layout-sidebar">{sidebar}</div>
      <div className="app-layout-main">{children}</div>
    </div>
  )
}
