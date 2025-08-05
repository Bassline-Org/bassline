import { useCallback } from 'react'
import { useNetworkState } from '~/propagation-react/contexts/NetworkState'
import { useModeContext } from '~/propagation-react/contexts/ModeContext'
import { useSoundSystem } from './SoundSystem'
import { useSoundToast } from '~/hooks/useSoundToast'
import { useReactFlow } from '@xyflow/react'
import { 
  Plus, 
  Calculator, 
  Type, 
  ToggleLeft, 
  ListFilter,
  Shuffle,
  Package,
  Grid,
  Layers,
  Group,
  Link2
} from 'lucide-react'

interface GadgetDefinition {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  createGadget: () => void
}

export function GadgetToolbar() {
  const { addGroup, state, extractContactsToNewGroup } = useNetworkState()
  const { currentGroupId, selectedContactIds } = state
  const { setMode, setValenceSources } = useModeContext()
  const { playSound } = useSoundSystem()
  const toast = useSoundToast()
  const { getViewport } = useReactFlow()
  
  const createGadgetAtCenter = useCallback((name: string, isPrimitive: boolean, setup?: (groupId: string) => void) => {
    const viewport = getViewport()
    const centerX = (window.innerWidth / 2 - 320 - viewport.x) / viewport.zoom
    const centerY = (window.innerHeight / 2 - viewport.y) / viewport.zoom
    
    const groupId = addGroup(currentGroupId, {
      name,
      position: { x: centerX - 60, y: centerY - 30 },
      contactIds: [],
      subgroupIds: [],
      boundaryContactIds: [],
      isPrimitive
    })
    
    if (setup) {
      setup(groupId)
    }
    
    playSound('gadget/create')
    toast.success(`${name} created`)
    
    return groupId
  }, [addGroup, currentGroupId, getViewport, playSound, toast])
  
  const gadgets: GadgetDefinition[] = [
    {
      id: 'adder',
      name: 'Adder',
      icon: <Plus className="w-4 h-4" />,
      description: 'Adds numeric values',
      createGadget: () => createGadgetAtCenter('Adder', true)
    },
    {
      id: 'multiplier',
      name: 'Multiplier',
      icon: <Calculator className="w-4 h-4" />,
      description: 'Multiplies numeric values',
      createGadget: () => createGadgetAtCenter('Multiplier', true)
    },
    {
      id: 'concatenator',
      name: 'Concatenator',
      icon: <Type className="w-4 h-4" />,
      description: 'Concatenates text values',
      createGadget: () => createGadgetAtCenter('Concatenator', true)
    },
    {
      id: 'switch',
      name: 'Switch',
      icon: <ToggleLeft className="w-4 h-4" />,
      description: 'Conditional routing',
      createGadget: () => createGadgetAtCenter('Switch', true)
    },
    {
      id: 'filter',
      name: 'Filter',
      icon: <ListFilter className="w-4 h-4" />,
      description: 'Filters values',
      createGadget: () => createGadgetAtCenter('Filter', true)
    },
    {
      id: 'randomizer',
      name: 'Randomizer',
      icon: <Shuffle className="w-4 h-4" />,
      description: 'Generates random values',
      createGadget: () => createGadgetAtCenter('Randomizer', true)
    },
    {
      id: 'container',
      name: 'Container',
      icon: <Package className="w-4 h-4" />,
      description: 'Generic container group',
      createGadget: () => createGadgetAtCenter('Container', false)
    },
    {
      id: 'grid',
      name: 'Grid',
      icon: <Grid className="w-4 h-4" />,
      description: 'Grid layout container',
      createGadget: () => createGadgetAtCenter('Grid', false)
    },
    {
      id: 'stack',
      name: 'Stack',
      icon: <Layers className="w-4 h-4" />,
      description: 'Stack layout container',
      createGadget: () => createGadgetAtCenter('Stack', false)
    }
  ]
  
  return (
    <div className="absolute bottom-4 left-4 z-20 bg-background/95 backdrop-blur border rounded-lg shadow-lg p-2">
      {/* Refactoring Tools */}
      {selectedContactIds.length > 0 && (
        <div className="mb-3 pb-3 border-b">
          <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Refactoring</div>
          <div className="flex gap-1">
            <button
              onClick={() => {
                const groupName = `Group ${Object.keys(state.groups).length}`
                extractContactsToNewGroup(selectedContactIds, groupName)
                playSound('gadget/create')
                toast.success(`Extracted ${selectedContactIds.length} contact${selectedContactIds.length > 1 ? 's' : ''} to ${groupName}`)
              }}
              className="flex flex-col items-center gap-1 p-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors group"
              title="Extract selected contacts to new group (G)"
            >
              <Group className="w-4 h-4" />
              <span className="text-xs">Extract</span>
            </button>
            <button
              onClick={() => {
                setMode('valence')
                setValenceSources(selectedContactIds)
                playSound('ui/tool-enable')
                toast.info('Valence mode: Click targets to connect')
              }}
              className="flex flex-col items-center gap-1 p-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors group"
              title="Connect selected contacts (V)"
            >
              <Link2 className="w-4 h-4" />
              <span className="text-xs">Connect</span>
            </button>
          </div>
        </div>
      )}
      
      <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">Gadgets</div>
      <div className="grid grid-cols-3 gap-1">
        {gadgets.map(gadget => (
          <button
            key={gadget.id}
            onClick={gadget.createGadget}
            className="flex flex-col items-center gap-1 p-2 rounded hover:bg-accent hover:text-accent-foreground transition-colors group"
            title={gadget.description}
          >
            {gadget.icon}
            <span className="text-xs">{gadget.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}