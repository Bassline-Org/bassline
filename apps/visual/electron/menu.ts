import { app, Menu, shell, MenuItemConstructorOptions } from 'electron'

const isMac = process.platform === 'darwin'

export interface Project {
  id: string
  name: string
  updated_at: string
}

interface MenuCallbacks {
  createProject: () => void
  openProject: () => void
  openProjectById: (id: string) => void
  exportProject: () => void
  showSettings: () => void
}

export function createApplicationMenu(callbacks: MenuCallbacks, recentProjects: Project[] = []): Menu {
  // Build recent projects submenu
  const recentProjectsSubmenu: MenuItemConstructorOptions[] = recentProjects.length > 0
    ? [
        ...recentProjects.slice(0, 10).map((project, index) => ({
          label: project.name || 'Untitled Project',
          accelerator: index < 9 ? `CmdOrCtrl+${index + 1}` : undefined,
          click: () => callbacks.openProjectById(project.id),
        })),
        { type: 'separator' as const },
        {
          label: 'Clear Recent Projects',
          enabled: recentProjects.length > 0,
          click: callbacks.openProject, // Just go to project list
        },
      ]
    : [{ label: 'No Recent Projects', enabled: false }]

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings...',
                accelerator: 'CmdOrCtrl+,',
                click: callbacks.showSettings,
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Project',
          accelerator: 'CmdOrCtrl+N',
          click: callbacks.createProject,
        },
        {
          label: 'Open Project...',
          accelerator: 'CmdOrCtrl+O',
          click: callbacks.openProject,
        },
        { type: 'separator' },
        {
          label: 'Recent Projects',
          submenu: recentProjectsSubmenu,
        },
        { type: 'separator' },
        {
          label: 'Export...',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: callbacks.exportProject,
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
              { type: 'separator' as const },
              {
                label: 'Speech',
                submenu: [
                  { role: 'startSpeaking' as const },
                  { role: 'stopSpeaking' as const },
                ],
              },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/bassline-org/bassline')
          },
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/bassline-org/bassline/issues')
          },
        },
        { type: 'separator' },
        {
          label: 'View License',
          click: async () => {
            await shell.openExternal('https://github.com/bassline-org/bassline/blob/main/LICENSE')
          },
        },
      ],
    },
  ]

  return Menu.buildFromTemplate(template)
}

export function createDockMenu(callbacks: MenuCallbacks, recentProjects: Project[] = []): Menu {
  const recentItems: MenuItemConstructorOptions[] = recentProjects.slice(0, 5).map((project) => ({
    label: project.name || 'Untitled Project',
    click: () => callbacks.openProjectById(project.id),
  }))

  return Menu.buildFromTemplate([
    {
      label: 'New Project',
      click: callbacks.createProject,
    },
    {
      label: 'Open Project...',
      click: callbacks.openProject,
    },
    ...(recentItems.length > 0
      ? [
          { type: 'separator' as const },
          { label: 'Recent Projects', enabled: false },
          ...recentItems,
        ]
      : []),
  ])
}
