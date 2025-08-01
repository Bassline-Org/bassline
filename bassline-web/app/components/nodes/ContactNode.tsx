import { memo, useState, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Badge } from '~/components/ui/badge'
import { Circle } from 'lucide-react'

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
  }, [nodeData.content])
  
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
  }, [editValue, nodeData])
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }, [handleSubmit])
  
  return (
    <Card 
      className={`min-w-[100px] transition-all shadow-sm hover:shadow-md ${
        selected 
          ? 'ring-2 ring-blue-500 border-blue-400' 
          : 'border-blue-200'
      }`}
      style={{ 
        background: nodeData.isBoundary 
          ? 'linear-gradient(to bottom, #fef3c7 0%, #fffbeb 100%)' 
          : 'linear-gradient(to bottom, #e0f2fe 0%, #f0f9ff 100%)',
        borderWidth: '2px'
      }}
    >
      <Handle 
        type="target" 
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-500 !border-blue-600"
      />
      <Handle 
        type="source" 
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-500 !border-blue-600"
      />
      
      <CardContent className="p-3">
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-1">
              <Circle className={`w-3 h-3 ${nodeData.isBoundary ? 'text-amber-600' : 'text-blue-600'}`} />
              {nodeData.isBoundary && (
                <span className="text-xs text-amber-700 font-medium">boundary</span>
              )}
            </div>
            <Badge 
              variant={nodeData.blendMode === 'merge' ? 'default' : 'secondary'} 
              className="text-xs py-0 px-1"
            >
              {nodeData.blendMode === 'merge' ? 'M' : 'L'}
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
                className="h-6 text-sm px-2"
              />
            ) : (
              <div className={`text-sm font-mono text-center ${
                nodeData.content === undefined ? 'text-gray-400' : 'text-gray-700'
              }`}>
                {nodeData.content !== undefined ? String(nodeData.content) : '∅'}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})