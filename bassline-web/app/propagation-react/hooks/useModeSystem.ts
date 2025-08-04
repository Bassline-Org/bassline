/**
 * React hook for integrating the mode system
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNetworkContext } from '../contexts/NetworkContext'
import { useContextSelection } from './useContextSelection'
import { 
  modeManager,
  createModeContext,
  SelectionImpl,
  createDefaultInteractionPoint,
  createDefaultViewState,
  EditMode,
  ReadMode,
  ValenceMode,
  QuickPropertyMode,
  GridSnapMode,
  FocusMode,
  SoundMode,
  type ModeContext,
  type Commands,
  type InteractionPoint,
  type ViewState,
  type ClickTarget,
  type DragTarget,
  type DragEvent,
  type HoverTarget,
  type ModeInfo
} from '../modes'

// Initialize and register all modes
const initializeModes = () => {
  // Register major modes
  modeManager.registerMajorMode(new EditMode())
  modeManager.registerMajorMode(new ReadMode())
  
  // Register minor modes
  modeManager.registerMinorMode(new ValenceMode())
  modeManager.registerMinorMode(new QuickPropertyMode())
  modeManager.registerMinorMode(new GridSnapMode())
  modeManager.registerMinorMode(new FocusMode())
  modeManager.registerMinorMode(new SoundMode())
}

// Initialize modes once
if (typeof window !== 'undefined') {
  initializeModes()
}

export interface UseModeSystemReturn {
  // Current state
  currentMajorMode: string | null
  activeMinorModes: string[]
  availableModes: ModeInfo[]
  
  // Mode control
  switchMajorMode: (modeId: string) => void
  toggleMinorMode: (modeId: string) => void
  
  // Interaction handlers
  handleClick: (target: ClickTarget) => boolean
  handleDoubleClick: (target: ClickTarget) => boolean
  handleRightClick: (target: ClickTarget) => boolean
  handleDragStart: (target: DragTarget) => boolean
  handleDrag: (event: DragEvent) => boolean
  handleDragEnd: (event: DragEvent) => boolean
  handleKeyPress: (event: KeyboardEvent) => boolean
  handleHover: (target: HoverTarget) => boolean
  
  // Visual state
  getCursor: () => string
  getNodeClassName: (nodeId: string) => string
  getEdgeClassName: (edgeId: string) => string
  
  // Annotations
  annotations: any // Type will be Annotations from implementation
  
  // Permissions
  canEdit: boolean
  canSelect: boolean
  canConnect: boolean
}

export function useModeSystem(): UseModeSystemReturn {
  const { network, syncToReactFlow } = useNetworkContext()
  const { selectedContacts, selectedGroups, selectContact, clearSelection } = useContextSelection()
  
  // Track current state
  const [currentMajorMode, setCurrentMajorMode] = useState<string | null>('edit')
  const [activeMinorModes, setActiveMinorModes] = useState<string[]>([])
  const [focus, setFocus] = useState<string | null>(null)
  const [interactionPoint, setInteractionPoint] = useState<InteractionPoint>(createDefaultInteractionPoint())
  const [viewState, setViewState] = useState<ViewState>(() => 
    createDefaultViewState(network.currentGroup.id)
  )
  
  // Create selection implementation
  const selection = useMemo(() => {
    const sel = new SelectionImpl()
    // Populate from context selection
    selectedContacts.forEach(contact => sel.nodes.add(contact.id))
    selectedGroups.forEach(group => sel.nodes.add(group.id))
    return sel
  }, [selectedContacts, selectedGroups])
  
  // Create commands implementation
  const commands: Commands = useMemo(() => ({
    // Selection
    select: (ids: string[]) => {
      if (ids.length === 0) {
        clearSelection()
      } else {
        // Use exclusive selection for the first item, then add the rest
        selectContact(ids[0], true)
        for (let i = 1; i < ids.length; i++) {
          selectContact(ids[i], false)
        }
      }
    },
    addToSelection: (ids: string[]) => {
      ids.forEach(id => selectContact(id, false))
    },
    removeFromSelection: (ids: string[]) => {
      // Need to implement in context selection
      console.log('removeFromSelection not yet implemented', ids)
    },
    clearSelection: () => clearSelection(),
    
    // Focus
    setFocus: (id: string | null) => setFocus(id),
    
    // Network mutations
    connect: (fromId: string, toId: string) => {
      network.connect(fromId, toId)
      syncToReactFlow()
    },
    disconnect: (edgeId: string) => {
      // Need to implement wire removal by ID
      console.log('disconnect not yet implemented', edgeId)
    },
    setValue: (nodeId: string, value: any) => {
      const contact = network.currentGroup.contacts.get(nodeId)
      if (contact) {
        contact.setContent(value)
        syncToReactFlow()
      }
    },
    moveNode: (nodeId: string, position: { x: number; y: number }) => {
      const contact = network.currentGroup.contacts.get(nodeId)
      if (contact) {
        contact.position = position
      } else {
        const group = network.currentGroup.subgroups.get(nodeId)
        if (group) {
          group.position = position
        }
      }
      syncToReactFlow()
    },
    createNode: (position: { x: number; y: number }, type: 'contact' | 'boundary') => {
      if (type === 'contact') {
        const contact = network.addContact(position)
        syncToReactFlow()
        return contact.id
      } else {
        const boundary = network.addBoundaryContact(position, 'input', 'boundary')
        syncToReactFlow()
        return boundary.id
      }
    },
    deleteNode: (nodeId: string) => {
      network.currentGroup.removeContact(nodeId)
      // Also try to remove as subgroup
      const subgroup = network.currentGroup.subgroups.get(nodeId)
      if (subgroup) {
        network.currentGroup.subgroups.delete(nodeId)
      }
      syncToReactFlow()
    },
    
    // Navigation
    navigateToGroup: (groupId: string) => {
      const group = network.currentGroup.subgroups.get(groupId)
      if (group) {
        network.currentGroup = group
        setViewState(createDefaultViewState(groupId))
        syncToReactFlow()
      }
    },
    navigateToParent: () => {
      if (network.currentGroup.parent) {
        network.currentGroup = network.currentGroup.parent
        setViewState(createDefaultViewState(network.currentGroup.id))
        syncToReactFlow()
      }
    },
    
    // View
    panTo: (position: { x: number; y: number }) => {
      setViewState(prev => ({ ...prev, center: position }))
    },
    zoomTo: (level: number) => {
      setViewState(prev => ({ ...prev, zoom: level }))
    },
    
    // Mode control
    switchMajorMode: (modeId: string) => {
      setCurrentMajorMode(modeId)
    },
    exitCurrentMode: () => {
      setCurrentMajorMode('edit')
    },
    toggleMinorMode: (modeId: string) => {
      setActiveMinorModes(prev => {
        if (prev.includes(modeId)) {
          return prev.filter(id => id !== modeId)
        } else {
          return [...prev, modeId]
        }
      })
    }
  }), [network, syncToReactFlow, clearSelection, selectContact])
  
  // Create mode context
  const modeContext = useMemo<ModeContext>(() => {
    return createModeContext({
      network,
      selection,
      focus,
      viewState,
      interactionPoint,
      commands
    })
  }, [network, selection, focus, viewState, interactionPoint, commands])
  
  // Update mode manager when modes change
  const prevMajorModeRef = useRef<string | null>(null)
  useEffect(() => {
    if (currentMajorMode && currentMajorMode !== prevMajorModeRef.current) {
      prevMajorModeRef.current = currentMajorMode
      modeManager.switchMajorMode(currentMajorMode, modeContext)
    }
  }, [currentMajorMode, modeContext])
  
  useEffect(() => {
    // Get current active minor modes
    const currentActive = modeManager.getActiveMinorModes().map(m => m.id)
    
    // Enable new modes
    activeMinorModes.forEach(modeId => {
      if (!currentActive.includes(modeId)) {
        modeManager.toggleMinorMode(modeId, modeContext)
      }
    })
    
    // Disable removed modes
    currentActive.forEach(modeId => {
      if (!activeMinorModes.includes(modeId)) {
        modeManager.toggleMinorMode(modeId, modeContext)
      }
    })
  }, [activeMinorModes, modeContext])
  
  // Interaction handlers
  const handleClick = useCallback((target: ClickTarget) => {
    return modeManager.handleClick(target, modeContext)
  }, [modeContext])
  
  const handleDoubleClick = useCallback((target: ClickTarget) => {
    return modeManager.handleDoubleClick(target, modeContext)
  }, [modeContext])
  
  const handleRightClick = useCallback((target: ClickTarget) => {
    return modeManager.handleRightClick(target, modeContext)
  }, [modeContext])
  
  const handleDragStart = useCallback((target: DragTarget) => {
    return modeManager.handleDragStart(target, modeContext)
  }, [modeContext])
  
  const handleDrag = useCallback((event: DragEvent) => {
    return modeManager.handleDrag(event, modeContext)
  }, [modeContext])
  
  const handleDragEnd = useCallback((event: DragEvent) => {
    return modeManager.handleDragEnd(event, modeContext)
  }, [modeContext])
  
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    return modeManager.handleKeyPress(event, modeContext)
  }, [modeContext])
  
  const handleHover = useCallback((target: HoverTarget) => {
    return modeManager.handleHover(target, modeContext)
  }, [modeContext])
  
  // Visual state getters
  const getCursor = useCallback(() => {
    return modeManager.getCursor(modeContext)
  }, [modeContext])
  
  const getNodeClassName = useCallback((nodeId: string) => {
    return modeManager.getNodeClassName(nodeId, modeContext)
  }, [modeContext])
  
  const getEdgeClassName = useCallback((edgeId: string) => {
    return modeManager.getEdgeClassName(edgeId, modeContext)
  }, [modeContext])
  
  // Update interaction point
  const updateInteractionPoint = useCallback((point: Partial<InteractionPoint>) => {
    setInteractionPoint(prev => ({ ...prev, ...point }))
  }, [])
  
  // Expose this for components to update
  ;(window as any).__updateInteractionPoint = updateInteractionPoint
  
  return {
    // Current state
    currentMajorMode,
    activeMinorModes,
    availableModes: modeManager.getAvailableModes(),
    
    // Mode control
    switchMajorMode: setCurrentMajorMode,
    toggleMinorMode: (modeId: string) => {
      setActiveMinorModes(prev => {
        if (prev.includes(modeId)) {
          return prev.filter(id => id !== modeId)
        } else {
          return [...prev, modeId]
        }
      })
    },
    
    // Interaction handlers
    handleClick,
    handleDoubleClick,
    handleRightClick,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleKeyPress,
    handleHover,
    
    // Visual state
    getCursor,
    getNodeClassName,
    getEdgeClassName,
    
    // Annotations
    annotations: modeContext.annotations,
    
    // Permissions
    canEdit: modeManager.canEdit(modeContext),
    canSelect: modeManager.canSelect(modeContext),
    canConnect: modeManager.canConnect(modeContext)
  }
}