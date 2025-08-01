import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'

export interface ContactNodeData {
  content: any
  blendMode: 'accept-last' | 'merge'
  isBoundary: boolean
  setContent: (content: any) => void
}

export const ContactNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ContactNodeData
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  
  const handleDoubleClick = useCallback(() => {
    setEditValue(String(nodeData.content ?? ''))
    setIsEditing(true)
  }, [data.content])
  
  const handleSubmit = useCallback(() => {
    // Try to parse as JSON first, then as number, then as string
    let newContent: any = editValue
    try {
      newContent = JSON.parse(editValue)
    } catch {
      // Try as number
      const num = Number(editValue)
      if (!isNaN(num)) {
        newContent = num
      }
    }
    
    nodeData.setContent(newContent)
    setIsEditing(false)
  }, [editValue, data])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }, [handleSubmit])
  
  return (
    <Card className={`min-w-[120px] ${selected ? 'ring-2 ring-blue-500' : ''}`}>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <Badge variant={nodeData.blendMode === 'merge' ? 'default' : 'secondary'} className="text-xs">
              {nodeData.blendMode}
            </Badge>
          </div>
          
          <div onDoubleClick={handleDoubleClick} className="min-h-[24px]">
            {isEditing ? (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
                className="h-6 text-sm"
              />
            ) : (
              <div className="text-sm font-mono">
                {nodeData.content !== undefined ? String(nodeData.content) : '∅'}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})