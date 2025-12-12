import { createSignal, For, onMount } from 'solid-js'
import { useBassline } from '@bassline/solid'
import { useToast } from '../context/ToastContext'
import { canvasStore } from '../stores/canvas'
import DataBlock from '../components/canvas/DataBlock'
import ResourceNode from '../components/canvas/ResourceNode'

/**
 * Canvas - The structure routing canvas
 *
 * A spatial workspace where:
 * - DataBlocks contain editable JSON (structure editor)
 * - ResourceNodes represent Bassline resources (URIs)
 * - Drag DataBlock → ResourceNode = PUT operation
 * - Click ResourceNode = GET operation (creates new DataBlock with result)
 */
export default function Canvas() {
  const bl = useBassline()
  const toast = useToast()

  let canvasRef: HTMLDivElement | undefined

  const [draggingBlock, setDraggingBlock] = createSignal<string | null>(null)
  const [dragOffset, setDragOffset] = createSignal({ x: 0, y: 0 })

  // Initialize canvas on mount
  onMount(() => {
    canvasStore.clear()
    canvasStore.initialize()
  })

  // Handle block drag start
  function handleBlockDragStart(id: string, e: MouseEvent) {
    const block = canvasStore.getBlock(id)
    if (!block) return

    setDraggingBlock(id)
    setDragOffset({
      x: e.clientX - block.position.x,
      y: e.clientY - block.position.y,
    })

    canvasStore.selectBlock(id)
  }

  // Handle block drag end
  function handleBlockDragEnd(id: string) {
    setDraggingBlock(null)
  }

  // Handle mouse move for dragging
  function handleMouseMove(e: MouseEvent) {
    const blockId = draggingBlock()
    if (!blockId) return

    const offset = dragOffset()
    canvasStore.updateBlockPosition(blockId, {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    })
  }

  // Handle mouse up (end drag)
  function handleMouseUp() {
    setDraggingBlock(null)
  }

  // Handle block content change
  function handleContentChange(id: string, content: any) {
    canvasStore.updateBlockContent(id, content)
  }

  // Handle resource click (GET)
  async function handleResourceClick(id: string) {
    const resource = canvasStore.getResource(id)
    if (!resource) return

    if (resource.uri === 'spawn') {
      // SPAWN creates a new resource node
      // For MVP, just add a new cell resource
      const name = `cell-${Date.now()}`
      canvasStore.addResource(`bl:///r/cells/${name}`, {
        x: resource.position.x + 100,
        y: resource.position.y,
      })
      toast.info('Created new resource node')
      return
    }

    // GET the resource
    try {
      const response = await bl.get(resource.uri)
      // Create a new data block with the result
      const newBlockId = canvasStore.addBlock(response.body || {}, {
        x: resource.position.x - 150,
        y: resource.position.y + 80,
      })
      canvasStore.selectBlock(newBlockId)
      toast.success(`GET ${resource.uri}`)
    } catch (err) {
      toast.error(`Failed to GET: ${err}`)
    }
  }

  // Handle drop on resource (PUT)
  async function handleResourceDrop(resourceId: string, data: any) {
    const resource = canvasStore.getResource(resourceId)
    if (!resource) return

    if (resource.uri === 'spawn') {
      // SPAWN with data - create resource at that URI
      // For now, just show a message
      toast.info('Drag a URI to SPAWN to create a resource node')
      return
    }

    // PUT the data to the resource
    try {
      await bl.put(resource.uri, {}, data)
      toast.success(`PUT to ${resource.uri}`)
    } catch (err) {
      toast.error(`Failed to PUT: ${err}`)
    }
  }

  // Add new data block
  function handleAddBlock() {
    const id = canvasStore.addBlock({}, { x: 100, y: 100 })
    canvasStore.selectBlock(id)
  }

  // Add new resource
  function handleAddResource() {
    const id = canvasStore.addResource('bl:///r/cells/new', { x: 400, y: 200 })
    canvasStore.selectResource(id)
  }

  return (
    <div class="canvas-page">
      <div class="canvas-toolbar">
        <button onClick={handleAddBlock}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Add Data Block
        </button>
        <button onClick={handleAddResource}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          Add Resource
        </button>
        <div class="canvas-toolbar__spacer" />
        <span class="canvas-toolbar__hint">
          Type <kbd>/</kbd> for commands | Drag block → resource to PUT | Click resource to GET
        </span>
      </div>

      <div
        ref={canvasRef}
        class="canvas-viewport"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Data Blocks */}
        <For each={canvasStore.blocks()}>
          {(block) => (
            <DataBlock
              id={block.id}
              content={block.content}
              position={block.position}
              selected={canvasStore.selectedBlockId() === block.id}
              dragging={draggingBlock() === block.id}
              onContentChange={handleContentChange}
              onDragStart={handleBlockDragStart}
              onDragEnd={handleBlockDragEnd}
            />
          )}
        </For>

        {/* Resource Nodes */}
        <For each={canvasStore.resources()}>
          {(resource) => (
            <ResourceNode
              id={resource.id}
              uri={resource.uri}
              position={resource.position}
              selected={canvasStore.selectedResourceId() === resource.id}
              onClick={handleResourceClick}
              onDrop={handleResourceDrop}
            />
          )}
        </For>
      </div>

      <style>{`
        .canvas-page {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: #0d1117;
        }

        .canvas-toolbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #161b22;
          border-bottom: 1px solid #30363d;
        }

        .canvas-toolbar button {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #c9d1d9;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .canvas-toolbar button:hover {
          background: #30363d;
          border-color: #58a6ff;
        }

        .canvas-toolbar__spacer {
          flex: 1;
        }

        .canvas-toolbar__hint {
          font-size: 12px;
          color: #6e7681;
        }

        .canvas-toolbar__hint kbd {
          padding: 2px 6px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 4px;
          font-family: inherit;
          font-size: 11px;
        }

        .canvas-viewport {
          flex: 1;
          position: relative;
          overflow: hidden;
          background:
            linear-gradient(rgba(48, 54, 61, 0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(48, 54, 61, 0.3) 1px, transparent 1px);
          background-size: 20px 20px;
        }
      `}</style>
    </div>
  )
}
