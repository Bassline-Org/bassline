import { useState, useEffect } from 'react'
import { Button } from '~/components/ui/button'
import { ChevronLeft, ChevronRight, Settings } from 'lucide-react'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'
import { useNetworkContext } from '~/propagation-react/contexts/NetworkContext'
import { ContactPropertySection, GroupPropertySection } from './PropertyPanelItem'

interface PropertyPanelProps {
  isVisible: boolean
  onToggleVisibility: () => void
  shouldFocus: React.MutableRefObject<boolean>
}

export function PropertyPanel({ isVisible, onToggleVisibility, shouldFocus }: PropertyPanelProps) {
  const { selectedContacts, selectedGroups } = useContactSelection()
  const { setHighlightedNodeId } = useNetworkContext()
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [focusedItemId, setFocusedItemId] = useState<string | null>(null)
  
  // Auto-expand single selection
  useEffect(() => {
    const totalSelected = selectedContacts.length + selectedGroups.length
    
    if (totalSelected === 1) {
      const itemId = selectedContacts.length === 1 
        ? selectedContacts[0].id 
        : selectedGroups[0].id
      setExpandedItems(new Set([itemId]))
      setFocusedItemId(itemId)
    } else if (totalSelected === 0) {
      setExpandedItems(new Set())
      setFocusedItemId(null)
    }
  }, [selectedContacts, selectedGroups])

  // Update highlighted node based on focused item
  useEffect(() => {
    setHighlightedNodeId(focusedItemId)
  }, [focusedItemId, setHighlightedNodeId])

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
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Selection info */}
        {(selectedContacts.length + selectedGroups.length) > 0 && (
          <div className="text-xs text-gray-400 mb-3">
            {selectedContacts.length + selectedGroups.length} items selected
            {selectedContacts.length > 0 && ` (${selectedContacts.length} contacts`}
            {selectedGroups.length > 0 && `${selectedContacts.length > 0 ? ', ' : ' ('}${selectedGroups.length} gadgets`}
            {(selectedContacts.length > 0 || selectedGroups.length > 0) && ')'}
          </div>
        )}
        
        {/* No selection message */}
        {selectedContacts.length === 0 && selectedGroups.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">
            Select items to edit their properties
          </div>
        )}
        
        {/* Property sections */}
        <div className="space-y-3">
          {/* Contact sections */}
          {selectedContacts.map((contact) => (
            <ContactPropertySection
              key={contact.id}
              contactId={contact.id}
              isExpanded={expandedItems.has(contact.id)}
              onToggle={() => toggleExpanded(contact.id)}
              isFocused={focusedItemId === contact.id}
            />
          ))}
          
          {/* Group sections */}
          {selectedGroups.map((group) => (
            <GroupPropertySection
              key={group.id}
              groupId={group.id}
              isExpanded={expandedItems.has(group.id)}
              onToggle={() => toggleExpanded(group.id)}
              isFocused={focusedItemId === group.id}
            />
          ))}
        </div>
      </div>
    </div>
  )
}