import { useState, useEffect } from 'react'
import { Type, Hash, AtSign } from 'lucide-react'

interface StringEditorProps {
  value: string
  onChange: (value: string) => void
  multiline?: boolean
}

export function StringEditor({ value, onChange, multiline = false }: StringEditorProps) {
  const [localValue, setLocalValue] = useState(value)
  
  useEffect(() => {
    setLocalValue(value)
  }, [value])
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setLocalValue(e.target.value)
  }
  
  const handleBlur = () => {
    onChange(localValue)
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !multiline) {
      e.preventDefault()
      onChange(localValue)
    }
  }
  
  if (multiline) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Type className="w-3 h-3" />
          <span>String</span>
        </div>
        <textarea
          value={localValue}
          onChange={handleChange}
          onBlur={handleBlur}
          rows={3}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
          placeholder="Enter text..."
        />
      </div>
    )
  }
  
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-xs text-gray-500">
        <Type className="w-3 h-3" />
        <span>String</span>
      </div>
      <input
        type="text"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 font-mono"
        placeholder="Enter text..."
      />
    </div>
  )
}