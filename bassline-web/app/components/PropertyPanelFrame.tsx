import React from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '~/lib/utils'
import { Button } from '~/components/ui/button'
import type { PropertyPanelFrame } from '~/propagation-react/types/property-panel'
import { ContactPropertySection, GroupPropertySection } from './PropertyPanelItem'
import { useContact } from '~/propagation-react/hooks/useContact'
import { useGroup } from '~/propagation-react/hooks/useGroup'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'
import { useContextSelection } from '~/propagation-react/hooks/useContextSelection'
import { usePropertyPanelStack } from '~/propagation-react/contexts/PropertyPanelStackContext'

interface PropertyPanelFrameProps {
  frame: PropertyPanelFrame
  isTop: boolean
  visibleDepth: number // 0 for top, 1 for second, etc.
  onNavigateBack?: () => void
  onSetDirty?: (dirty: boolean) => void
  onSetFocused?: (focused: boolean) => void
  shouldFocus?: React.MutableRefObject<boolean>
}

export function PropertyPanelFrame({ 
  frame, 
  isTop, 
  visibleDepth,
  onNavigateBack,
  onSetDirty,
  onSetFocused,
  shouldFocus 
}: PropertyPanelFrameProps) {
  // Calculate visual properties based on depth
  const offset = visibleDepth * 10 // pixels to offset each frame
  const opacity = Math.max(0.3, 1 - visibleDepth * 0.3)
  const scale = Math.max(0.95, 1 - visibleDepth * 0.02)
  const blur = visibleDepth > 0 ? visibleDepth * 2 : 0

  return (
    <div
      className={cn(
        "absolute inset-0 bg-gray-800 border-l border-gray-700 rounded-l-lg transition-all duration-300",
        !isTop && "cursor-pointer hover:translate-x-2",
        isTop ? "shadow-2xl" : "shadow-lg"
      )}
      style={{
        transform: `translateX(${offset}px) scale(${scale})`,
        opacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        transformOrigin: 'left center',
        zIndex: 100 - visibleDepth
      }}
      onClick={!isTop ? onNavigateBack : undefined}
    >
      {/* Frame Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {frame.depth > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation()
                onNavigateBack?.()
              }}
              className="p-1 h-6 w-6"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
          <h3 className="text-sm font-medium text-gray-200">
            {frame.title}
          </h3>
        </div>
        {frame.depth > 0 && (
          <span className="text-xs text-gray-400">
            Level {frame.depth + 1}
          </span>
        )}
      </div>

      {/* Frame Content */}
      <div className={cn(
        "p-4 overflow-y-auto scrollbar-hide",
        "max-h-[calc(100vh-200px)]",
        !isTop && "pointer-events-none" // Prevent interaction with non-top frames
      )}>
        {frame.type === 'selection' && frame.targetIds && (
          <SelectionFrameContent 
            targetIds={frame.targetIds} 
            onSetDirty={isTop ? onSetDirty : undefined}
            onSetFocused={isTop ? onSetFocused : undefined}
            shouldFocus={isTop ? shouldFocus : undefined}
          />
        )}
        {frame.type === 'contact' && frame.targetId && (
          <ContactFrameContent 
            contactId={frame.targetId} 
            onSetDirty={isTop ? onSetDirty : undefined}
            onSetFocused={isTop ? onSetFocused : undefined}
            shouldFocus={isTop ? shouldFocus : undefined}
          />
        )}
        {frame.type === 'group' && frame.targetId && (
          <GroupFrameContent 
            groupId={frame.targetId} 
            onSetDirty={isTop ? onSetDirty : undefined}
            onSetFocused={isTop ? onSetFocused : undefined}
            shouldFocus={isTop ? shouldFocus : undefined}
          />
        )}
      </div>
    </div>
  )
}

// Frame content components
function SelectionFrameContent({ 
  targetIds, 
  onSetDirty,
  onSetFocused,
  shouldFocus 
}: { 
  targetIds: string[]
  onSetDirty?: (dirty: boolean) => void
  onSetFocused?: (focused: boolean) => void
  shouldFocus?: React.MutableRefObject<boolean> 
}) {
  const { selectedContacts, selectedGroups } = useContextSelection()
  const [expandedItems, setExpandedItems] = React.useState<Set<string>>(new Set())
  
  // Filter to only show items that are in targetIds
  const contacts = selectedContacts.filter(c => targetIds.includes(c.id))
  const groups = selectedGroups.filter(g => targetIds.includes(g.id))
  
  const toggleExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }
  
  return (
    <div className="space-y-2">
      {/* Render contact properties */}
      {contacts.map((contact, index) => (
        <div key={contact.id}>
          {index > 0 && <div className="border-t border-gray-700 mt-2" />}
          <ContactPropertySection
            contactId={contact.id}
            isExpanded={expandedItems.has(contact.id)}
            onToggle={() => toggleExpanded(contact.id)}
            isFocused={false}
            hideToggle={false}
            onSetDirty={onSetDirty}
            onSetFocused={onSetFocused}
          />
        </div>
      ))}
      
      {/* Render group properties */}
      {groups.map((group, index) => (
        <div key={group.id}>
          {(contacts.length > 0 || index > 0) && <div className="border-t border-gray-700 mt-2" />}
          <GroupPropertySection
            groupId={group.id}
            isExpanded={expandedItems.has(group.id)}
            onToggle={() => toggleExpanded(group.id)}
            isFocused={false}
            hideToggle={false}
            onSetDirty={onSetDirty}
            onSetFocused={onSetFocused}
          />
        </div>
      ))}
    </div>
  )
}

function ContactFrameContent({ 
  contactId, 
  onSetDirty,
  onSetFocused,
  shouldFocus 
}: { 
  contactId: string
  onSetDirty?: (dirty: boolean) => void
  onSetFocused?: (focused: boolean) => void
  shouldFocus?: React.MutableRefObject<boolean> 
}) {
  const contact = useContact(contactId)
  
  if (!contact) return null
  
  return (
    <ContactPropertySection
      contactId={contactId}
      isExpanded={true}
      onToggle={() => {}}
      isFocused={true}
      onSetDirty={onSetDirty}
      onSetFocused={onSetFocused}
    />
  )
}

function GroupFrameContent({ 
  groupId, 
  onSetDirty,
  onSetFocused,
  shouldFocus 
}: { 
  groupId: string
  onSetDirty?: (dirty: boolean) => void
  onSetFocused?: (focused: boolean) => void
  shouldFocus?: React.MutableRefObject<boolean> 
}) {
  const group = useGroup(groupId)
  
  if (!group) return null
  
  return (
    <GroupPropertySection
      groupId={groupId}
      isExpanded={true}
      onToggle={() => {}}
      isFocused={true}
      onSetDirty={onSetDirty}
      onSetFocused={onSetFocused}
    />
  )
}