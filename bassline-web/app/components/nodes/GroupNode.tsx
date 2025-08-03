import { memo, useCallback, useMemo, useEffect } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Card, CardHeader, CardContent } from '~/components/ui/card'
import { Package, Lock } from 'lucide-react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '~/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip'
import { useGroup } from '~/propagation-react/hooks/useGroup'
import { getGadgetIcon } from '~/components/gadgets/gadget-icons'
import { useValenceConnect } from '~/propagation-react/hooks/useValenceConnect'
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection'
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext'
import { useContextFrame } from '~/propagation-react/contexts/ContextFrameContext'
import { ValenceConnectOperation } from '~/propagation-core/refactoring/operations/ValenceConnect'
import { toast } from 'sonner'
import { useSound } from '~/components/SoundSystem'
import { useLoaderData, useFetcher } from 'react-router'
import type { clientLoader } from '~/routes/editor'

const groupNodeVariants = cva(
  "transition-all shadow-md hover:shadow-lg",
  {
    variants: {
      nodeType: {
        group: "node-gradient-group node-border-group min-w-[200px]",
        primitive: "node-gradient-primitive node-border-primitive w-fit"
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


export const GroupNode = memo(({ id, selected }: NodeProps) => {
  const { highlightedNodeId, network, syncToReactFlow } = useNetworkContext()
  const { name, inputContacts, outputContacts, isPrimitive, navigate } = useGroup(id)
  const { selectedGroups, selectedContacts } = useContextSelection()
  const { areGadgetsCompatible, isMixedSelectionCompatibleWithGadget } = useValenceConnect()
  const { activeToolInstance } = useContextFrame()
  const loaderData = useLoaderData<typeof clientLoader>()
  const fetcher = useFetcher()
  const { play: playConnectionSound } = useSound('connection/create')
  
  // Check if this gadget is valence-compatible
  const isValenceCompatible = useMemo(() => {
    // In valence mode, check if this gadget can be connected to
    if (loaderData.mode === 'valence' && loaderData.selection) {
      // In valence mode, check compatibility based on selection
      const selection = loaderData.selection as string[]
      
      // Get total output count from selection
      let totalOutputCount = 0
      for (const itemId of selection) {
        const contact = network.currentGroup.contacts.get(itemId)
        if (contact) {
          totalOutputCount++
        } else {
          const gadget = network.currentGroup.subgroups.get(itemId)
          if (gadget) {
            const { outputs } = gadget.getBoundaryContacts()
            totalOutputCount += outputs.length
          }
        }
      }
      
      // Check if this gadget can accept the outputs
      const targetGadget = network.currentGroup.subgroups.get(id)
      if (!targetGadget || selection.includes(id)) return false
      
      const { inputs } = targetGadget.getBoundaryContacts()
      return inputs.length === totalOutputCount
    }
    
    // Normal selection-based compatibility
    // Don't highlight if this gadget is selected
    if (selected) return false
    
    // Case 1: Another gadget is selected
    if (selectedGroups.length === 1 && selectedContacts.length === 0) {
      const selectedGadget = selectedGroups[0]
      return areGadgetsCompatible(selectedGadget.id, id)
    }
    
    // Case 2: Contacts are selected, check if they match this gadget's inputs/outputs
    if (selectedGroups.length === 0 && selectedContacts.length > 0) {
      const thisGroup = network.currentGroup.subgroups.get(id)
      if (!thisGroup) return false
      
      return ValenceConnectOperation.canConnectContactsToGadget(selectedContacts, thisGroup) ||
             ValenceConnectOperation.canConnectGadgetToContacts(thisGroup, selectedContacts)
    }
    
    // Case 3: Mixed selection (gadgets + contacts)
    if (selectedGroups.length >= 1 && selectedContacts.length > 0) {
      return isMixedSelectionCompatibleWithGadget(id)
    }
    
    return false
  }, [selectedGroups, selectedContacts, id, selected, areGadgetsCompatible, isMixedSelectionCompatibleWithGadget, network, loaderData.mode, loaderData.selection])
  
  // Visual states for valence mode
  const isSourceGadget = loaderData.mode === 'valence' && loaderData.selection?.includes(id)
  const isDimmed = (loaderData.mode === 'valence' && !isSourceGadget && !isValenceCompatible) ||
                   (highlightedNodeId !== null && !selected)
  
  // Check if this node is highlighted
  const isHighlighted = highlightedNodeId === id
  
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    
    // Handle valence mode clicks - perform connection directly
    if (loaderData.mode === 'valence' && isValenceCompatible) {
      const sourceIds = loaderData.selection as string[]
      
      // Separate contacts and gadgets
      const contactIds: string[] = []
      const gadgetIds: string[] = []
      
      for (const itemId of sourceIds) {
        if (network.currentGroup.contacts.has(itemId)) {
          contactIds.push(itemId)
        } else if (network.currentGroup.subgroups.has(itemId)) {
          gadgetIds.push(itemId)
        }
      }
      
      // Perform the connection
      const operation = new ValenceConnectOperation()
      const result = operation.executeMixedToGadget(
        network.currentGroup,
        gadgetIds,
        contactIds,
        id
      )
      
      if (result.success) {
        syncToReactFlow()
        
        // Play connection sounds
        if (result.connectionCount) {
          for (let i = 0; i < result.connectionCount; i++) {
            setTimeout(() => playConnectionSound(), i * 50)
          }
        }
        
        const targetGadget = network.currentGroup.subgroups.get(id)
        toast.success(`Connected ${result.connectionCount} wires to ${targetGadget?.name}`)
      } else {
        toast.error(result.message || 'Failed to connect')
      }
      
      // Submit form to exit valence mode
      fetcher.submit(
        {
          intent: 'connect-valence',
          sourceIds: JSON.stringify(sourceIds),
          targetId: id
        },
        { method: 'post' }
      )
      return
    }
    
    // Otherwise, no default click behavior for groups (selection is handled by React Flow)
  }, [loaderData.mode, loaderData.selection, isValenceCompatible, id, network, syncToReactFlow, playConnectionSound, fetcher])
  
  const handleDoubleClick = useCallback(() => {
    // Double-click navigates, but not in valence mode
    if (!isPrimitive && loaderData.mode !== 'valence') {
      navigate()
    }
  }, [isPrimitive, navigate, loaderData.mode])
  
  const maxContacts = Math.max(inputContacts.length, outputContacts.length, 1)
  const nodeType = isPrimitive ? 'primitive' : 'group'
  const interactive = !isPrimitive
  
  // Get icon for primitive gadgets
  const PrimitiveIcon = isPrimitive ? getGadgetIcon(name) : null
  
  return (
    <TooltipProvider>
      <Card 
        className={cn(
          groupNodeVariants({ nodeType, selected, interactive }), 
          isPrimitive && "p-[5px]",
          isValenceCompatible && !isSourceGadget && "ring-2 ring-green-500 ring-opacity-50 animate-pulse",
          isSourceGadget && "ring-2 ring-blue-500 ring-opacity-75",
          loaderData.mode === 'valence' && isValenceCompatible && "cursor-pointer",
          isDimmed && "opacity-30",
          isHighlighted && "ring-4 ring-blue-500 shadow-lg"
        )}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isPrimitive ? (
          // Primitive gadgets - just show icon
          <CardContent className="p-0 pb-0 flex items-center justify-center w-[40px] h-[40px]">
            {PrimitiveIcon && <PrimitiveIcon className="w-6 h-6 text-[var(--node-primitive)]" />}
          </CardContent>
        ) : (
          // Regular gadgets - show header with name
          <CardHeader className="p-3 pb-2 border-b border-opacity-20">
            <div className="flex items-center gap-2">
              {!isPrimitive ? (
                <Package className={cn("w-4 h-4", "[&]:text-[var(--node-group)]")} />
              ) : (
                <Lock className={cn("w-4 h-4", "[&]:text-[var(--node-group)]")} />
              )}
              <div className="font-semibold text-sm select-none">{name}</div>
            </div>
          </CardHeader>
        )}
        {!isPrimitive && (
          <CardContent className="p-0">
            <div className="flex" style={{ minHeight: `${maxContacts * 28}px` }}>
              {/* Input contacts (left side) */}
              <div className="flex-1 flex flex-col border-r border-current border-opacity-20">
                {inputContacts.map((contact, index) => (
                  <div key={contact.id} className="relative flex items-center h-7">
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={contact.id}
                      className="!w-6 !h-6 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                      style={{ 
                        left: '-12px',
                        background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
                      }}
                    />
                    <div className="pl-3 pr-2 w-full">
                      <span className="text-xs font-medium opacity-80 select-none">{contact.name || `in${index + 1}`}</span>
                    </div>
                  </div>
                ))}
                {inputContacts.length === 0 && (
                  <div className="flex-1 flex items-center justify-center min-h-[40px]">
                    <span className="text-xs italic opacity-50 select-none">no inputs</span>
                  </div>
                )}
              </div>
              
              {/* Output contacts (right side) */}
              <div className="flex-1 flex flex-col">
                {outputContacts.map((contact, index) => (
                  <div key={contact.id} className="relative flex items-center justify-end h-7">
                    <div className="pl-2 pr-3 w-full text-right">
                      <span className="text-xs font-medium opacity-80 select-none">{contact.name || `out${index + 1}`}</span>
                    </div>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={contact.id}
                      className="!w-6 !h-6 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                      style={{ 
                        right: '-12px',
                        background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
                      }}
                    />
                  </div>
                ))}
                {outputContacts.length === 0 && (
                  <div className="flex-1 flex items-center justify-center min-h-[40px]">
                    <span className="text-xs italic opacity-50 select-none">no outputs</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
        
        {/* Primitive gadget handles with tooltips */}
        {isPrimitive && (
          <>
            {/* Input handles */}
            {inputContacts.map((contact, index) => (
              <Tooltip key={contact.id}>
                <TooltipTrigger asChild>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={contact.id}
                    className="!w-5 !h-5 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                    style={{ 
                      left: '-10px',
                      top: `${15 + index * 20}px`,
                      background: 'linear-gradient(135deg, var(--node-primitive), color-mix(in oklch, var(--node-primitive), white 20%))'
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">{contact.name || `in${index + 1}`}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            
            {/* Output handles */}
            {outputContacts.map((contact, index) => (
              <Tooltip key={contact.id}>
                <TooltipTrigger asChild>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={contact.id}
                    className="!w-5 !h-5 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                    style={{ 
                      right: '-10px',
                      top: `${15 + index * 20}px`,
                      background: 'linear-gradient(135deg, var(--node-primitive), color-mix(in oklch, var(--node-primitive), white 20%))'
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">{contact.name || `out${index + 1}`}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </>
        )}
      </Card>
    </TooltipProvider>
  )
})

GroupNode.displayName = 'GroupNode'