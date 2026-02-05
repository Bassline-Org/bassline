import { useState } from 'react'
import { useComponents } from '../context'
import type { TextEditor } from '../../core/types'

export interface TextViewProps {
  item: TextEditor
}

/**
 * Renders a text editor view with onChange/onBlur callbacks
 */
export function TextView({ item }: TextViewProps) {
  const { Textarea } = useComponents()
  const [text, setText] = useState(() => item.text())

  return (
    <Textarea
      className="min-h-[200px] w-full"
      value={text}
      onChange={e => {
        const value = e.target.value
        setText(value)
        item?.onChange?.(value)
      }}
      onBlur={e => item?.onBlur?.(e.target.value)}
    />
  )
}
