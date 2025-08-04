import type { Tool } from '~/propagation-react/types/context-frame'
import { ValenceTool } from './ValenceTool'
import { SelectAllTool, DeselectAllTool, InvertSelectionTool, SelectConnectedTool } from './SelectionTool'

// Registry of available tools
export class ToolRegistry {
  private static tools = new Map<string, Tool>()
  
  static {
    // Register built-in tools
    this.register(new ValenceTool())
    this.register(new SelectAllTool())
    this.register(new DeselectAllTool())
    this.register(new InvertSelectionTool())
    this.register(new SelectConnectedTool())
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