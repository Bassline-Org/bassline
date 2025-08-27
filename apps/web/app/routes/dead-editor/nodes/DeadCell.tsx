import { ClassicPreset } from 'rete'
import { DeadNode, cellSocket } from '../types'

export class DeadCell extends DeadNode {
  mergeFunction: string = 'last'
  initialValue?: any
  
  constructor(id: string) {
    super(id, 'cell')
    
    // Add input and output sockets
    this.addInput('input', new ClassicPreset.Input(cellSocket, 'Input', true))
    this.addOutput('output', new ClassicPreset.Output(cellSocket, 'Output', true))
    
    // Add control for merge function selection
    this.addControl('merge', new ClassicPreset.InputControl('text', {
      initial: this.mergeFunction,
      change: (value) => {
        this.mergeFunction = String(value)
      }
    }))
  }
  
  data() {
    return {
      mergeFunction: this.mergeFunction,
      initialValue: this.initialValue
    }
  }
}

// React component for rendering
export function DeadCellComponent({ data }: { data: any }) {
  const nodeId = data.id
  const prefix = nodeId.split('.')[0]
  const name = nodeId.split('.').slice(1).join('.')
  
  return (
    <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-3 min-w-[180px]">
      <div className="text-xs text-blue-600 font-semibold">{prefix}</div>
      <div className="font-medium text-blue-900">{name || 'cell'}</div>
      <div className="mt-2">
        <label className="text-xs text-gray-600">Merge:</label>
        <select 
          className="ml-1 text-xs border rounded px-1 py-0.5"
          defaultValue={data.mergeFunction || 'last'}
          onChange={(e) => data.mergeFunction = e.target.value}
        >
          <option value="last">Last</option>
          <option value="max">Max</option>
          <option value="min">Min</option>
          <option value="sum">Sum</option>
          <option value="union">Union</option>
        </select>
      </div>
    </div>
  )
}