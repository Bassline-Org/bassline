/**
 * MCP Integration Gadget
 *
 * A gadget that provides Claude Code access to compilation networks
 * through universal MCP tools. The gadget receives MCP requests and
 * emits shell operation effects.
 */

import { createGadget } from '../core';
import { changed, noop } from '../effects';
import { ChoreographyShell } from './shell';
import { MCPTool, ShellResult } from './types';

export interface MCPGadgetState {
  shell: ChoreographyShell;
  activeTools: Map<string, MCPTool>;
  requestHistory: Array<{
    timestamp: number;
    tool: string;
    params: any;
    result: ShellResult;
  }>;
  sessions: Map<string, {
    currentDirectory: string;
    lastActivity: number;
  }>;
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

/**
 * Create MCP Integration Gadget
 */
export function createMCPGadget(shell: ChoreographyShell, toolPrefix = 'choreo') {
  const tools = createUniversalTools(toolPrefix);

  const initialState: MCPGadgetState = {
    shell,
    activeTools: new Map(tools.map(tool => [tool.name, tool])),
    requestHistory: [],
    sessions: new Map()
  };

  return createGadget<MCPGadgetState, MCPRequest>((state, request) => {
    if (!request || typeof request !== 'object') return null;

    // Handle different request types
    if ('tool' in request) {
      return { action: 'handle_mcp_request', context: request };
    }

    if ('query' in request) {
      return { action: 'query_state', context: request };
    }

    if ('session' in request) {
      return { action: 'manage_session', context: request };
    }

    return null;
  })({

    handle_mcp_request: async (gadget, state, request: MCPRequest) => {
      const tool = state.activeTools.get(request.tool);

      if (!tool) {
        const errorResult: MCPResponse = {
          success: false,
          result: {
            success: false,
            output: '',
            error: `Unknown tool: ${request.tool}`
          },
          sessionId: request.sessionId
        };

        gadget.emit(changed({ mcpResponse: errorResult }));
        return state;
      }

      try {
        // Handle session context
        if (request.sessionId) {
          const session = state.sessions.get(request.sessionId);
          if (session && session.currentDirectory !== state.shell.pwd()) {
            state.shell.cd(session.currentDirectory);
          }
        }

        // Execute the tool
        const result = await tool.handler(request.params, state.shell);

        // Update session if needed
        if (request.sessionId) {
          state.sessions.set(request.sessionId, {
            currentDirectory: state.shell.pwd(),
            lastActivity: Date.now()
          });
        }

        // Record in history
        const historyEntry = {
          timestamp: Date.now(),
          tool: request.tool,
          params: request.params,
          result
        };

        const newHistory = [...state.requestHistory, historyEntry];
        // Keep only last 1000 requests
        if (newHistory.length > 1000) {
          newHistory.splice(0, newHistory.length - 500);
        }

        const response: MCPResponse = {
          success: result.success,
          result,
          sessionId: request.sessionId
        };

        gadget.emit(changed({
          mcpResponse: response,
          requestHistory: newHistory
        }));

        return {
          ...state,
          requestHistory: newHistory
        };

      } catch (error) {
        const errorResult: MCPResponse = {
          success: false,
          result: {
            success: false,
            output: '',
            error: error instanceof Error ? error.message : 'Unknown error'
          },
          sessionId: request.sessionId
        };

        gadget.emit(changed({ mcpResponse: errorResult }));
        return state;
      }
    },

    query_state: (gadget, state, query: any) => {
      let result: any;

      switch (query.query) {
        case 'tools':
          result = Array.from(state.activeTools.keys());
          break;
        case 'history':
          const limit = query.limit || 50;
          result = state.requestHistory.slice(-limit);
          break;
        case 'sessions':
          result = Object.fromEntries(state.sessions);
          break;
        case 'shell_status':
          result = {
            workingDirectory: state.shell.pwd(),
            networks: state.shell.listNetworks().map(n => ({
              id: n.id,
              status: n.status,
              lastActivity: n.lastActivity
            }))
          };
          break;
        default:
          result = { error: `Unknown query: ${query.query}` };
      }

      gadget.emit(changed({ queryResponse: { query: query.query, result } }));
      return state;
    },

    manage_session: (gadget, state, sessionRequest: any) => {
      const { sessionId, action } = sessionRequest;

      switch (action) {
        case 'create':
          state.sessions.set(sessionId, {
            currentDirectory: state.shell.pwd(),
            lastActivity: Date.now()
          });
          break;

        case 'cleanup':
          const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
          for (const [id, session] of state.sessions.entries()) {
            if (session.lastActivity < cutoff) {
              state.sessions.delete(id);
            }
          }
          break;

        case 'destroy':
          state.sessions.delete(sessionId);
          break;
      }

      gadget.emit(changed({ sessionManagement: { action, sessionId } }));
      return state;
    }

  })(initialState);
}

/**
 * Create universal MCP tools - these are the actual tool definitions
 */
function createUniversalTools(toolPrefix: string): MCPTool[] {
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
      }, shell: ChoreographyShell): Promise<ShellResult> => {
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
      }, shell: ChoreographyShell): Promise<ShellResult> => {
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
      }, shell: ChoreographyShell): Promise<ShellResult> => {
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
      }, shell: ChoreographyShell): Promise<ShellResult> => {
        return shell.execute('query', [params.network || '', params.path], { format: params.format });
      }
    }
  ];
}