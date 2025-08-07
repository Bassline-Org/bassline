import React, { memo } from 'react'
import { PropertyPanel } from './PropertyPanel'
import { usePropertyPanel } from '~/propagation-react/hooks/usePropertyPanel'
import { useContactSelection } from '~/propagation-react/hooks/useContactSelection'
import { useSoundToast } from '~/hooks/useSoundToast'

interface PropertyPanelContainerProps {
  currentMode: string
  onEnterPropertyMode: (nodeId: string) => void
  onExitMode: () => void
  setHighlightedNodeId: (id: string | null) => void
}

// Memoized property panel container to prevent re-renders from canvas updates
export const PropertyPanelContainer = memo(function PropertyPanelContainer({
  currentMode,
  onEnterPropertyMode,
  onExitMode,
  setHighlightedNodeId
}: PropertyPanelContainerProps) {
  const propertyPanel = usePropertyPanel()
  const { selectedContacts, selectedGroups } = useContactSelection()
  const { error: toastError } = useSoundToast()

  return (
    <PropertyPanel
      isVisible={currentMode === 'property'}
      isDirty={propertyPanel.isDirty}
      isFocused={propertyPanel.isFocused}
      onToggleVisibility={() => {
        if (currentMode === 'property') {
          const closed = propertyPanel.tryClose();
          if (closed) {
            onExitMode();
            setHighlightedNodeId(null);
          } else {
            toastError('Save or cancel your changes first', { duration: 2000 });
          }
        } else {
          // Get selected items to enter property mode
          const selectedIds = [...selectedContacts.map(c => c.id), ...selectedGroups.map(g => g.id)];
          if (selectedIds.length > 0) {
            onEnterPropertyMode(selectedIds[0]);
          }
        }
      }}
      onSetDirty={propertyPanel.setIsDirty}
      onSetFocused={propertyPanel.setIsFocused}
      shouldFocus={propertyPanel.shouldFocus}
    />
  )
}, (prevProps, nextProps) => {
  // Only re-render if currentMode changes
  // The property panel manages its own state internally
  return prevProps.currentMode === nextProps.currentMode
})