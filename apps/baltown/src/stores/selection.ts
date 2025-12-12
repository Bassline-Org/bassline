import { createSignal, createRoot } from 'solid-js'

type SelectionType = 'cell' | 'propagator' | 'handler' | 'recipe' | 'none'

export interface SelectedResource {
  uri: string
  type: SelectionType
  name: string
  data?: any
}

/**
 * Global selection store for the workbench.
 * Tracks what resources are currently selected.
 */
function createSelectionStore() {
  const [selected, setSelected] = createSignal<SelectedResource[]>([])
  const [primarySelection, setPrimarySelection] = createSignal<SelectedResource | null>(null)

  // Get selection count
  const count = () => selected().length

  // Check if anything is selected
  const hasSelection = () => selected().length > 0

  // Check if multiple items are selected
  const isMultiSelect = () => selected().length > 1

  // Get the type of the current selection (if all same type)
  const selectionType = (): SelectionType => {
    const items = selected()
    if (items.length === 0) return 'none'
    if (items.length === 1) return items[0].type

    const types = new Set(items.map((i) => i.type))
    if (types.size === 1) return items[0].type
    return 'none' // Mixed selection
  }

  // Select a single resource (clears previous selection)
  function select(resource: SelectedResource) {
    setSelected([resource])
    setPrimarySelection(resource)
  }

  // Add to selection (for multi-select)
  function addToSelection(resource: SelectedResource) {
    const current = selected()
    if (!current.find((r) => r.uri === resource.uri)) {
      setSelected([...current, resource])
    }
    setPrimarySelection(resource)
  }

  // Toggle selection (for Cmd+click)
  function toggleSelection(resource: SelectedResource) {
    const current = selected()
    const existing = current.find((r) => r.uri === resource.uri)
    if (existing) {
      const newSelection = current.filter((r) => r.uri !== resource.uri)
      setSelected(newSelection)
      setPrimarySelection(newSelection[0] || null)
    } else {
      setSelected([...current, resource])
      setPrimarySelection(resource)
    }
  }

  // Clear all selection
  function clearSelection() {
    setSelected([])
    setPrimarySelection(null)
  }

  // Check if a specific resource is selected
  function isSelected(uri: string) {
    return selected().some((r) => r.uri === uri)
  }

  // Select multiple resources at once (for box select)
  function selectMultiple(resources: SelectedResource[]) {
    setSelected(resources)
    setPrimarySelection(resources[0] || null)
  }

  return {
    // Reactive getters
    selected,
    primarySelection,
    count,
    hasSelection,
    isMultiSelect,
    selectionType,

    // Actions
    select,
    addToSelection,
    toggleSelection,
    clearSelection,
    isSelected,
    selectMultiple,
  }
}

// Create a global singleton store
export const selectionStore = createRoot(createSelectionStore)
