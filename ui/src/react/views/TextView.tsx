import { useState } from 'react'
import { useComponents } from '../context'
import type { PhlowTextEditorView } from '../../core/views'

export interface TextViewProps {
  item: PhlowTextEditorView
}

/**
 * Renders a text editor view with onChange/onBlur callbacks
 */
export function TextView({ item }: TextViewProps) {
  const { Textarea } = useComponents()
  const [text, setText] = useState(() => item.text())

  return (
    <Textarea
      value={text}
      onChange={e => {
        const value = e.target.value
        setText(value)
        item.onChange(value)
      }}
      onBlur={e => item.onBlur(e.target.value)}
    />
  )
}
