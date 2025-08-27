import { ClassicPreset } from 'rete'
import { DeadNode, propagatorSocket } from '../types'

export class DeadPropagator extends DeadNode {
  functionType: string
  
  constructor(id: string, functionType: string = 'identity') {
    super(id, 'propagator')
    this.functionType = functionType
    
    // Add inputs and outputs based on function type
    this.setupPorts(functionType)
    
    // Add control for function selection
    this.addControl('function', new ClassicPreset.InputControl('text', {
      initial: this.functionType,
      change: (value) => {
        this.functionType = String(value)
        this.updatePorts()
      }
    }))
  }
  
  setupPorts(functionType: string) {
    // Clear existing ports
    this.inputs.clear()
    this.outputs.clear()
    
    // Add ports based on function type
    switch(functionType) {
      case 'add':
      case 'multiply':
      case 'subtract':
      case 'divide':
        this.addInput('a', new ClassicPreset.Input(propagatorSocket, 'A'))
        this.addInput('b', new ClassicPreset.Input(propagatorSocket, 'B'))
        this.addOutput('output', new ClassicPreset.Output(propagatorSocket, 'Output'))
        break
      case 'clamp':
        this.addInput('value', new ClassicPreset.Input(propagatorSocket, 'Value'))
        this.addInput('min', new ClassicPreset.Input(propagatorSocket, 'Min'))
        this.addInput('max', new ClassicPreset.Input(propagatorSocket, 'Max'))
        this.addOutput('output', new ClassicPreset.Output(propagatorSocket, 'Output'))
        break
      case 'compare':
        this.addInput('a', new ClassicPreset.Input(propagatorSocket, 'A'))
        this.addInput('b', new ClassicPreset.Input(propagatorSocket, 'B'))
        this.addOutput('greater', new ClassicPreset.Output(propagatorSocket, 'Greater'))
        this.addOutput('equal', new ClassicPreset.Output(propagatorSocket, 'Equal'))
        this.addOutput('less', new ClassicPreset.Output(propagatorSocket, 'Less'))
        break
      default: // identity or custom
        this.addInput('input', new ClassicPreset.Input(propagatorSocket, 'Input'))
        this.addOutput('output', new ClassicPreset.Output(propagatorSocket, 'Output'))
    }
  }
  
  updatePorts() {
    this.setupPorts(this.functionType)
  }
  
  data() {
    return {
      functionType: this.functionType
    }
  }
}

// React component for rendering
export function DeadPropagatorComponent({ data }: { data: any }) {
  const nodeId = data.id
  const prefix = nodeId.split('.')[0]
  const name = nodeId.split('.').slice(1).join('.')
  
  return (
    <div className="bg-green-50 border-2 border-green-300 rounded-lg p-3 min-w-[180px]">
      <div className="text-xs text-green-600 font-semibold">{prefix}</div>
      <div className="font-medium text-green-900">{name || 'propagator'}</div>
      <div className="mt-2">
        <label className="text-xs text-gray-600">Function:</label>
        <select 
          className="ml-1 text-xs border rounded px-1 py-0.5"
          defaultValue={data.functionType || 'identity'}
          onChange={(e) => data.functionType = e.target.value}
        >
          <option value="identity">Identity</option>
          <option value="add">Add</option>
          <option value="multiply">Multiply</option>
          <option value="subtract">Subtract</option>
          <option value="divide">Divide</option>
          <option value="clamp">Clamp</option>
          <option value="compare">Compare</option>
          <option value="custom">Custom</option>
        </select>
      </div>
    </div>
  )
}