/**
 * PrimitiveLoaderDriver - Manages loading and registration of primitive gadgets
 * 
 * Primitives are JavaScript modules that export functions returning PrimitiveGadget instances.
 * This driver handles loading modules, validating primitives, and maintaining a registry.
 */

import type { Driver, DriverResponse, DriverStats } from '../driver'
import type { PrimitiveGadget } from '../../types'
import type { ContactChange, DriverCommand, CommandResponse } from '../types'

export interface ModuleSource {
  type: 'builtin' | 'npm' | 'file' | 'url'
  module?: () => Promise<any>  // For builtin modules
  package?: string              // For npm packages
  path?: string                // For file paths
  url?: string                 // For URLs
  namespace: string            // Prefix for qualified names
}

export interface PrimitiveInfo {
  qualifiedName: string
  id: string
  name: string
  inputs: string[]
  outputs: string[]
  category?: string
  description?: string
  isPure?: boolean
}

export class PrimitiveLoaderDriver implements Driver {
  readonly id = 'primitive-loader'
  readonly name = 'PrimitiveLoader'
  readonly version = '1.0.0'
  
  // Registry maps qualified names to constructor functions
  private registry = new Map<string, () => PrimitiveGadget>()
  
  // Info cache for UI without instantiating
  private infoCache = new Map<string, PrimitiveInfo>()
  
  /**
   * Load a module and register all its primitive exports
   */
  async loadModule(source: ModuleSource): Promise<void> {
    let module: any
    
    // Load the module based on source type
    switch (source.type) {
      case 'builtin':
        if (!source.module) {
          throw new Error('Builtin source requires module function')
        }
        module = await source.module()
        break
        
      case 'npm':
        if (!source.package) {
          throw new Error('NPM source requires package name')
        }
        try {
          // Dynamic import of npm package
          module = await import(source.package)
        } catch (error) {
          throw new Error(`Failed to load NPM package ${source.package}: ${error}`)
        }
        break
        
      case 'file':
        if (!source.path) {
          throw new Error('File source requires path')
        }
        try {
          // Dynamic import with Vite/Webpack ignore comment
          module = await import(/* @vite-ignore */ source.path)
        } catch (error) {
          throw new Error(`Failed to load file ${source.path}: ${error}`)
        }
        break
        
      case 'url':
        if (!source.url) {
          throw new Error('URL source requires url')
        }
        try {
          module = await import(source.url)
        } catch (error) {
          throw new Error(`Failed to load URL ${source.url}: ${error}`)
        }
        break
        
      default:
        throw new Error(`Unknown source type: ${(source as any).type}`)
    }
    
    // Register all exported functions that return PrimitiveGadgets
    let registeredCount = 0
    
    for (const [exportName, value] of Object.entries(module)) {
      if (typeof value === 'function') {
        try {
          // Try to call the function to see if it returns a PrimitiveGadget
          const instance = value()
          
          if (this.isPrimitiveGadget(instance)) {
            // Create qualified name
            const qualifiedName = `${source.namespace}/${exportName}`
            
            // Register the constructor
            this.registry.set(qualifiedName, value as () => PrimitiveGadget)
            
            // Cache info for quick access
            this.infoCache.set(qualifiedName, {
              qualifiedName,
              id: instance.id,
              name: instance.name,
              inputs: instance.inputs,
              outputs: instance.outputs,
              category: instance.category,
              description: instance.description,
              isPure: instance.isPure
            })
            
            registeredCount++
            console.log(`[PrimitiveLoader] Registered: ${qualifiedName}`)
          }
        } catch (e) {
          // Not a primitive constructor or requires arguments, skip
          console.debug(`[PrimitiveLoader] Skipping ${exportName}: not a primitive constructor`)
        }
      }
    }
    
    console.log(`[PrimitiveLoader] Loaded ${registeredCount} primitives from ${source.namespace}`)
  }
  
  /**
   * Create an instance of a primitive gadget
   */
  createPrimitive(qualifiedName: string): PrimitiveGadget {
    const constructor = this.registry.get(qualifiedName)
    
    if (!constructor) {
      throw new Error(`Unknown primitive: ${qualifiedName}. Available: ${this.listPrimitives().join(', ')}`)
    }
    
    return constructor()
  }
  
  /**
   * List all available primitive qualified names
   */
  listPrimitives(): string[] {
    return Array.from(this.registry.keys()).sort()
  }
  
  /**
   * Get info about a primitive without instantiating it
   */
  getPrimitiveInfo(qualifiedName: string): PrimitiveInfo | undefined {
    return this.infoCache.get(qualifiedName)
  }
  
  /**
   * List all primitive info (for UI)
   */
  listPrimitiveInfo(): PrimitiveInfo[] {
    return Array.from(this.infoCache.values())
  }
  
  /**
   * Check if a module has been loaded
   */
  hasModule(namespace: string): boolean {
    return this.listPrimitives().some(name => name.startsWith(`${namespace}/`))
  }
  
  /**
   * Unload a module and its primitives
   */
  unloadModule(namespace: string): void {
    const toRemove: string[] = []
    
    for (const qualifiedName of this.registry.keys()) {
      if (qualifiedName.startsWith(`${namespace}/`)) {
        toRemove.push(qualifiedName)
      }
    }
    
    for (const name of toRemove) {
      this.registry.delete(name)
      this.infoCache.delete(name)
    }
    
    console.log(`[PrimitiveLoader] Unloaded ${toRemove.length} primitives from ${namespace}`)
  }
  
  /**
   * Validate that an object is a PrimitiveGadget
   */
  private isPrimitiveGadget(obj: any): obj is PrimitiveGadget {
    return obj &&
           typeof obj === 'object' &&
           typeof obj.id === 'string' &&
           typeof obj.name === 'string' &&
           Array.isArray(obj.inputs) &&
           Array.isArray(obj.outputs) &&
           typeof obj.activation === 'function' &&
           typeof obj.body === 'function'
  }
  
  // Driver interface implementation
  async handleChange(change: ContactChange): Promise<DriverResponse> {
    // Primitive loader doesn't handle changes
    return { status: 'success' }
  }
  
  async handleCommand(command: DriverCommand): Promise<CommandResponse> {
    // Handle initialization and shutdown commands
    switch (command.type) {
      case 'initialize':
        await this.initialize()
        return { status: 'success' }
      case 'shutdown':
        await this.shutdown()
        return { status: 'success' }
      default:
        return { status: 'success' }
    }
  }
  
  async isHealthy(): Promise<boolean> {
    return true
  }
  
  async getStats(): Promise<DriverStats> {
    return {
      processed: 0,
      failed: 0,
      pending: 0,
      uptime: Date.now(),
      custom: {
        primitiveCount: this.registry.size,
        namespaces: this.listNamespaces()
      }
    }
  }
  
  async initialize(): Promise<void> {
    console.log('[PrimitiveLoader] Initialized')
  }
  
  async shutdown(): Promise<void> {
    this.registry.clear()
    this.infoCache.clear()
    console.log('[PrimitiveLoader] Shut down')
  }
  
  private listNamespaces(): string[] {
    const namespaces = new Set<string>()
    for (const qualifiedName of this.registry.keys()) {
      const namespace = qualifiedName.split('/')[0]
      namespaces.add(namespace)
    }
    return Array.from(namespaces)
  }
}