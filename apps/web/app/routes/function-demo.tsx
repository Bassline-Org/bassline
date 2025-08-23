import { useState } from 'react'
import { 
  NetworkProvider, 
  useNetwork, 
  useGadget, 
  useCell,
  useFunctionOutput 
} from '../../../../proper-bassline/src/react-integration'
import { Network } from '../../../../proper-bassline/src/network'
import { OrdinalCell } from '../../../../proper-bassline/src/cells/basic'
import { ImportModule, DynamicFunction, ModuleFunction } from '../../../../proper-bassline/src/functions/import'
import { str, num, fn } from '../../../../proper-bassline/src/types'
import type { LatticeValue } from '../../../../proper-bassline/src/types'

function FunctionDemoContent() {
  const network = useNetwork()
  
  // Create persistent gadgets using useGadget
  const moduleCache = useGadget(() => {
    const cache = new OrdinalCell('module-cache')
    cache.userInput({ type: 'dict', value: new Map() })
    return cache
  }, 'module-cache')
  
  const [dynamicResult, setDynamicResult] = useState<LatticeValue | null>(null)
  const [moduleResult, setModuleResult] = useState<LatticeValue | null>(null)
  const [pipelineResult, setPipelineResult] = useState<LatticeValue | null>(null)
  const [hotReloadResult, setHotReloadResult] = useState<LatticeValue | null>(null)
  const [moduleStatus, setModuleStatus] = useState<'ready' | 'loading' | 'success' | 'error'>('ready')

  // Dynamic function demo
  const runDynamicFunction = (funcType: string, input: number) => {
    const functions: Record<string, Function> = {
      double: (x: LatticeValue) => x.type === 'number' ? x.value * 2 : 0,
      square: (x: LatticeValue) => x.type === 'number' ? x.value * x.value : 0,
      add10: (x: LatticeValue) => x.type === 'number' ? x.value + 10 : 0,
      negate: (x: LatticeValue) => x.type === 'number' ? -x.value : 0
    }

    const funcCell = new OrdinalCell('func')
    const inputCell = new OrdinalCell('input')
    const dynamic = new DynamicFunction('dynamic')

    // Set values first
    funcCell.userInput(fn(functions[funcType]))
    inputCell.userInput(num(input))

    // Then connect
    dynamic.connectFrom('function', funcCell)
    dynamic.connectFrom('input', inputCell)

    network.add(funcCell, inputCell, dynamic)

    // Then compute
    dynamic.compute()
    setDynamicResult(dynamic.getOutput())
  }

  // Module function demo
  const runModuleFunction = async (moduleUrl: string, funcName: string, input: string) => {
    setModuleStatus('loading')
    
    try {
      const urlCell = new OrdinalCell('url')
      const nameCell = new OrdinalCell('name')
      const inputCell = new OrdinalCell('input')
      const importer = new ImportModule('importer')
      const moduleFunc = new ModuleFunction('module-func')

      // Set values first
      urlCell.userInput(str(moduleUrl))
      nameCell.userInput(str(funcName))

      // Try to parse as number
      const numInput = parseFloat(input)
      if (!isNaN(numInput) && input.trim() === numInput.toString()) {
        inputCell.userInput(num(numInput))
      } else {
        inputCell.userInput(str(input))
      }

      // Connect importer to URL
      importer.connectFrom('url', urlCell)
      
      // Add to network and compute import
      network.add(urlCell, nameCell, inputCell, importer, moduleFunc)
      importer.compute()

      // Wait for async import to complete
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Now connect and compute the module function
      moduleFunc.connectFrom('module', importer)
      moduleFunc.connectFrom('functionName', nameCell)
      moduleFunc.connectFrom('input', inputCell)
      moduleFunc.compute()
      
      setModuleResult(moduleFunc.getOutput())
      setModuleStatus('success')
    } catch (error) {
      setModuleStatus('error')
      console.error('Module function error:', error)
    }
  }

  // Pipeline demo
  const runPipeline = (input: string) => {
    const inputCell = new OrdinalCell('pipeline-input')
    const upperFunc = new DynamicFunction('upper')
    const reverseFunc = new DynamicFunction('reverse')
    const bracketFunc = new DynamicFunction('bracket')

    // Create the function cells
    const upperCell = new OrdinalCell('upper-fn')
    const reverseCell = new OrdinalCell('reverse-fn')
    const bracketCell = new OrdinalCell('bracket-fn')

    // Set all values first
    inputCell.userInput(str(input))
    upperCell.userInput(fn((x: LatticeValue) => 
      x.type === 'string' ? x.value.toUpperCase() : ''))
    reverseCell.userInput(fn((x: LatticeValue) => 
      x.type === 'string' ? x.value.split('').reverse().join('') : ''))
    bracketCell.userInput(fn((x: LatticeValue) => 
      x.type === 'string' ? `[${x.value}]` : ''))

    // Wire the pipeline
    upperFunc.connectFrom('function', upperCell)
    upperFunc.connectFrom('input', inputCell)

    reverseFunc.connectFrom('function', reverseCell)
    reverseFunc.connectFrom('input', upperFunc)

    bracketFunc.connectFrom('function', bracketCell)
    bracketFunc.connectFrom('input', reverseFunc)

    network.add(inputCell, upperCell, reverseCell, bracketCell)
    network.add(upperFunc, reverseFunc, bracketFunc)

    // Compute the pipeline
    upperFunc.compute()
    reverseFunc.compute()
    bracketFunc.compute()

    setPipelineResult(bracketFunc.getOutput())
  }

  // Hot reload demo
  const updateAndRun = (funcCode: string, input: string) => {
    try {
      // Create the function from the text
      const func = eval(`(${funcCode})`)

      const funcCell = new OrdinalCell('custom')
      const inputCell = new OrdinalCell('input')
      const dynamic = new DynamicFunction('hot-reload')

      // Set values first
      funcCell.userInput(fn(func))
      
      // Try to parse as number
      const numInput = parseFloat(input)
      if (!isNaN(numInput) && input.trim() === numInput.toString()) {
        inputCell.userInput(num(numInput))
      } else {
        inputCell.userInput(str(input))
      }

      // Then connect
      dynamic.connectFrom('function', funcCell)
      dynamic.connectFrom('input', inputCell)

      network.add(funcCell, inputCell, dynamic)

      // Then compute
      dynamic.compute()
      setHotReloadResult(dynamic.getOutput())
    } catch (error) {
      console.error('Hot reload error:', error)
    }
  }

  const formatResult = (result: LatticeValue | null) => {
    if (!result) return 'No result'
    if (result.type === 'null') return 'null'
    if (result.type === 'string' || result.type === 'number' || result.type === 'bool') {
      return `${result.value}`
    }
    return JSON.stringify(result, null, 2)
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">
        🎵 Proper Bassline - Function Propagation Demo
      </h1>

      {/* Dynamic Function Demo */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">1. Dynamic Function Application</h2>
        <p className="text-gray-600 mb-4">Propagate a function through the network and apply it to inputs</p>
        
        <div className="flex gap-3 mb-4">
          <select 
            className="px-3 py-2 border rounded-md"
            id="func-select"
            defaultValue="double"
          >
            <option value="double">x * 2</option>
            <option value="square">x * x</option>
            <option value="add10">x + 10</option>
            <option value="negate">-x</option>
          </select>
          <input 
            type="number" 
            id="func-input" 
            defaultValue="5" 
            className="px-3 py-2 border rounded-md"
            placeholder="Input value"
          />
          <button 
            onClick={() => {
              const funcSelect = (document.getElementById('func-select') as HTMLSelectElement).value
              const input = parseFloat((document.getElementById('func-input') as HTMLInputElement).value)
              runDynamicFunction(funcSelect, input)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Apply Function
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-md font-mono">
          Result: {formatResult(dynamicResult)}
        </div>
      </div>

      {/* Module Import Demo */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">2. Module Import & Function Extraction</h2>
        <p className="text-gray-600 mb-4">Load external modules and use their functions</p>
        
        <div className="flex gap-3 mb-4">
          <select 
            className="px-3 py-2 border rounded-md"
            id="module-select"
            defaultValue="https://esm.sh/lodash-es@4.17.21"
          >
            <option value="https://esm.sh/lodash-es@4.17.21">Lodash (from CDN)</option>
            <option value="https://esm.sh/date-fns@2.30.0">date-fns (from CDN)</option>
          </select>
          <input 
            type="text" 
            id="func-name" 
            placeholder="Function name" 
            defaultValue="capitalize"
            className="px-3 py-2 border rounded-md"
          />
          <input 
            type="text" 
            id="module-input" 
            placeholder="Input" 
            defaultValue="hello world"
            className="px-3 py-2 border rounded-md"
          />
          <button 
            onClick={() => {
              const moduleUrl = (document.getElementById('module-select') as HTMLSelectElement).value
              const funcName = (document.getElementById('func-name') as HTMLInputElement).value
              const input = (document.getElementById('module-input') as HTMLInputElement).value
              runModuleFunction(moduleUrl, funcName, input)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Call Module Function
          </button>
        </div>

        <div className="mb-2">
          <span className={`inline-block px-3 py-1 rounded-md text-sm ${
            moduleStatus === 'loading' ? 'bg-yellow-100 text-yellow-800' :
            moduleStatus === 'success' ? 'bg-green-100 text-green-800' :
            moduleStatus === 'error' ? 'bg-red-100 text-red-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {moduleStatus === 'loading' ? 'Loading module...' :
             moduleStatus === 'success' ? 'Module loaded!' :
             moduleStatus === 'error' ? 'Error loading module' :
             'Ready'}
          </span>
        </div>

        <div className="bg-gray-50 p-4 rounded-md font-mono">
          Result: {formatResult(moduleResult)}
        </div>
      </div>

      {/* Pipeline Demo */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">3. Function Composition Pipeline</h2>
        <p className="text-gray-600 mb-4">Chain multiple functions together through propagation</p>
        
        <div className="flex gap-3 mb-4">
          <input 
            type="text" 
            id="pipeline-input" 
            placeholder="Input text" 
            defaultValue="hello"
            className="px-3 py-2 border rounded-md"
          />
          <button 
            onClick={() => {
              const input = (document.getElementById('pipeline-input') as HTMLInputElement).value
              runPipeline(input)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Run Pipeline
          </button>
        </div>

        <div className="bg-blue-50 p-4 rounded-md mb-4 text-center">
          <span className="inline-block px-3 py-1 bg-white rounded border border-blue-300 mx-1">Input</span>
          →
          <span className="inline-block px-3 py-1 bg-purple-100 rounded border border-purple-300 mx-1">Uppercase</span>
          →
          <span className="inline-block px-3 py-1 bg-purple-100 rounded border border-purple-300 mx-1">Reverse</span>
          →
          <span className="inline-block px-3 py-1 bg-purple-100 rounded border border-purple-300 mx-1">Add Brackets</span>
          →
          <span className="inline-block px-3 py-1 bg-white rounded border border-blue-300 mx-1">Output</span>
        </div>

        <div className="bg-gray-50 p-4 rounded-md font-mono">
          Result: {formatResult(pipelineResult)}
        </div>
      </div>

      {/* Hot Reload Demo */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">4. Hot Reload Demo</h2>
        <p className="text-gray-600 mb-4">Edit the function code and see it update live</p>
        
        <textarea 
          id="custom-func" 
          rows={8} 
          className="w-full px-3 py-2 border rounded-md font-mono text-sm mb-4"
          defaultValue={`function customTransform(input) {
  if (input?.type === 'number') {
    return input.value * 3 + 1;
  } else if (input?.type === 'string') {
    return \`✨ \${input.value.toUpperCase()} ✨\`;
  }
  return input;
}`}
        />
        
        <div className="flex gap-3 mb-4">
          <input 
            type="text" 
            id="hotreload-input" 
            placeholder="Input (string or number)" 
            defaultValue="42"
            className="px-3 py-2 border rounded-md"
          />
          <button 
            onClick={() => {
              const funcCode = (document.getElementById('custom-func') as HTMLTextAreaElement).value
              const input = (document.getElementById('hotreload-input') as HTMLInputElement).value
              updateAndRun(funcCode, input)
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Update & Run
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-md font-mono">
          Result: {formatResult(hotReloadResult)}
        </div>
      </div>
    </div>
  )
}

export default function FunctionDemo() {
  return (
    <NetworkProvider>
      <FunctionDemoContent />
    </NetworkProvider>
  )
}