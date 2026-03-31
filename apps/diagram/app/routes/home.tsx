import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { listSheets, deleteSheet, importSheet, saveSheet } from '~/lib/persistence'

export function meta() {
  return [{ title: 'Bassline Sheets' }]
}

export default function Home() {
  const [sheets, setSheets] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    setSheets(listSheets())
  }, [])

  const create = () => {
    const name = newName.trim()
    if (!name) return
    setNewName('')
    navigate(`/sheet/${encodeURIComponent(name)}`)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const sheet = await importSheet(file)
      const name = file.name.replace(/\.json$/, '')
      saveSheet(name, sheet)
      setSheets(listSheets())
      navigate(`/sheet/${encodeURIComponent(name)}`)
    } catch (err) {
      alert(`Import failed: ${err}`)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto py-16 px-4">
        <h1 className="text-2xl font-bold mb-1">Sheets</h1>
        <p className="text-sm text-muted-foreground mb-8">Sparse 2D coordinate planes with pointer-based values</p>

        <div className="flex gap-2 mb-8">
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="new sheet name"
            className="max-w-[240px]"
            onKeyDown={e => e.key === 'Enter' && create()}
          />
          <Button onClick={create}>Create</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            Import JSON
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
        </div>

        {sheets.length === 0 ? (
          <div className="text-muted-foreground text-sm">No sheets yet. Create one or import a JSON file.</div>
        ) : (
          <div className="space-y-2">
            {sheets.map(name => (
              <div
                key={name}
                className="flex items-center justify-between p-3 border border-border rounded-md hover:bg-accent/10"
              >
                <Link to={`/sheet/${encodeURIComponent(name)}`} className="font-mono text-sm hover:underline">
                  {name}
                </Link>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => {
                    if (!confirm(`Delete sheet "${name}"?`)) return
                    deleteSheet(name)
                    setSheets(listSheets())
                  }}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
