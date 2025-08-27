interface NodePaletteProps {
  onAddNode: (type: 'cell' | 'propagator', functionType?: string) => void
  className?: string
}

const cellTypes = [
  { name: 'Cell', merge: 'last', color: 'blue' },
  { name: 'Max Cell', merge: 'max', color: 'purple' },
  { name: 'Min Cell', merge: 'min', color: 'indigo' },
  { name: 'Sum Cell', merge: 'sum', color: 'cyan' },
  { name: 'Union Cell', merge: 'union', color: 'teal' }
]

const propagatorTypes = [
  { name: 'Add', fn: 'add', color: 'green' },
  { name: 'Multiply', fn: 'multiply', color: 'emerald' },
  { name: 'Subtract', fn: 'subtract', color: 'lime' },
  { name: 'Divide', fn: 'divide', color: 'yellow' },
  { name: 'Clamp', fn: 'clamp', color: 'orange' },
  { name: 'Compare', fn: 'compare', color: 'red' },
  { name: 'Identity', fn: 'identity', color: 'pink' }
]

export function NodePalette({ onAddNode, className = '' }: NodePaletteProps) {
  return (
    <div className={`bg-white rounded-lg shadow-lg p-4 max-w-xs ${className}`}>
      <h3 className="text-sm font-semibold mb-3">Add Nodes</h3>
      
      <div className="mb-4">
        <h4 className="text-xs font-medium text-gray-600 mb-2">Cells</h4>
        <div className="grid grid-cols-2 gap-1">
          {cellTypes.map(cell => (
            <button
              key={cell.merge}
              onClick={() => onAddNode('cell')}
              className={`px-2 py-1 bg-${cell.color}-100 hover:bg-${cell.color}-200 
                         text-${cell.color}-800 rounded text-xs font-medium transition-colors`}
            >
              {cell.name}
            </button>
          ))}
        </div>
      </div>
      
      <div>
        <h4 className="text-xs font-medium text-gray-600 mb-2">Propagators</h4>
        <div className="grid grid-cols-2 gap-1">
          {propagatorTypes.map(prop => (
            <button
              key={prop.fn}
              onClick={() => onAddNode('propagator', prop.fn)}
              className={`px-2 py-1 bg-${prop.color}-100 hover:bg-${prop.color}-200 
                         text-${prop.color}-800 rounded text-xs font-medium transition-colors`}
            >
              {prop.name}
            </button>
          ))}
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t">
        <p className="text-xs text-gray-500">
          Tip: Nodes are prefixed with current prefix for automatic grouping
        </p>
      </div>
    </div>
  )
}