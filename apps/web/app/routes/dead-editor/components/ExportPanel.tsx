import { useState, useRef } from 'react'
import type { DeadNode, DeadConnection, DeadNetworkExport } from '../types'
import { exportToIR, importFromIR } from '../lib/export'

interface ExportPanelProps {
  nodes: DeadNode[]
  connections: DeadConnection[]
  className?: string
  onImport?: (nodes: DeadNode[], connections: DeadConnection[]) => void
}

export function ExportPanel({ nodes, connections, className = '', onImport }: ExportPanelProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [exportFormat, setExportFormat] = useState<'flat' | 'grouped'>('flat')
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const handleExport = () => {
    const ir = exportToIR(nodes, connections, exportFormat)
    const blob = new Blob([JSON.stringify(ir, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `network-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const handleCopy = () => {
    const ir = exportToIR(nodes, connections, exportFormat)
    navigator.clipboard.writeText(JSON.stringify(ir, null, 2))
  }
  
  const getPreview = () => {
    if (nodes.length === 0) return 'No nodes to export'
    const ir = exportToIR(nodes, connections, exportFormat)
    return JSON.stringify(ir, null, 2)
  }
  
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const ir = JSON.parse(e.target?.result as string) as DeadNetworkExport
        const imported = importFromIR(ir)
        onImport?.(imported.nodes, imported.connections)
      } catch (err) {
        console.error('Failed to import:', err)
        alert('Failed to import file. Please check the format.')
      }
    }
    reader.readAsText(file)
  }
  
  return (
    <div className={`bg-white rounded-lg shadow-lg p-4 ${className}`}>
      <h3 className="text-sm font-semibold mb-3">Export Network</h3>
      
      <div className="mb-3">
        <label className="text-xs font-medium text-gray-600">Format:</label>
        <select 
          className="ml-2 text-xs border rounded px-2 py-1"
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as 'flat' | 'grouped')}
        >
          <option value="flat">Flat (Production)</option>
          <option value="grouped">With Groups (Debug)</option>
        </select>
      </div>
      
      <div className="space-y-2">
        <button
          onClick={handleExport}
          className="w-full px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white 
                     rounded text-sm font-medium transition-colors"
        >
          📥 Download JSON
        </button>
        
        <button
          onClick={handleCopy}
          className="w-full px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white 
                     rounded text-sm font-medium transition-colors"
        >
          📋 Copy to Clipboard
        </button>
        
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white 
                     rounded text-sm font-medium transition-colors"
        >
          📤 Import JSON
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="w-full px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 
                     rounded text-sm font-medium transition-colors"
        >
          {showPreview ? '🙈 Hide' : '👁️ Show'} Preview
        </button>
      </div>
      
      {showPreview && (
        <div className="mt-3 p-2 bg-gray-50 rounded border">
          <pre className="text-xs overflow-auto max-h-64">
            {getPreview()}
          </pre>
        </div>
      )}
      
      <div className="mt-3 pt-3 border-t text-xs text-gray-500">
        Nodes: {nodes.length} | Connections: {connections.length}
      </div>
    </div>
  )
}