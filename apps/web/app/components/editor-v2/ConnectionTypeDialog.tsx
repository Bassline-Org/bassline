import { useState, useEffect, useRef } from 'react'
import { useFetcher } from 'react-router'

interface ConnectionTypeDialogProps {
  connection: {
    source: string
    sourceHandle?: string | null
    target: string
    targetHandle?: string | null
  } | null
  onClose: () => void
}

export function ConnectionTypeDialog({ connection, onClose }: ConnectionTypeDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const fetcher = useFetcher()
  const [selectedType, setSelectedType] = useState<'bidirectional' | 'directed'>('bidirectional')
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])
  
  if (!connection) return null
  
  const handleCreate = () => {
    const sourceId = connection.sourceHandle || connection.source
    const targetId = connection.targetHandle || connection.target
    
    console.log('[ConnectionTypeDialog] Creating connection:', {
      raw: connection,
      sourceId,
      targetId,
      hasSourceHandle: !!connection.sourceHandle,
      hasTargetHandle: !!connection.targetHandle
    })
    
    fetcher.submit({
      intent: 'create-wire',
      fromId: sourceId,
      toId: targetId,
      type: selectedType
    }, {
      method: 'post',
      action: '/api/editor/actions',
      navigate: false
    })
    
    onClose()
  }
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={dialogRef}
        className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full"
      >
        <h3 className="text-lg font-semibold mb-4">Choose Connection Type</h3>
        
        <div className="space-y-3">
          <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="connectionType"
              value="bidirectional"
              checked={selectedType === 'bidirectional'}
              onChange={(e) => setSelectedType(e.target.value as 'bidirectional')}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Bidirectional</div>
              <div className="text-sm text-gray-500">Information flows both ways</div>
              <div className="text-xs text-gray-400 mt-1">↔️ Constraint propagation</div>
            </div>
          </label>
          
          <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="radio"
              name="connectionType"
              value="directed"
              checked={selectedType === 'directed'}
              onChange={(e) => setSelectedType(e.target.value as 'directed')}
              className="mr-3"
            />
            <div>
              <div className="font-medium">Directed</div>
              <div className="text-sm text-gray-500">Information flows one way</div>
              <div className="text-xs text-gray-400 mt-1">→ Data flow</div>
            </div>
          </label>
        </div>
        
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleCreate}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Create Wire
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}