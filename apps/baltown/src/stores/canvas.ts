import { createSignal, createRoot, batch } from 'solid-js'

// Types
interface Position {
  x: number
  y: number
}

interface DataBlock {
  id: string
  position: Position
  content: any // JSON content
  width?: number
  height?: number
}

interface ResourceNode {
  id: string
  uri: string
  position: Position
}

interface CanvasTransform {
  scale: number
  panX: number
  panY: number
}

/**
 * Canvas store for the structure routing canvas.
 * Tracks data blocks, resource nodes, and canvas transform state.
 */
function createCanvasStore() {
  // Canvas transform (pan/zoom)
  const [transform, setTransform] = createSignal<CanvasTransform>({
    scale: 1,
    panX: 0,
    panY: 0,
  })

  // Data blocks on canvas
  const [blocks, setBlocks] = createSignal<DataBlock[]>([])

  // Resource nodes on canvas
  const [resources, setResources] = createSignal<ResourceNode[]>([])

  // Currently selected item
  const [selectedBlockId, setSelectedBlockId] = createSignal<string | null>(null)
  const [selectedResourceId, setSelectedResourceId] = createSignal<string | null>(null)

  // Currently dragging
  const [draggingBlockId, setDraggingBlockId] = createSignal<string | null>(null)
  const [dragOffset, setDragOffset] = createSignal<Position>({ x: 0, y: 0 })

  // ID generator
  let nextId = 1
  const generateId = (prefix: string) => `${prefix}-${nextId++}`

  // === Block operations ===

  function addBlock(content: any, position: Position): string {
    const id = generateId('block')
    setBlocks((prev) => [...prev, { id, position, content }])
    return id
  }

  function updateBlockContent(id: string, content: any) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, content } : b)))
  }

  function updateBlockPosition(id: string, position: Position) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, position } : b)))
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
    if (selectedBlockId() === id) {
      setSelectedBlockId(null)
    }
  }

  function getBlock(id: string): DataBlock | undefined {
    return blocks().find((b) => b.id === id)
  }

  // === Resource node operations ===

  function addResource(uri: string, position: Position): string {
    const id = generateId('resource')
    setResources((prev) => [...prev, { id, uri, position }])
    return id
  }

  function updateResourcePosition(id: string, position: Position) {
    setResources((prev) => prev.map((r) => (r.id === id ? { ...r, position } : r)))
  }

  function removeResource(id: string) {
    setResources((prev) => prev.filter((r) => r.id !== id))
    if (selectedResourceId() === id) {
      setSelectedResourceId(null)
    }
  }

  function getResource(id: string): ResourceNode | undefined {
    return resources().find((r) => r.id === id)
  }

  // === Transform operations ===

  function pan(deltaX: number, deltaY: number) {
    setTransform((prev) => ({
      ...prev,
      panX: prev.panX + deltaX,
      panY: prev.panY + deltaY,
    }))
  }

  function zoom(delta: number, centerX: number, centerY: number) {
    setTransform((prev) => {
      const newScale = Math.max(0.1, Math.min(3, prev.scale * (1 + delta)))
      // Zoom toward center point
      const scaleRatio = newScale / prev.scale
      return {
        scale: newScale,
        panX: centerX - (centerX - prev.panX) * scaleRatio,
        panY: centerY - (centerY - prev.panY) * scaleRatio,
      }
    })
  }

  function resetTransform() {
    setTransform({ scale: 1, panX: 0, panY: 0 })
  }

  // Convert screen coordinates to canvas coordinates
  function screenToCanvas(screenX: number, screenY: number): Position {
    const t = transform()
    return {
      x: (screenX - t.panX) / t.scale,
      y: (screenY - t.panY) / t.scale,
    }
  }

  // Convert canvas coordinates to screen coordinates
  function canvasToScreen(canvasX: number, canvasY: number): Position {
    const t = transform()
    return {
      x: canvasX * t.scale + t.panX,
      y: canvasY * t.scale + t.panY,
    }
  }

  // === Selection operations ===

  function selectBlock(id: string | null) {
    batch(() => {
      setSelectedBlockId(id)
      setSelectedResourceId(null)
    })
  }

  function selectResource(id: string | null) {
    batch(() => {
      setSelectedBlockId(null)
      setSelectedResourceId(id)
    })
  }

  function clearSelection() {
    batch(() => {
      setSelectedBlockId(null)
      setSelectedResourceId(null)
    })
  }

  // === Drag operations ===

  function startDraggingBlock(id: string, offsetX: number, offsetY: number) {
    setDraggingBlockId(id)
    setDragOffset({ x: offsetX, y: offsetY })
  }

  function stopDragging() {
    setDraggingBlockId(null)
    setDragOffset({ x: 0, y: 0 })
  }

  // === Initialize with defaults ===

  function initialize() {
    // Create SPAWN resource at center
    addResource('spawn', { x: 400, y: 300 })
    // Create one empty data block
    addBlock({}, { x: 100, y: 100 })
    // Create a test resource node
    addResource('bl:///cells/test', { x: 500, y: 100 })
  }

  // === Clear all ===

  function clear() {
    batch(() => {
      setBlocks([])
      setResources([])
      setSelectedBlockId(null)
      setSelectedResourceId(null)
      setDraggingBlockId(null)
      resetTransform()
    })
  }

  return {
    // Reactive getters
    transform,
    blocks,
    resources,
    selectedBlockId,
    selectedResourceId,
    draggingBlockId,
    dragOffset,

    // Computed
    getBlock,
    getResource,
    screenToCanvas,
    canvasToScreen,

    // Block actions
    addBlock,
    updateBlockContent,
    updateBlockPosition,
    removeBlock,

    // Resource actions
    addResource,
    updateResourcePosition,
    removeResource,

    // Transform actions
    pan,
    zoom,
    resetTransform,

    // Selection actions
    selectBlock,
    selectResource,
    clearSelection,

    // Drag actions
    startDraggingBlock,
    stopDragging,

    // Lifecycle
    initialize,
    clear,
  }
}

// Create a global singleton store
export const canvasStore = createRoot(createCanvasStore)
