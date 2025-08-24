/**
 * ImportModule - Dynamically import ES modules into the propagation network
 * 
 * Takes a module URL/path and loads it using dynamic import().
 * The loaded module becomes an object value that can propagate through the network.
 */

import { FunctionGadget } from '../function'
import { LatticeValue, nil, obj, str, num, bool, isString } from '../types'

export class ImportModule extends FunctionGadget {
  private loadingCache: Map<string, Promise<any>> = new Map()
  private moduleCache: Map<string, any> = new Map()
  
  constructor(id: string) {
    super(id, ['url'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    // Handle async operation synchronously by returning promise result
    const promise = this.handleModuleLoad(args)
    
    // For now, return a pending value and handle async separately
    promise.then(result => {
      this.setOutput('default', result)
      this.emit()
    })
    
    return str('loading...')
  }
  
  private async handleModuleLoad(args: Record<string, LatticeValue>): Promise<LatticeValue> {
    const urlValue = args.url
    
    // Handle ordinal values from OrdinalCell
    let actualUrl = urlValue
    if (urlValue?.type === 'dict') {
      const inner = urlValue.value.get('value')
      if (inner) actualUrl = inner
    }
    
    if (!actualUrl || !isString(actualUrl)) {
      console.log('ImportModule: Invalid URL value:', urlValue)
      return nil()
    }
    
    const url = actualUrl.value
    
    // Check cache first
    if (this.moduleCache.has(url)) {
      return obj(this.moduleCache.get(url))
    }
    
    // Check if already loading
    if (this.loadingCache.has(url)) {
      try {
        const module = await this.loadingCache.get(url)
        return obj(module)
      } catch (error) {
        console.error(`Failed to import ${url}:`, error)
        return nil()
      }
    }
    
    // Start loading
    const loadPromise = this.loadModuleFromUrl(url)
    this.loadingCache.set(url, loadPromise)
    
    try {
      const module = await loadPromise
      this.moduleCache.set(url, module)
      return obj(module)
    } catch (error) {
      console.error(`Failed to import ${url}:`, error)
      return nil()
    }
  }
  
  private async loadModuleFromUrl(url: string): Promise<any> {
    console.log(`ImportModule: Loading ${url}...`)
    
    // Handle different URL types
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Load from CDN (like esm.sh, unpkg, etc.)
      return await import(/* @vite-ignore */ url)
    } else if (url.startsWith('./') || url.startsWith('../')) {
      // Relative import
      return await import(/* @vite-ignore */ url)
    } else if (url.startsWith('@') || /^[a-z]/i.test(url)) {
      // npm package - try common CDNs
      const cdnUrl = `https://esm.sh/${url}`
      console.log(`ImportModule: Trying CDN URL: ${cdnUrl}`)
      const module = await import(/* @vite-ignore */ cdnUrl)
      console.log(`ImportModule: Successfully loaded module:`, module)
      return module
    } else {
      throw new Error(`Unknown module URL format: ${url}`)
    }
  }
  
  // Override accept to handle async function
  accept(value: LatticeValue, source: any, inputName?: string): void {
    if (!inputName) return
    
    // Store the value
    this.currentValues.set(inputName, value)
    
    // Check if we have all inputs
    if (this.inputNames.every(name => this.currentValues.has(name))) {
      this.executeAsync()
    }
  }
  
  // Override compute to handle async
  compute(): void {
    // Collect values from inputs
    for (const [name, conn] of this.inputs) {
      const source = conn.source.deref()
      if (source) {
        this.currentValues.set(name, source.getOutput(conn.outputName))
      }
    }
    
    // Execute if we have all values
    if (this.inputNames.every(name => this.currentValues.has(name))) {
      this.executeAsync()
    }
  }
  
  private executeAsync(): void {
    // Build args
    const args: Record<string, LatticeValue> = {}
    for (const name of this.inputNames) {
      args[name] = this.currentValues.get(name) ?? nil()
    }
    
    // Execute async function
    ;(this.fn(args) as Promise<LatticeValue>).then(result => {
      this.setOutput('default', result)
    }).catch(error => {
      console.error('ImportModule error:', error)
      this.setOutput('default', nil())
    })
  }
}

/**
 * DynamicFunction - Executes a propagated function
 * 
 * Accepts a function and an input value, applies the function to the input.
 * The function can be loaded from ImportModule or created elsewhere.
 */
export class DynamicFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['function', 'input'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const funcValue = args.function
    const inputValue = args.input
    
    if (!funcValue) return nil()
    
    // Extract the actual function
    let func: Function | null = null
    
    if (funcValue.type === 'function') {
      func = funcValue.value
    } else if (funcValue.type === 'object') {
      // Could be a module with a default export or specific function
      const obj = funcValue.value
      if (typeof obj === 'function') {
        func = obj
      } else if (obj.default && typeof obj.default === 'function') {
        func = obj.default
      } else if (obj.fn && typeof obj.fn === 'function') {
        func = obj.fn
      }
    } else if (funcValue.type === 'dict') {
      // Handle ordinal values from OrdinalCell
      const innerValue = funcValue.value.get('value')
      if (innerValue?.type === 'function') {
        func = innerValue.value
      }
    }
    
    if (!func) {
      console.warn('DynamicFunction: No valid function found in', funcValue)
      return nil()
    }
    
    // Extract input value if it's ordinal
    let actualInput = inputValue
    if (inputValue?.type === 'dict') {
      const inner = inputValue.value.get('value')
      if (inner) actualInput = inner
    }
    
    // Apply the function
    try {
      const result = func(actualInput)
      
      // Wrap result in appropriate lattice type
      if (result === null || result === undefined) {
        return nil()
      } else if (typeof result === 'number') {
        return num(result)
      } else if (typeof result === 'string') {
        return str(result)
      } else if (typeof result === 'boolean') {
        return bool(result)
      } else {
        return obj(result)
      }
    } catch (error) {
      console.error('DynamicFunction execution error:', error)
      return nil()
    }
  }
}

/**
 * ModuleFunction - Calls a specific function from a module
 * 
 * Takes a module and a function name, calls that function with the input.
 */
export class ModuleFunction extends FunctionGadget {
  constructor(id: string) {
    super(id, ['module', 'functionName', 'input'])
  }
  
  fn(args: Record<string, LatticeValue>): LatticeValue {
    const moduleValue = args.module
    const nameValue = args.functionName
    const inputValue = args.input
    
    if (!moduleValue || !nameValue) return nil()
    
    // Handle ordinal values
    let actualModule = moduleValue
    if (moduleValue.type === 'dict') {
      const inner = moduleValue.value.get('value')
      if (inner) actualModule = inner
    }
    
    let actualName = nameValue
    if (nameValue.type === 'dict') {
      const inner = nameValue.value.get('value')
      if (inner) actualName = inner
    }
    
    let actualInput = inputValue
    if (inputValue?.type === 'dict') {
      const inner = inputValue.value.get('value')
      if (inner) actualInput = inner
    }
    
    // Get the module object
    if (actualModule.type !== 'object') {
      console.log('ModuleFunction: Invalid module type:', actualModule.type)
      return nil()
    }
    const module = actualModule.value
    
    // Get the function name
    if (!isString(actualName)) {
      console.log('ModuleFunction: Invalid function name type:', actualName)
      return nil()
    }
    const functionName = actualName.value
    
    // Get the function
    const func = module[functionName]
    if (typeof func !== 'function') {
      console.warn(`ModuleFunction: ${functionName} is not a function`)
      return nil()
    }
    
    // Extract the actual JavaScript value from the lattice value
    let jsInput: any = undefined
    if (actualInput) {
      if (actualInput.type === 'string' || actualInput.type === 'number' || actualInput.type === 'bool') {
        jsInput = actualInput.value
      } else if (actualInput.type === 'object') {
        jsInput = actualInput.value
      } else if (actualInput.type === 'null') {
        jsInput = null
      }
    }
    
    // Apply the function
    try {
      const result = func(jsInput)
      
      // Wrap result
      if (result === null || result === undefined) {
        return nil()
      } else if (typeof result === 'number') {
        return num(result)
      } else if (typeof result === 'string') {
        return str(result)
      } else if (typeof result === 'boolean') {
        return bool(result)
      } else {
        return obj(result)
      }
    } catch (error) {
      console.error(`ModuleFunction execution error for ${functionName}:`, error)
      return nil()
    }
  }
}