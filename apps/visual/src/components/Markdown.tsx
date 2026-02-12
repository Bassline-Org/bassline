/**
 * Markdown Component
 *
 * Renders markdown content with syntax highlighting and proper styling.
 * Used primarily in the Help semantic for documentation display.
 */

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div className={cn('markdown-content', className)}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
