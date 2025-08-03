import type { Tool } from '~/propagation-react/types/context-frame'
import { ValenceTool } from './ValenceTool'

// Registry of available tools
export class ToolRegistry {
  private static tools = new Map<string, Tool>()
  
  static {
    // Register built-in tools
    this.register(new ValenceTool())
  }
  
  static register(tool: Tool): void {
    this.tools.set(tool.id, tool)
  }
  
  static get(toolId: string): Tool | undefined {
    return this.tools.get(toolId)
  }
  
  static getAll(): Tool[] {
    return Array.from(this.tools.values())
  }
}