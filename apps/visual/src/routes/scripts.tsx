/**
 * Scripts Page
 *
 * Manage and edit borth scripts.
 * - List existing scripts
 * - Create new scripts
 * - Edit scripts with BorthEditor
 */

import { useState, useCallback, useRef } from 'react'
import { Link, useLoaderData } from 'react-router'
import { ArrowLeft, Plus, Trash2, Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BorthProvider } from '../components/BorthProvider'
import { BorthEditor } from '../components/BorthEditor'
import { bl } from '../lib/bl'
import { cn } from '@/lib/utils'

interface Script {
  id: string
  name: string
  source: string
  modified_at: string
}

interface ScriptsLoaderData {
  scripts: Script[]
  projectId: string
}

export async function scriptsLoader(): Promise<ScriptsLoaderData> {
  // Find or create a Scripts project
  const projects = await bl.projects.list()
  let scriptsProject = projects.find(p => p.name === '__borth_scripts__')

  if (!scriptsProject) {
    scriptsProject = await bl.projects.create('__borth_scripts__')
  }

  const projectId = scriptsProject.id

  // Get all entities in scripts project
  const entities = await bl.entities.list(projectId)

  // Map to Script interface
  const scripts: Script[] = entities.map(e => ({
    id: e.id,
    name: String(e.attrs['name'] ?? 'Untitled'),
    source: String(e.attrs['borth.source'] ?? ''),
    modified_at: String(e.attrs['modified_at'] ?? new Date().toISOString()),
  }))

  return { scripts, projectId }
}

async function getScriptsProjectId(): Promise<string> {
  const projects = await bl.projects.list()
  let scriptsProject = projects.find(p => p.name === '__borth_scripts__')
  if (!scriptsProject) {
    scriptsProject = await bl.projects.create('__borth_scripts__')
  }
  return scriptsProject.id
}

export async function scriptsAction({ request }: { request: Request }) {
  const formData = await request.formData()
  const intent = formData.get('intent')
  const projectId = await getScriptsProjectId()

  if (intent === 'create') {
    const entity = await bl.entities.create(projectId, {
      name: 'Untitled Script',
      'borth.source': '\\ New script\n',
      modified_at: new Date().toISOString(),
    })
    return { created: entity.id }
  }

  if (intent === 'delete') {
    const id = formData.get('id') as string
    await bl.entities.delete(projectId, id)
    return { deleted: id }
  }

  if (intent === 'update') {
    const id = formData.get('id') as string
    const source = formData.get('source') as string
    await bl.attrs.set(projectId, id, 'borth.source', source)
    await bl.attrs.set(projectId, id, 'modified_at', new Date().toISOString())
    return { updated: id }
  }

  if (intent === 'rename') {
    const id = formData.get('id') as string
    const name = formData.get('name') as string
    await bl.attrs.set(projectId, id, 'name', name)
    return { renamed: id }
  }

  return null
}

export function Scripts() {
  const { scripts: initialScripts, projectId } = useLoaderData() as ScriptsLoaderData
  const [scripts, setScripts] = useState(initialScripts)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [localSource, setLocalSource] = useState<string>('')
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Find selected script
  const selectedScript = scripts.find(s => s.id === selectedId)

  // Handle selecting a script
  const selectScript = useCallback((script: Script) => {
    setSelectedId(script.id)
    setLocalSource(script.source)
  }, [])

  // Auto-save with debounce
  const handleSourceChange = useCallback((source: string) => {
    setLocalSource(source)

    // Clear pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Debounced save (500ms)
    if (selectedId) {
      saveTimeoutRef.current = setTimeout(async () => {
        await bl.attrs.set(projectId, selectedId, 'borth.source', source)
        // Update local scripts state
        setScripts(prev => prev.map(s =>
          s.id === selectedId ? { ...s, source } : s
        ))
      }, 500)
    }
  }, [selectedId, projectId])

  // Create new script
  const createScript = useCallback(async () => {
    const entity = await bl.entities.create(projectId, {
      name: 'Untitled Script',
      'borth.source': '\\ New script\n',
      modified_at: new Date().toISOString(),
    })
    const newScript: Script = {
      id: entity.id,
      name: 'Untitled Script',
      source: '\\ New script\n',
      modified_at: new Date().toISOString(),
    }
    setScripts(prev => [newScript, ...prev])
    setSelectedId(entity.id)
    setLocalSource(newScript.source)
  }, [projectId])

  // Delete script
  const deleteScript = useCallback(async (id: string) => {
    await bl.entities.delete(projectId, id)
    setScripts(prev => prev.filter(s => s.id !== id))
    if (selectedId === id) {
      setSelectedId(null)
      setLocalSource('')
    }
  }, [projectId, selectedId])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-4 px-6 py-4 bg-card border-b border-border">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Borth Scripts</h1>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={createScript}>
            <Plus className="h-4 w-4 mr-1" />
            New Script
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        {/* Script list sidebar */}
        <div className="w-64 border-r border-border bg-muted/30 overflow-y-auto">
          {scripts.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No scripts yet
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {scripts.map(script => (
                <ScriptItem
                  key={script.id}
                  script={script}
                  selected={script.id === selectedId}
                  onClick={() => selectScript(script)}
                  onDelete={() => deleteScript(script.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Editor area */}
        <div className="flex-1 min-w-0">
          {selectedScript ? (
            <BorthProvider
              key={selectedScript.id}
              initialSource={localSource}
              onSourceChange={handleSourceChange}
            >
              <BorthEditor className="h-full" />
            </BorthProvider>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Code2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a script to edit</p>
                <p className="text-sm mt-1">or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ScriptItem({
  script,
  selected,
  onClick,
  onDelete,
}: {
  script: Script
  selected: boolean
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      )}
      onClick={onClick}
    >
      <Code2 className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate text-sm">{script.name}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
        onClick={e => {
          e.stopPropagation()
          if (confirm('Delete this script?')) {
            onDelete()
          }
        }}
      >
        <Trash2 className="h-3 w-3" />
      </Button>
    </div>
  )
}
