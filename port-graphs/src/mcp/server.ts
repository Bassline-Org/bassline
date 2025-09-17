/**
 * MCP Server for Choreography Shell
 *
 * Provides Claude Code with universal tools for interacting with
 * compilation networks through filesystem-like operations
 *
 * Now wraps the MCP gadget for proper gadget protocol adherence
 */

import { ChoreographyShell } from './shell';
import { createMCPGadget } from './gadget';
import { MCPTool, ShellResult, MCPRequest, MCPResponse } from './types';

export interface MCPServerConfig {
  shell: ChoreographyShell;
  toolPrefix?: string;
}

/**
 * Create MCP tools for interacting with choreography networks
 */
export function createMCPTools(config: MCPServerConfig): MCPTool[] {
  const { shell, toolPrefix = 'choreo' } = config;

  return [
    {
      name: `${toolPrefix}_exec`,
      description: `Execute shell commands on choreography networks. Universal interface for all network operations.

Navigation commands:
  ls [path] [--long]     - List networks/gadgets/files (like filesystem ls)
  cd <path>              - Change directory (supports ~, network names, gadget paths)
  pwd                    - Show current directory

Network commands:
  create-network <id>    - Create new compilation network
  compile <source>       - Compile choreography to deployable artifacts
  status [network]       - Show network/gadget status

Query commands:
  cat <file>            - Read files (state.json, config, interfaces)
  query <path>          - Query network state using path syntax
  effects [--limit N]   - Show recent compilation effects stream

Examples:
  ls                           # List all networks
  create-network ecommerce     # Create network
  cd ecommerce                 # Enter network
  compile choreography.yaml    # Compile to artifacts
  ls parser                    # List parser gadget files
  cat parser/state.json        # Read parser state
  query /metrics               # Get compilation metrics`,

      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Shell command to execute'
          },
          args: {
            type: 'array',
            items: { type: 'string' },
            description: 'Command arguments',
            default: []
          },
          flags: {
            type: 'object',
            description: 'Command flags (e.g., {long: true, limit: 10})',
            default: {}
          }
        },
        required: ['command']
      },

      handler: async (params: {
        command: string;
        args?: string[];
        flags?: Record<string, any>;
      }): Promise<ShellResult> => {
        return shell.execute(params.command, params.args || [], params.flags || {});
      }
    },

    {
      name: `${toolPrefix}_read`,
      description: `Read files from choreography networks. Maps to gadget state, configuration, and interfaces.

File types available:
  <network>/<gadget>/state.json    - Current gadget state
  <network>/<gadget>/status.json   - Gadget compilation status
  <network>/<gadget>/receive       - Interface for sending data to gadget
  <network>/<gadget>/emit          - Interface for monitoring gadget effects
  <network>/<gadget>/current       - Current state summary
  <network>/config                 - Network configuration
  <network>/metrics                - Compilation metrics

Examples:
  parser/state.json                # Read parser gadget state
  config                          # Read network config
  effects                         # Read recent effects`,

      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to read (relative to current directory)'
          },
          format: {
            type: 'string',
            enum: ['json', 'raw', 'interface'],
            description: 'Output format',
            default: 'raw'
          }
        },
        required: ['path']
      },

      handler: async (params: {
        path: string;
        format?: string;
      }): Promise<ShellResult> => {
        return shell.execute('cat', [params.path], { format: params.format });
      }
    },

    {
      name: `${toolPrefix}_compile`,
      description: `Compile choreography specifications into deployable artifacts. Supports multiple targets simultaneously.

Compilation targets:
  filesystem    - Generate shell scripts and directories
  container     - Generate Docker images and Kubernetes manifests

Features:
  - Always-on compilation networks
  - Progressive information sharing between compiler gadgets
  - Incremental compilation with dependency tracking
  - Multi-target output (same choreography → multiple deployment types)
  - Real-time compilation monitoring

Example choreography:
  name: payment-system
  roles:
    gateway: {type: coordinator, capabilities: [route_requests]}
    processor: {type: worker, capabilities: [process_payments]}
  relationships:
    gateway -> processor: payment_request`,

      parameters: {
        type: 'object',
        properties: {
          source: {
            type: 'string',
            description: 'Choreography source (file path or inline YAML/JSON)'
          },
          network: {
            type: 'string',
            description: 'Network ID to use (creates if not exists)',
            default: 'default'
          },
          targets: {
            type: 'array',
            items: { type: 'string' },
            description: 'Compilation targets',
            default: ['filesystem']
          },
          outputPath: {
            type: 'string',
            description: 'Output directory for artifacts'
          },
          optimization: {
            type: 'string',
            enum: ['none', 'basic', 'aggressive'],
            description: 'Optimization level',
            default: 'basic'
          }
        },
        required: ['source']
      },

      handler: async (params: {
        source: string;
        network?: string;
        targets?: string[];
        outputPath?: string;
        optimization?: string;
      }): Promise<ShellResult> => {
        const flags = {
          network: params.network,
          targets: params.targets?.join(','),
          outputPath: params.outputPath,
          optimization: params.optimization
        };

        // Remove undefined values
        Object.keys(flags).forEach(key => {
          if (flags[key as keyof typeof flags] === undefined) {
            delete flags[key as keyof typeof flags];
          }
        });

        return shell.execute('compile', [params.source], flags);
      }
    },

    {
      name: `${toolPrefix}_query`,
      description: `Query compilation network state using path-based syntax. Provides real-time insight into compilation process.

Query paths:
  /status                  - Overall network status
  /metrics                 - Compilation metrics
  /effects[/N]            - Recent effects (optionally limit to N)
  /gadgets                - All gadget states
  /gadgets/<name>         - Specific gadget state
  /config                 - Network configuration

Examples:
  /metrics                 # Get compilation metrics
  /effects/10             # Get last 10 compilation effects
  /gadgets/parser         # Get parser gadget state`,

      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Query path (e.g., /metrics, /effects/10, /gadgets/parser)'
          },
          network: {
            type: 'string',
            description: 'Network ID (uses current if not specified)'
          },
          format: {
            type: 'string',
            enum: ['json', 'summary', 'raw'],
            description: 'Output format',
            default: 'json'
          }
        },
        required: ['path']
      },

      handler: async (params: {
        path: string;
        network?: string;
        format?: string;
      }): Promise<ShellResult> => {
        return shell.execute('query', [params.network || '', params.path], { format: params.format });
      }
    }
  ];
}

/**
 * Create MCP server instance that wraps the MCP gadget
 */
export function createMCPServer(shell: ChoreographyShell, options: { toolPrefix?: string } = {}) {
  const mcpGadget = createMCPGadget(shell, options.toolPrefix);
  const tools = createMCPTools({ shell, toolPrefix: options.toolPrefix });

  // Set up response handling
  let currentResponse: MCPResponse | null = null;

  mcpGadget.on('mcpResponse', (effect: any) => {
    currentResponse = effect.mcpResponse;
  });

  return {
    tools,
    shell,
    mcpGadget,

    // Helper methods for Claude Code integration
    async handleToolCall(toolName: string, parameters: any, sessionId?: string): Promise<ShellResult> {
      // Send request through the MCP gadget
      const request: MCPRequest = {
        tool: toolName,
        params: parameters,
        sessionId
      };

      // Reset current response
      currentResponse = null;

      // Send request to gadget
      mcpGadget.receive(request);

      // Wait for response (in real implementation, this would be promise-based)
      await new Promise(resolve => setTimeout(resolve, 10));

      if (currentResponse) {
        return currentResponse.result;
      }

      return {
        success: false,
        output: '',
        error: `Tool execution failed: ${toolName}`
      };
    },

    // Get available tools description for Claude
    getToolsDescription(): string {
      return tools.map(tool =>
        `${tool.name}: ${tool.description}`
      ).join('\\n\\n');
    },

    // Query the MCP gadget state
    async queryMCP(query: string): Promise<any> {
      mcpGadget.receive({ query });
      await new Promise(resolve => setTimeout(resolve, 10));
      return null; // In real implementation, capture query response
    },

    // Quick operations for common patterns
    async quickStatus(): Promise<ShellResult> {
      return this.handleToolCall('choreo_exec', { command: 'status' });
    },

    async quickCompile(source: string, targets: string[] = ['filesystem']): Promise<ShellResult> {
      return this.handleToolCall('choreo_compile', { source, targets });
    },

    async quickQuery(path: string): Promise<ShellResult> {
      return this.handleToolCall('choreo_query', { path });
    }
  };
}