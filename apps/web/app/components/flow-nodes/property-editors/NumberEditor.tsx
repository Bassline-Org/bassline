import { useState, useEffect } from 'react'
import { Minus, Plus } from 'lucide-react'

interface NumberEditorProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}

export function NumberEditor({ 
  value, 
  onChange, 
  min = -Infinity, 
  max = Infinity, 
  step = 1 
}: NumberEditorProps) {
  const [localValue, setLocalValue] = useState(String(value))
  
  useEffect(() => {
    setLocalValue(String(value))
  }, [value])
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value)
  }
  
  const handleBlur = () => {
    const num = parseFloat(localValue)
    if (!isNaN(num)) {
      const clamped = Math.max(min, Math.min(max, num))
      onChange(clamped)
      setLocalValue(String(clamped))
    } else {
      setLocalValue(String(value))
    }
  }
  
  const increment = () => {
    const newValue = Math.min(max, value + step)
    onChange(newValue)
  }
  
  const decrement = () => {
    const newValue = Math.max(min, value - step)
    onChange(newValue)
  }
  
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={decrement}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        type="button"
      >
        <Minus className="w-3 h-3" />
      </button>
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        max={max}
        step={step}
        className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
      />
      <button
        onClick={increment}
        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
        type="button"
      >
        <Plus className="w-3 h-3" />
      </button>
    </div>
  )
}