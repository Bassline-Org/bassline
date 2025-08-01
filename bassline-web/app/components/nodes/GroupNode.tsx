import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardHeader, CardContent } from '~/components/ui/card'
import { Package, Lock } from 'lucide-react'

export interface GroupNodeData {
  name: string
  onNavigate?: () => void
  inputContacts: { id: string; name?: string }[]
  outputContacts: { id: string; name?: string }[]
}

export const GroupNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as GroupNodeData
  const handleDoubleClick = useCallback(() => {
    if (nodeData.onNavigate) {
      nodeData.onNavigate()
    }
  }, [nodeData])
  
  const maxContacts = Math.max(nodeData.inputContacts.length, nodeData.outputContacts.length, 1)
  
  return (
    <Card 
      className={`min-w-[200px] ${nodeData.onNavigate ? 'cursor-pointer' : 'cursor-default'} transition-all shadow-md hover:shadow-lg ${
        selected 
          ? 'ring-2 ring-purple-500 border-purple-400' 
          : 'border-purple-200'
      }`}
      style={{ 
        background: nodeData.onNavigate 
          ? 'linear-gradient(to bottom, #f3e8ff 0%, #faf5ff 100%)'
          : 'linear-gradient(to bottom, #e0e7ff 0%, #f0f4ff 100%)',
        borderWidth: '2px'
      }}
      onDoubleClick={handleDoubleClick}
    >
      <CardHeader className="p-3 pb-2 border-b border-purple-200">
        <div className="flex items-center gap-2">
          {nodeData.onNavigate ? (
            <Package className="w-4 h-4 text-purple-600" />
          ) : (
            <Lock className="w-4 h-4 text-indigo-600" />
          )}
          <div className="font-semibold text-sm text-purple-900">{nodeData.name}</div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex" style={{ minHeight: `${maxContacts * 28}px` }}>
          {/* Input contacts (left side) */}
          <div className="flex-1 flex flex-col border-r border-purple-200">
            {nodeData.inputContacts.map((contact, index) => (
              <div key={contact.id} className="relative flex items-center h-7">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={contact.id}
                  className="!w-3 !h-3 !bg-purple-500 !border-purple-600"
                  style={{ left: '-8px' }}
                />
                <div className="pl-3 pr-2 w-full">
                  <span className="text-xs text-purple-700 font-medium">{contact.name || `in${index + 1}`}</span>
                </div>
              </div>
            ))}
            {nodeData.inputContacts.length === 0 && (
              <div className="flex-1 flex items-center justify-center min-h-[40px]">
                <span className="text-xs text-purple-400 italic">no inputs</span>
              </div>
            )}
          </div>
          
          {/* Output contacts (right side) */}
          <div className="flex-1 flex flex-col">
            {nodeData.outputContacts.map((contact, index) => (
              <div key={contact.id} className="relative flex items-center justify-end h-7">
                <div className="pl-2 pr-3 w-full text-right">
                  <span className="text-xs text-purple-700 font-medium">{contact.name || `out${index + 1}`}</span>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={contact.id}
                  className="!w-3 !h-3 !bg-purple-500 !border-purple-600"
                  style={{ right: '-8px' }}
                />
              </div>
            ))}
            {nodeData.outputContacts.length === 0 && (
              <div className="flex-1 flex items-center justify-center min-h-[40px]">
                <span className="text-xs text-purple-400 italic">no outputs</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

GroupNode.displayName = 'GroupNode'