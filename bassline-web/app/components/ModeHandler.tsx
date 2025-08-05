import { useCallback } from 'react'
import { useModeContext } from '~/propagation-react/contexts/ModeContext'
import { useNetworkState } from '~/propagation-react/contexts/NetworkState'
import { useSoundSystem } from './SoundSystem'
import { useSoundToast } from '~/hooks/useSoundToast'
import { useReactFlow } from '@xyflow/react'

// Hook that provides keyboard handling and mode logic
export function useModeHandlers(mousePosition: { x: number, y: number } = { x: 0, y: 0 }) {
  const { currentMode, setMode, exitMode, setValenceSources } = useModeContext()
  const { state, clearSelection, removeContact, addContact, extractContactsToNewGroup, removeWire, removeGroup, updateContact } = useNetworkState()
  const { selectedContactIds, currentGroupId } = state
  const { playSound } = useSoundSystem()
  const toast = useSoundToast()
  const { getEdges, getViewport } = useReactFlow()
  
  // Handle keyboard shortcuts through React event
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    // Don't handle if typing in an input
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return
    }
    
    // Escape - exit mode or clear selection
    if (event.key === 'Escape') {
      if (currentMode !== 'normal') {
        exitMode()
        playSound('ui/tool-disable')
      } else {
        clearSelection()
        playSound('ui/tool-disable')
      }
      return
    }
    
    // C - Copy selected contacts
    if (event.key === 'c' && (event.metaKey || event.ctrlKey) && selectedContactIds.length > 0) {
      event.preventDefault()
      
      // Store contact data in clipboard format
      const contactsToCopy = selectedContactIds.map(id => {
        const contact = state.contacts[id]
        return {
          content: contact?.content || '',
          blendMode: contact?.blendMode || 'accept-last',
          isBoundary: contact?.isBoundary || false,
          boundaryDirection: contact?.boundaryDirection
        }
      })
      
      // Store in clipboard and internal state
      navigator.clipboard.writeText(JSON.stringify({
        type: 'bassline-contacts',
        contacts: contactsToCopy
      }))
      
      playSound('ui/copy')
      toast.success(`Copied ${selectedContactIds.length} contact${selectedContactIds.length > 1 ? 's' : ''}`)
      return
    }
    
    // V - Paste contacts (when not in valence mode)
    if (event.key === 'v' && (event.metaKey || event.ctrlKey) && currentMode === 'normal') {
      event.preventDefault()
      
      navigator.clipboard.readText().then(text => {
        try {
          const data = JSON.parse(text)
          if (data.type === 'bassline-contacts' && Array.isArray(data.contacts)) {
            const viewport = getViewport()
            const centerX = (window.innerWidth / 2 - 320 - viewport.x) / viewport.zoom
            const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom
            
            data.contacts.forEach((contactData: any, index: number) => {
              addContact(currentGroupId, {
                ...contactData,
                position: {
                  x: centerX + (index % 3) * 80,
                  y: centerY + Math.floor(index / 3) * 80
                }
              })
            })
            
            playSound('ui/paste')
            toast.success(`Pasted ${data.contacts.length} contact${data.contacts.length > 1 ? 's' : ''}`)
          }
        } catch (e) {
          // Not valid JSON or not our format
        }
      })
      return
    }
    
    // V - Enter valence mode (without modifier keys)
    if (event.key === 'v' && !event.metaKey && !event.ctrlKey && currentMode === 'normal' && selectedContactIds.length > 0) {
      event.preventDefault()
      setMode('valence')
      setValenceSources(selectedContactIds)
      clearSelection()
      playSound('ui/tool-enable')
      toast.info('Valence mode: Click compatible targets to connect')
      return
    }
    
    // Exit valence mode with V or Escape
    if ((event.key === 'v' || event.key === 'Escape') && currentMode === 'valence') {
      event.preventDefault()
      exitMode()
      playSound('ui/tool-disable')
      return
    }
    
    // Delete/Backspace - delete selected items
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      
      // Check for selected edges
      const edges = getEdges()
      const selectedEdges = edges.filter(edge => edge.selected)
      
      if (selectedEdges.length > 0) {
        // Delete selected edges
        selectedEdges.forEach(edge => {
          removeWire(edge.id)
        })
        playSound('connection/delete')
        toast.success(`Deleted ${selectedEdges.length} wire${selectedEdges.length === 1 ? '' : 's'}`)
        return
      }
      
      // Delete selected groups
      if (state.selectedGroupIds.length > 0) {
        state.selectedGroupIds.forEach(groupId => {
          removeGroup(groupId)
        })
        playSound('gadget/delete')
        toast.success(`Deleted ${state.selectedGroupIds.length} group${state.selectedGroupIds.length === 1 ? '' : 's'}`)
        return
      }
      
      // Delete selected contacts
      if (selectedContactIds.length > 0) {
        selectedContactIds.forEach(contactId => {
          removeContact(contactId)
        })
        playSound('node/delete')
        toast.success(`Deleted ${selectedContactIds.length} contact${selectedContactIds.length === 1 ? '' : 's'}`)
        return
      }
    }
    
    // G - Create group from selected contacts
    if (event.key === 'g' && selectedContactIds.length >= 1) {
      event.preventDefault()
      
      const groupName = `Group ${Object.keys(state.groups).length}`
      extractContactsToNewGroup(selectedContactIds, groupName)
      
      playSound('gadget/create')
      toast.success(`Extracted ${selectedContactIds.length} contact${selectedContactIds.length > 1 ? 's' : ''} to ${groupName}`)
      return
    }
    
    // A - Add new contact at mouse position
    if (event.key === 'a' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      
      addContact(currentGroupId, {
        content: '',
        blendMode: 'accept-last',
        position: mousePosition,
        isBoundary: false
      })
      
      playSound('node/create')
      toast.success('Contact created')
      return
    }
    
    // B - Add boundary contact at mouse position
    if (event.key === 'b' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault()
      
      addContact(currentGroupId, {
        content: '',
        blendMode: 'accept-last',
        position: mousePosition,
        isBoundary: true,
        boundaryDirection: 'input'
      })
      
      playSound('ui/boundary-create')
      toast.success('Boundary contact created')
      return
    }
    
    // H - Align selected nodes horizontally
    if (event.key === 'h' && selectedContactIds.length > 1) {
      event.preventDefault()
      
      const edges = getEdges()
      const selectedNodes = edges.filter(e => selectedContactIds.includes(e.id))
      
      // Find average Y position
      let totalY = 0
      let count = 0
      selectedContactIds.forEach(id => {
        const contact = state.contacts[id]
        if (contact) {
          totalY += contact.position.y
          count++
        }
      })
      
      if (count > 0) {
        const avgY = totalY / count
        selectedContactIds.forEach(id => {
          updateContact(id, { position: { ...state.contacts[id].position, y: avgY } })
        })
        playSound('ui/align')
        toast.success('Aligned horizontally')
      }
      return
    }
    
    // Shift+H - Distribute horizontally
    if (event.key === 'H' && event.shiftKey && selectedContactIds.length > 2) {
      event.preventDefault()
      
      // Sort contacts by X position
      const sortedContacts = selectedContactIds
        .map(id => ({ id, x: state.contacts[id]?.position.x || 0 }))
        .sort((a, b) => a.x - b.x)
      
      const leftmost = sortedContacts[0].x
      const rightmost = sortedContacts[sortedContacts.length - 1].x
      const spacing = (rightmost - leftmost) / (sortedContacts.length - 1)
      
      sortedContacts.forEach((contact, index) => {
        const newX = leftmost + (spacing * index)
        updateContact(contact.id, { position: { ...state.contacts[contact.id].position, x: newX } })
      })
      
      playSound('ui/align')
      toast.success('Distributed horizontally')
      return
    }
  }, [currentMode, selectedContactIds, setMode, exitMode, setValenceSources, clearSelection, 
      playSound, toast, removeContact, removeWire, removeGroup, addContact, extractContactsToNewGroup, updateContact, currentGroupId, state, getEdges, getViewport, mousePosition])
  
  return {
    handleKeyDown
  }
}