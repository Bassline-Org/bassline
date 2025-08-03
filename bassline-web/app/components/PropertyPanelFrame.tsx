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
  shouldFocus?: React.MutableRefObject<boolean>
}

export function PropertyPanelFrame({ 
  frame, 
  isTop, 
  visibleDepth,
  onNavigateBack,
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
        "p-4 overflow-y-auto",
        "max-h-[calc(100vh-200px)]",
        !isTop && "pointer-events-none" // Prevent interaction with non-top frames
      )}>
        {frame.type === 'selection' && frame.targetIds && (
          <SelectionFrameContent 
            targetIds={frame.targetIds} 
            shouldFocus={isTop ? shouldFocus : undefined}
          />
        )}
        {frame.type === 'contact' && frame.targetId && (
          <ContactFrameContent 
            contactId={frame.targetId} 
            shouldFocus={isTop ? shouldFocus : undefined}
          />
        )}
        {frame.type === 'group' && frame.targetId && (
          <GroupFrameContent 
            groupId={frame.targetId} 
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
  shouldFocus 
}: { 
  targetIds: string[]
  shouldFocus?: React.MutableRefObject<boolean> 
}) {
  const { pushFrame } = usePropertyPanelStack()
  const { selectedContacts, selectedGroups } = useContextSelection()
  
  // Filter to only show items that are in targetIds
  const contacts = selectedContacts.filter(c => targetIds.includes(c.id))
  const groups = selectedGroups.filter(g => targetIds.includes(g.id))
  
  const handleItemClick = (id: string, type: 'contact' | 'group', name: string) => {
    pushFrame({
      type,
      targetId: id,
      title: name
    })
  }
  
  return (
    <div className="space-y-2">
      {contacts.map(contact => (
        <button
          key={contact.id}
          className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          onClick={() => handleItemClick(contact.id, 'contact', `Contact ${contact.id.slice(0, 8)}`)}
        >
          <div className="text-sm font-medium text-gray-200">Contact</div>
          <div className="text-xs text-gray-400">{contact.id.slice(0, 16)}...</div>
        </button>
      ))}
      
      {groups.map(group => (
        <button
          key={group.id}
          className="w-full text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          onClick={() => handleItemClick(group.id, 'group', group.name || `Gadget ${group.id.slice(0, 8)}`)}
        >
          <div className="text-sm font-medium text-gray-200">{group.name || 'Gadget'}</div>
          <div className="text-xs text-gray-400">{group.id.slice(0, 16)}...</div>
        </button>
      ))}
    </div>
  )
}

function ContactFrameContent({ 
  contactId, 
  shouldFocus 
}: { 
  contactId: string
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
    />
  )
}

function GroupFrameContent({ 
  groupId, 
  shouldFocus 
}: { 
  groupId: string
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
    />
  )
}