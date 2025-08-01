import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardHeader, CardContent } from '~/components/ui/card'

export interface GroupNodeData {
  name: string
  onNavigate: () => void
  inputContacts: { id: string; name?: string }[]
  outputContacts: { id: string; name?: string }[]
}

export const GroupNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as GroupNodeData
  const handleDoubleClick = useCallback(() => {
    nodeData.onNavigate()
  }, [nodeData])
  
  return (
    <Card 
      className={`min-w-[160px] cursor-pointer transition-all bg-slate-50 border-2 ${selected ? 'ring-2 ring-blue-500 border-blue-400' : 'border-slate-300'}`}
      onDoubleClick={handleDoubleClick}
    >
      <CardHeader className="p-2 pb-1 bg-slate-200 rounded-t-sm">
        <div className="font-semibold text-sm text-center">{nodeData.name}</div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex">
          {/* Input contacts (left side) */}
          <div className="flex-1 border-r border-slate-300">
            {nodeData.inputContacts.map((contact, index) => (
              <div key={contact.id} className="relative h-8 flex items-center">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={contact.id}
                  style={{ top: `${16 + index * 32}px` }}
                  className="!w-3 !h-3"
                />
                <span className="text-xs text-muted-foreground pl-4">{contact.name || 'in'}</span>
              </div>
            ))}
            {nodeData.inputContacts.length === 0 && (
              <div className="h-8 flex items-center justify-center text-xs text-muted-foreground">
                no inputs
              </div>
            )}
          </div>
          
          {/* Output contacts (right side) */}
          <div className="flex-1">
            {nodeData.outputContacts.map((contact, index) => (
              <div key={contact.id} className="relative h-8 flex items-center justify-end">
                <span className="text-xs text-muted-foreground pr-4">{contact.name || 'out'}</span>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={contact.id}
                  style={{ top: `${16 + index * 32}px` }}
                  className="!w-3 !h-3"
                />
              </div>
            ))}
            {nodeData.outputContacts.length === 0 && (
              <div className="h-8 flex items-center justify-center text-xs text-muted-foreground">
                no outputs
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

GroupNode.displayName = 'GroupNode'