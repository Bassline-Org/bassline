/**
 * MCP Integration Types
 *
 * Types for interactive choreography shell and network access
 */

// Compilation network was removed - stub for now
type CompilationNetwork = any;

export interface MCPShellConfig {
  networks: Map<string, CompilationNetwork>;
  workingDirectory: string;
  enableWatching?: boolean;
  maxHistorySize?: number;
}

export interface NetworkHandle {
  id: string;
  network: CompilationNetwork;
  path: string;
  status: 'active' | 'inactive' | 'compiling';
  lastActivity: number;
}

export interface ShellCommand {
  command: string;
  args: string[];
  flags: Record<string, string | boolean>;
  context: {
    workingDirectory: string;
    networkId?: string;
  };
}

export interface ShellResult {
  success: boolean;
  output: string;
  error?: string;
  data?: any;
  sideEffects?: Array<{
    type: 'compilation' | 'file_created' | 'network_created';
    details: any;
  }>;
}

export interface MCPTool {
  name: string;
  description: string;
  parameters: any;
  handler: (params: any, shell: ChoreographyShell) => Promise<ShellResult>;
}

export interface MCPRequest {
  tool: string;
  params: any;
  sessionId?: string;
}

export interface MCPResponse {
  success: boolean;
  result: ShellResult;
  sessionId?: string;
}

// Import ChoreographyShell type to avoid circular dependency
export interface ChoreographyShell {
  execute(command: string, args?: string[], flags?: Record<string, any>): Promise<ShellResult>;
  getNetwork(id: string): NetworkHandle | null;
  listNetworks(): NetworkHandle[];
  pwd(): string;
  cd(path: string): boolean;
}