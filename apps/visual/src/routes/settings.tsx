import { Link } from 'react-router'
import { useState } from 'react'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { useTheme } from '../providers/ThemeProvider'
import { ThemeEditor } from '../components/ThemeEditor'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function Settings() {
  const { theme, themes, setTheme, createTheme, deleteTheme } = useTheme()
  const [isEditing, setIsEditing] = useState(false)

  const handleCreateTheme = async () => {
    const name = prompt('Theme name:')
    if (name) {
      const newTheme = await createTheme(name, theme?.id)
      if (newTheme) {
        await setTheme(newTheme.id)
        setIsEditing(true)
      }
    }
  }

  const handleDeleteTheme = async () => {
    if (!theme || theme.isSystem) return
    if (confirm(`Delete theme "${theme.name}"?`)) {
      await deleteTheme(theme.id)
      await setTheme('dark')
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 bg-card border-b border-border">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Projects
          </Link>
        </Button>
        <h1 className="text-base font-medium">Settings</h1>
      </header>

      <main className="flex-1 p-6 overflow-y-auto max-w-2xl">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="theme-select">Theme</Label>
              <Select value={theme?.id || ''} onValueChange={setTheme}>
                <SelectTrigger id="theme-select">
                  <SelectValue placeholder="Select a theme" />
                </SelectTrigger>
                <SelectContent>
                  {themes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {isEditing ? 'Close Editor' : 'Edit Theme'}
              </Button>
              <Button variant="outline" size="sm" onClick={handleCreateTheme}>
                <Plus className="h-4 w-4 mr-1" />
                Create New Theme
              </Button>
              {theme && !theme.isSystem && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteTheme}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Theme
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {isEditing && theme && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <ThemeEditor />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              About
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">Bassline Visual v0.1.0</p>
            <CardDescription>
              A visual modeling tool for Bassline applications
            </CardDescription>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
