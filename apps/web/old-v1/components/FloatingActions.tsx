import { useCallback } from 'react'
import { useNetworkState } from '~/propagation-react/contexts/NetworkState'
import { useSoundSystem } from './SoundSystem'
import { useSoundToast } from '~/hooks/useSoundToast'
import { useReactFlow } from '@xyflow/react'
import { Plus, Circle, Square } from 'lucide-react'

export function FloatingActions() {
  const { addContact, state } = useNetworkState()
  const { currentGroupId, selectedContactIds } = state
  const { playSound } = useSoundSystem()
  const toast = useSoundToast()
  const { screenToFlowPosition } = useReactFlow()
  
  const handleAddContact = useCallback((event: React.MouseEvent) => {
    const position = screenToFlowPosition({ 
      x: window.innerWidth / 2 - 320, 
      y: window.innerHeight / 2 
    })
    
    addContact(currentGroupId, {
      content: '',
      blendMode: 'accept-last',
      position,
      isBoundary: false
    })
    
    playSound('node/create')
    toast.success('Contact created')
  }, [addContact, currentGroupId, screenToFlowPosition, playSound, toast])
  
  const handleAddBoundary = useCallback((event: React.MouseEvent) => {
    const position = project({ 
      x: window.innerWidth / 2 - 320, 
      y: window.innerHeight / 2 
    })
    
    addContact(currentGroupId, {
      content: '',
      blendMode: 'accept-last',
      position,
      isBoundary: true,
      boundaryDirection: 'input'
    })
    
    playSound('ui/boundary-create')
    toast.success('Boundary contact created')
  }, [addContact, currentGroupId, screenToFlowPosition, playSound, toast])
  
  // Only show when nothing is selected
  if (selectedContactIds.length > 0) {
    return null
  }
  
  return (
    <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-2">
      <button
        onClick={handleAddBoundary}
        className="w-12 h-12 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        title="Add boundary contact (B)"
      >
        <Square className="w-5 h-5" />
      </button>
      <button
        onClick={handleAddContact}
        className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all flex items-center justify-center group"
        title="Add contact (A)"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}