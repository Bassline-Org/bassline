import { useState, useCallback } from 'react'
import { HelpCircle, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'

export function HelpOverlay() {
  const [isOpen, setIsOpen] = useState(false)
  
  const shortcuts = [
    { key: 'A', description: 'Add new contact at center' },
    { key: 'B', description: 'Add boundary contact' },
    { key: 'G', description: 'Create group from selected contacts' },
    { key: 'V', description: 'Enter valence mode (connect contacts)' },
    { key: 'H', description: 'Align selected nodes horizontally' },
    { key: 'Shift+H', description: 'Distribute nodes horizontally' },
    { key: 'Cmd/Ctrl+C', description: 'Copy selected contacts' },
    { key: 'Cmd/Ctrl+V', description: 'Paste contacts' },
    { key: 'Delete', description: 'Delete selected items' },
    { key: 'Escape', description: 'Clear selection / Exit mode' },
    { key: 'Double-click canvas', description: 'Create contact at position' },
    { key: 'Double-click group', description: 'Enter group' },
    { key: 'Right-click', description: 'Show context menu' },
  ]
  
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-background/80 hover:bg-background border shadow-sm hover:shadow-md transition-all flex items-center justify-center"
        title="Show keyboard shortcuts"
      >
        <HelpCircle className="w-5 h-5" />
      </button>
    )
  }
  
  return (
    <div className="absolute top-4 right-4 z-30">
      <Card className="w-80 shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">Keyboard Shortcuts</CardTitle>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-accent"
          >
            <X className="w-4 h-4" />
          </button>
        </CardHeader>
        <CardContent className="space-y-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">{key}</kbd>
              <span className="text-muted-foreground ml-3 flex-1">{description}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}