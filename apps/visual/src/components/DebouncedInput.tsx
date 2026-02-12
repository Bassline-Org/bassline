import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'

interface DebouncedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string
  onChange: (value: string) => void
  debounceMs?: number
}

/**
 * Input component that debounces onChange calls.
 * Local state provides responsive typing; external onChange is debounced.
 */
export function DebouncedInput({
  value: externalValue,
  onChange,
  debounceMs = 300,
  ...inputProps
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(externalValue)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from external when it changes (e.g., after revalidation)
  useEffect(() => {
    setLocalValue(externalValue)
  }, [externalValue])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)

      // Clear pending debounce
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      // Schedule debounced update
      timeoutRef.current = setTimeout(() => {
        onChange(newValue)
      }, debounceMs)
    },
    [onChange, debounceMs]
  )

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return <Input {...inputProps} value={localValue} onChange={handleChange} />
}
