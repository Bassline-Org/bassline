import { useState, useEffect } from 'react'
import { Plus, X, List } from 'lucide-react'

interface ArrayEditorProps {
  value: any[]
  onChange: (value: any[]) => void
}

export function ArrayEditor({ value, onChange }: ArrayEditorProps) {
  const [items, setItems] = useState<string[]>(value.map(v => JSON.stringify(v)))
  const [newItem, setNewItem] = useState('')
  
  useEffect(() => {
    setItems(value.map(v => JSON.stringify(v)))
  }, [value])
  
  const addItem = () => {
    if (newItem.trim()) {
      try {
        const parsed = JSON.parse(newItem)
        onChange([...value, parsed])
        setNewItem('')
      } catch {
        // If not valid JSON, add as string
        onChange([...value, newItem])
        setNewItem('')
      }
    }
  }
  
  const removeItem = (index: number) => {
    const newArray = value.filter((_, i) => i !== index)
    onChange(newArray)
  }
  
  const updateItem = (index: number, newValue: string) => {
    try {
      const parsed = JSON.parse(newValue)
      const newArray = [...value]
      newArray[index] = parsed
      onChange(newArray)
    } catch {
      // If not valid JSON, update as string
      const newArray = [...value]
      newArray[index] = newValue
      onChange(newArray)
    }
  }
  
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <List className="w-3 h-3" />
        <span>Array ({value.length} items)</span>
      </div>
      
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-1">
            <input
              type="text"
              value={item}
              onChange={(e) => {
                const newItems = [...items]
                newItems[index] = e.target.value
                setItems(newItems)
              }}
              onBlur={(e) => updateItem(index, e.target.value)}
              className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
            />
            <button
              onClick={() => removeItem(index)}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded"
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
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addItem()
            }
          }}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
          placeholder="Add item (JSON or string)"
        />
        <button
          onClick={addItem}
          className="p-1 hover:bg-green-100 dark:hover:bg-green-900 rounded"
          type="button"
        >
          <Plus className="w-3 h-3 text-green-500" />
        </button>
      </div>
    </div>
  )
}