import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown, Plus, X, Braces } from 'lucide-react'

interface ObjectEditorProps {
  value: Record<string, any>
  onChange: (value: Record<string, any>) => void
}

export function ObjectEditor({ value, onChange }: ObjectEditorProps) {
  const [expanded, setExpanded] = useState(true)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  
  const addProperty = () => {
    if (newKey.trim()) {
      try {
        const parsed = JSON.parse(newValue)
        onChange({ ...value, [newKey]: parsed })
      } catch {
        // If not valid JSON, add as string
        onChange({ ...value, [newKey]: newValue })
      }
      setNewKey('')
      setNewValue('')
    }
  }
  
  const removeProperty = (key: string) => {
    const { [key]: _, ...rest } = value
    onChange(rest)
  }
  
  const updateProperty = (key: string, newValue: string) => {
    try {
      const parsed = JSON.parse(newValue)
      onChange({ ...value, [key]: parsed })
    } catch {
      // If not valid JSON, update as string
      onChange({ ...value, [key]: newValue })
    }
  }
  
  const entries = Object.entries(value)
  
  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        type="button"
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Braces className="w-3 h-3" />
        <span>Object ({entries.length} properties)</span>
      </button>
      
      {expanded && (
        <>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {entries.map(([key, val]) => (
              <div key={key} className="flex items-center gap-1">
                <input
                  type="text"
                  value={key}
                  disabled
                  className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-800 font-mono"
                />
                <span className="text-xs">:</span>
                <input
                  type="text"
                  value={JSON.stringify(val)}
                  onChange={(e) => updateProperty(key, e.target.value)}
                  className="flex-1 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
                />
                <button
                  onClick={() => removeProperty(key)}
                  className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900 rounded"
                  type="button"
                >
                  <X className="w-3 h-3 text-red-500" />
                </button>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              className="w-20 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
              placeholder="key"
            />
            <span className="text-xs">:</span>
            <input
              type="text"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addProperty()
                }
              }}
              className="flex-1 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
              placeholder="value (JSON)"
            />
            <button
              onClick={addProperty}
              className="p-0.5 hover:bg-green-100 dark:hover:bg-green-900 rounded"
              type="button"
            >
              <Plus className="w-3 h-3 text-green-500" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}