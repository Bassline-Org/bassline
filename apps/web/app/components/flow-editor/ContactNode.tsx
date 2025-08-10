import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'

export function ContactNode({ data, selected }: NodeProps) {
  return (
    <div 
      className={`
        px-4 py-2 shadow-md rounded-md bg-white border-2
        ${selected ? 'border-blue-500' : 'border-gray-200'}
        min-w-[150px]
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400"
      />
      
      <div className="text-sm font-medium text-gray-700">
        Contact
      </div>
      
      <div className="text-xs text-gray-500 mt-1">
        {data.content || '(empty)'}
      </div>
      
      {data.blendMode && (
        <div className="text-xs text-gray-400 mt-1">
          Mode: {data.blendMode}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-gray-400"
      />
    </div>
  )
}