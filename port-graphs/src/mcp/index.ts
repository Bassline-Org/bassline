/**
 * MCP Integration for Choreographic Compilation Networks
 *
 * Provides Claude Code with interactive access to running compilation networks
 * through a filesystem-like interface using universal tools
 *
 * Now properly implemented as gadgets following the universal protocol!
 */

export { ChoreographyShell } from './shell';
export { createMCPGadget } from './gadget';
export { createMCPServer } from './server';
export type {
  MCPShellConfig,
  NetworkHandle,
  ShellCommand,
  ShellResult,
  MCPRequest,
  MCPResponse
} from './types';