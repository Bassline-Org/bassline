import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardHeader, CardContent } from '~/components/ui/card'
import { Package, Lock } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'

const groupNodeVariants = cva(
  "min-w-[200px] transition-all shadow-md hover:shadow-lg",
  {
    variants: {
      nodeType: {
        group: "node-gradient-group node-border-group",
        primitive: "node-gradient-primitive node-border-primitive"
      },
      selected: {
        true: "ring-2",
        false: ""
      },
      interactive: {
        true: "cursor-pointer",
        false: "cursor-default"
      }
    },
    compoundVariants: [
      {
        nodeType: "group",
        selected: true,
        className: "node-ring-group"
      },
      {
        nodeType: "primitive",
        selected: true,
        className: "node-ring-primitive"
      }
    ],
    defaultVariants: {
      nodeType: "group",
      selected: false,
      interactive: true
    }
  }
)

const groupHandleVariants = cva(
  "!w-3 !h-3",
  {
    variants: {
      nodeType: {
        group: "[&]:bg-[var(--node-group)] [&]:border-[color-mix(in_oklch,var(--node-group),black_20%)]",
        primitive: "[&]:bg-[var(--node-primitive)] [&]:border-[color-mix(in_oklch,var(--node-primitive),black_20%)]"
      }
    },
    defaultVariants: {
      nodeType: "group"
    }
  }
)

export interface GroupNodeData {
  name: string
  onNavigate?: () => void
  inputContacts: { id: string; name?: string }[]
  outputContacts: { id: string; name?: string }[]
  isPrimitive?: boolean
}

export const GroupNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as GroupNodeData
  const handleDoubleClick = useCallback(() => {
    if (nodeData.onNavigate) {
      nodeData.onNavigate()
    }
  }, [nodeData])
  
  const maxContacts = Math.max(nodeData.inputContacts.length, nodeData.outputContacts.length, 1)
  const nodeType = nodeData.isPrimitive ? 'primitive' : 'group'
  const interactive = !!nodeData.onNavigate
  
  return (
    <Card 
      className={cn(groupNodeVariants({ nodeType, selected, interactive }))}
      onDoubleClick={handleDoubleClick}
    >
      <CardHeader className="p-3 pb-2 border-b border-opacity-20">
        <div className="flex items-center gap-2">
          {nodeData.onNavigate ? (
            <Package className={cn("w-4 h-4", nodeData.isPrimitive ? "[&]:text-[var(--node-primitive)]" : "[&]:text-[var(--node-group)]")} />
          ) : (
            <Lock className={cn("w-4 h-4", nodeData.isPrimitive ? "[&]:text-[var(--node-primitive)]" : "[&]:text-[var(--node-group)]")} />
          )}
          <div className="font-semibold text-sm">{nodeData.name}</div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex" style={{ minHeight: `${maxContacts * 28}px` }}>
          {/* Input contacts (left side) */}
          <div className="flex-1 flex flex-col border-r border-current border-opacity-20">
            {nodeData.inputContacts.map((contact, index) => (
              <div key={contact.id} className="relative flex items-center h-7">
                <Handle
                  type="target"
                  position={Position.Left}
                  id={contact.id}
                  className={groupHandleVariants({ nodeType })}
                  style={{ left: '-8px' }}
                />
                <div className="pl-3 pr-2 w-full">
                  <span className="text-xs font-medium opacity-80">{contact.name || `in${index + 1}`}</span>
                </div>
              </div>
            ))}
            {nodeData.inputContacts.length === 0 && (
              <div className="flex-1 flex items-center justify-center min-h-[40px]">
                <span className="text-xs italic opacity-50">no inputs</span>
              </div>
            )}
          </div>
          
          {/* Output contacts (right side) */}
          <div className="flex-1 flex flex-col">
            {nodeData.outputContacts.map((contact, index) => (
              <div key={contact.id} className="relative flex items-center justify-end h-7">
                <div className="pl-2 pr-3 w-full text-right">
                  <span className="text-xs font-medium opacity-80">{contact.name || `out${index + 1}`}</span>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={contact.id}
                  className={groupHandleVariants({ nodeType })}
                  style={{ right: '-8px' }}
                />
              </div>
            ))}
            {nodeData.outputContacts.length === 0 && (
              <div className="flex-1 flex items-center justify-center min-h-[40px]">
                <span className="text-xs italic opacity-50">no outputs</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
})

GroupNode.displayName = 'GroupNode'