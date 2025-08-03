import React, { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { ChevronLeft, ChevronRight, Settings, Layers } from 'lucide-react'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection'
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext'
import { usePropertyPanelStack } from '~/propagation-react/contexts/PropertyPanelStackContext'
import { PropertyPanelFrame } from './PropertyPanelFrame'
import { ContactPropertySection, GroupPropertySection } from './PropertyPanelItem'
import { cn } from '~/lib/utils'
import { useLoaderData, useNavigate } from 'react-router'
import type { clientLoader } from '~/routes/editor'

interface PropertyPanelProps {
  isVisible: boolean
  onToggleVisibility: () => void
  shouldFocus: React.MutableRefObject<boolean>
}

export function PropertyPanel({ isVisible, onToggleVisibility, shouldFocus }: PropertyPanelProps) {
  const { selectedContacts, selectedGroups } = useContextSelection() // Use context selection
  const { setHighlightedNodeId } = useNetworkContext()
  const { frames, currentFrame, pushFrame, popFrame, popToFrame, clearFrames } = usePropertyPanelStack()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  const loaderData = useLoaderData<typeof clientLoader>()
  const navigate = useNavigate()
  
  // Check if we're in property mode from URL
  const isPropertyMode = loaderData.mode === 'property'
  const nodeIdFromUrl = loaderData.nodeId
  
  // Update base frame when selection changes
  useEffect(() => {
    const totalSelected = selectedContacts.length + selectedGroups.length
    const contactIds = selectedContacts.map(c => c.id)
    const groupIds = selectedGroups.map(g => g.id)
    
    if (totalSelected > 0) {
      // Check if we need to update or create the base selection frame
      const baseFrame = frames[0]
      const newTargetIds = [...contactIds, ...groupIds]
      
      if (!baseFrame || baseFrame.type !== 'selection') {
        // No base frame or it's not a selection frame - create new
        clearFrames()
        pushFrame({
          type: 'selection',
          targetIds: newTargetIds,
          title: `${totalSelected} items selected`
        })
      } else {
        // Check if selection actually changed
        const currentIds = new Set(baseFrame.targetIds)
        const hasChanged = newTargetIds.length !== baseFrame.targetIds?.length ||
          !newTargetIds.every(id => currentIds.has(id))
        
        if (hasChanged) {
          // Selection changed - clear and recreate to update
          clearFrames()
          pushFrame({
            type: 'selection',
            targetIds: newTargetIds,
            title: `${totalSelected} items selected`
          })
        }
      }
    } else if (totalSelected === 0) {
      // Clear frames when nothing selected
      clearFrames()
    }
  }, [selectedContacts, selectedGroups, frames, pushFrame, clearFrames])

  // Update highlighted node based on current frame
  useEffect(() => {
    if (currentFrame && currentFrame.type !== 'selection' && currentFrame.targetId) {
      setHighlightedNodeId(currentFrame.targetId)
    } else {
      setHighlightedNodeId(null)
    }
  }, [currentFrame, setHighlightedNodeId])
  
  // Handle property panel show - check if we need to push a focused frame
  useEffect(() => {
    if (shouldFocus.current && frames.length > 0 && currentFrame?.type === 'selection') {
      // If we're showing with focus and only have a selection frame,
      // check if there's a single selected item to auto-focus
      const totalSelected = selectedContacts.length + selectedGroups.length
      if (totalSelected === 1) {
        if (selectedContacts.length === 1) {
          pushFrame({
            type: 'contact',
            targetId: selectedContacts[0].id,
            title: `Contact ${selectedContacts[0].id.slice(0, 8)}`
          })
        } else if (selectedGroups.length === 1) {
          pushFrame({
            type: 'group',
            targetId: selectedGroups[0].id,
            title: selectedGroups[0].name || `Gadget ${selectedGroups[0].id.slice(0, 8)}`
          })
        }
      }
      shouldFocus.current = false
    }
  }, [shouldFocus, frames, currentFrame, selectedContacts, selectedGroups, pushFrame])

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
      if (focusedItemId === itemId) {
        setFocusedItemId(null)
      }
    } else {
      newExpanded.add(itemId)
      setFocusedItemId(itemId)
    }
    setExpandedItems(newExpanded)
  }

  if (!isVisible) {
    return (
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={onToggleVisibility}
          size="sm"
          className="rounded-r-md rounded-l-none"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    )
  }
  
  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 h-[80vh] max-h-[600px] w-80 bg-gray-800 border-r border-gray-700 shadow-xl z-40 flex flex-col rounded-r-lg">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-gray-100">
            <Settings className="w-4 h-4" />
            Properties
          </h3>
          <Button
            onClick={onToggleVisibility}
            size="sm"
            variant="ghost"
            className="p-1"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Frame Stack */}
      <div className="flex-1 relative overflow-hidden">
        {frames.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="text-sm text-gray-400 text-center">
              Select items to edit their properties
            </div>
          </div>
        ) : (
          <div className="relative h-full">
            {/* Render visible frames (max 3) */}
            {frames.slice(-3).map((frame, index) => {
              const visibleDepth = Math.max(0, frames.length - 3) + index
              const isTop = index === frames.slice(-3).length - 1
              
              return (
                <PropertyPanelFrame
                  key={frame.id}
                  frame={frame}
                  isTop={isTop}
                  visibleDepth={frames.slice(-3).length - 1 - index}
                  onNavigateBack={() => popToFrame(frame.id)}
                  shouldFocus={shouldFocus}
                />
              )
            })}
            
            {/* Stack indicator */}
            {frames.length > 3 && (
              <div className="absolute top-4 left-4 text-xs text-gray-500 flex items-center gap-1">
                <Layers className="w-3 h-3" />
                +{frames.length - 3} more
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Frame breadcrumbs */}
      {frames.length > 0 && (
        <div className="border-t border-gray-700 p-2 flex items-center gap-1 text-xs overflow-x-auto">
          {frames.map((frame, index) => (
            <React.Fragment key={frame.id}>
              {index > 0 && <span className="text-gray-500">›</span>}
              <button
                className={cn(
                  "px-2 py-1 rounded hover:bg-gray-700 transition-colors",
                  index === frames.length - 1 ? "text-gray-200 bg-gray-700" : "text-gray-400"
                )}
                onClick={() => popToFrame(frame.id)}
              >
                {frame.title}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  )
}