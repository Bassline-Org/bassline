import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardContent } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'
import type { ContactNodeData } from './ContactNode'

export const BoundaryNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as ContactNodeData
  return (
    <Card 
      className={`min-w-[100px] border-2 border-dashed ${
        selected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-400'
      }`}
    >
      <Handle 
        type="target" 
        position={Position.Left}
        style={{ background: '#555' }}
      />
      <Handle 
        type="source" 
        position={Position.Right}
        style={{ background: '#555' }}
      />
      
      <CardContent className="p-2">
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="text-xs self-center">
            boundary
          </Badge>
          <div className="text-sm font-mono text-center">
            {nodeData.content !== undefined ? String(nodeData.content) : '∅'}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})