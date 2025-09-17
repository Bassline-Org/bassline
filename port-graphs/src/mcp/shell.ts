/**
 * Choreography Shell - Filesystem-like Interface to Compilation Networks
 *
 * Provides a shell-like interface where compilation networks appear as
 * directories, gadgets as subdirectories, and compilation state as files
 */

import { CompilationNetwork } from '../compilation/network';
import { createCompilationNetwork } from '../compilation/network';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MCPShellConfig, NetworkHandle, ShellCommand, ShellResult } from './types';

export class ChoreographyShell {
  private networks = new Map<string, NetworkHandle>();
  private workingDirectory: string;
  private currentNetworkId: string | null = null;
  private commandHistory: string[] = [];
  private config: MCPShellConfig;

  constructor(config: MCPShellConfig) {
    this.config = {
      maxHistorySize: 1000,
      enableWatching: true,
      ...config
    };
    this.workingDirectory = config.workingDirectory;

    // Initialize with any provided networks
    config.networks.forEach((network, id) => {
      this.networks.set(id, {
        id,
        network,
        path: path.join(this.workingDirectory, id),
        status: 'active',
        lastActivity: Date.now()
      });
    });
  }

  /**
   * Execute a shell command
   */
  async execute(command: string, args: string[] = [], flags: Record<string, any> = {}): Promise<ShellResult> {
    this.addToHistory(`${command} ${args.join(' ')}`);

    try {
      switch (command) {
        case 'ls':
          return this.listDirectory(args[0] || '.', flags);

        case 'cd':
          return this.changeDirectory(args[0] || '~');

        case 'pwd':
          return { success: true, output: this.workingDirectory };

        case 'cat':
          return this.readFile(args[0], flags);

        case 'compile':
          return this.compileChoreography(args[0], flags);

        case 'create-network':
          return this.createNetwork(args[0], flags);

        case 'watch':
          return this.watchNetwork(args[0], flags);

        case 'query':
          return this.queryNetwork(args[0], args[1], flags);

        case 'status':
          return this.getNetworkStatus(args[0] || this.currentNetworkId, flags);

        case 'effects':
          return this.getEffectsStream(args[0] || this.currentNetworkId, flags);

        case 'help':
          return this.showHelp(args[0]);

        default:
          return {
            success: false,
            output: '',
            error: `Unknown command: ${command}. Type 'help' for available commands.`
          };
      }
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List directory contents - maps to network/gadget structure
   */
  private async listDirectory(targetPath: string, flags: Record<string, any>): Promise<ShellResult> {
    const fullPath = this.resolvePath(targetPath);
    const relativePath = path.relative(this.workingDirectory, fullPath);
    const pathParts = relativePath.split('/').filter(p => p && p !== '.');

    // Root level - show networks
    if (pathParts.length === 0) {
      const networks = Array.from(this.networks.values()).map(net => ({
        name: net.id,
        type: 'network',
        status: net.status,
        lastActivity: new Date(net.lastActivity).toISOString()
      }));

      const output = networks.map(net =>
        flags.long ?
          `${net.type}\t${net.status}\t${net.lastActivity}\t${net.name}` :
          net.name
      ).join('\\n');

      return { success: true, output, data: networks };
    }

    // Network level - show gadgets
    const [networkId, ...subPath] = pathParts;
    const network = this.networks.get(networkId);

    if (!network) {
      return { success: false, output: '', error: `Network not found: ${networkId}` };
    }

    if (subPath.length === 0) {
      // Show gadgets in network
      const status = network.network.getStatus();
      const gadgets = Object.keys(status.gadgets).map(name => ({
        name,
        type: 'gadget',
        status: status.gadgets[name].status || 'active'
      }));

      // Add special directories
      const specialDirs = [
        { name: 'effects', type: 'stream' },
        { name: 'metrics', type: 'data' },
        { name: 'config', type: 'data' }
      ];

      const allItems = [...gadgets, ...specialDirs];
      const output = allItems.map(item =>
        flags.long ?
          `${item.type}\t${item.status || 'static'}\t${item.name}` :
          item.name
      ).join('\\n');

      return { success: true, output, data: allItems };
    }

    // Gadget level - show gadget interface files
    const [gadgetName, ...filePath] = subPath;

    if (gadgetName === 'effects') {
      return this.listEffects(network, filePath, flags);
    }

    if (gadgetName === 'metrics') {
      return this.listMetrics(network, filePath, flags);
    }

    if (gadgetName === 'config') {
      return this.listConfig(network, filePath, flags);
    }

    // Regular gadget directory
    const gadgetFiles = [
      { name: 'state.json', type: 'state' },
      { name: 'receive', type: 'interface' },
      { name: 'emit', type: 'interface' },
      { name: 'current', type: 'interface' },
      { name: 'status.json', type: 'status' }
    ];

    const output = gadgetFiles.map(file =>
      flags.long ?
        `${file.type}\t${file.name}` :
        file.name
    ).join('\\n');

    return { success: true, output, data: gadgetFiles };
  }

  /**
   * Change directory
   */
  private changeDirectory(targetPath: string): ShellResult {
    if (targetPath === '~') {
      this.workingDirectory = this.config.workingDirectory;
      this.currentNetworkId = null;
      return { success: true, output: this.workingDirectory };
    }

    const newPath = this.resolvePath(targetPath);
    const relativePath = path.relative(this.config.workingDirectory, newPath);
    const pathParts = relativePath.split('/').filter(p => p && p !== '.');

    // Validate path exists in our virtual filesystem
    if (pathParts.length > 0) {
      const networkId = pathParts[0];
      if (!this.networks.has(networkId)) {
        return { success: false, output: '', error: `Network not found: ${networkId}` };
      }
      this.currentNetworkId = networkId;
    }

    this.workingDirectory = newPath;
    return { success: true, output: newPath };
  }

  /**
   * Read file contents - maps to gadget state/interfaces
   */
  private async readFile(filePath: string, flags: Record<string, any>): Promise<ShellResult> {
    const fullPath = this.resolvePath(filePath);
    const relativePath = path.relative(this.config.workingDirectory, fullPath);
    const pathParts = relativePath.split('/').filter(p => p && p !== '.');

    if (pathParts.length < 2) {
      return { success: false, output: '', error: 'Invalid file path' };
    }

    const [networkId, gadgetName, fileName] = pathParts;
    const network = this.networks.get(networkId);

    if (!network) {
      return { success: false, output: '', error: `Network not found: ${networkId}` };
    }

    // Handle special files
    if (gadgetName === 'config' && !fileName) {
      const config = network.network.query('/config');
      return { success: true, output: JSON.stringify(config, null, 2), data: config };
    }

    if (gadgetName === 'metrics' && !fileName) {
      const metrics = network.network.getMetrics();
      return { success: true, output: JSON.stringify(metrics, null, 2), data: metrics };
    }

    if (!fileName) {
      return { success: false, output: '', error: 'File name required' };
    }

    // Handle gadget files
    const status = network.network.getStatus();
    const gadgetStatus = status.gadgets[gadgetName];

    if (!gadgetStatus) {
      return { success: false, output: '', error: `Gadget not found: ${gadgetName}` };
    }

    switch (fileName) {
      case 'state.json':
        return { success: true, output: JSON.stringify(gadgetStatus.state || {}, null, 2), data: gadgetStatus.state };

      case 'status.json':
        return { success: true, output: JSON.stringify(gadgetStatus, null, 2), data: gadgetStatus };

      case 'receive':
        return this.generateReceiveInterface(gadgetStatus);

      case 'emit':
        return this.generateEmitInterface(gadgetStatus);

      case 'current':
        return this.generateCurrentInterface(gadgetStatus);

      default:
        return { success: false, output: '', error: `Unknown file: ${fileName}` };
    }
  }

  /**
   * Compile choreography
   */
  private async compileChoreography(source: string, flags: Record<string, any>): Promise<ShellResult> {
    if (!source) {
      return { success: false, output: '', error: 'Source file or content required' };
    }

    // Get or create network
    let networkId = flags.network || 'default';
    let network = this.networks.get(networkId);

    if (!network) {
      const createResult = await this.createNetwork(networkId, {
        outputPath: path.join(this.config.workingDirectory, networkId),
        targets: flags.targets?.split(',') || ['filesystem']
      });

      if (!createResult.success) {
        return createResult;
      }

      network = this.networks.get(networkId)!;
    }

    try {
      // Read source if it's a file path
      let choreographySource = source;
      if (!source.includes('\\n') && !source.startsWith('{')) {
        try {
          choreographySource = await fs.readFile(source, 'utf-8');
        } catch {
          // Assume it's inline content
        }
      }

      // Compile
      const result = await network.network.compile(choreographySource, {
        path: flags.path || 'choreography.yaml',
        format: flags.format || 'yaml'
      });

      network.lastActivity = Date.now();
      network.status = result.success ? 'active' : 'inactive';

      const output = result.success ?
        `Compilation successful!
✓ ${result.metrics.totalNodes} nodes processed
✓ ${result.metrics.generatedArtifacts} artifacts generated
✓ ${result.metrics.materializedFiles} files materialized
✓ Compilation time: ${result.metrics.compilationTime}ms` :
        `Compilation failed: ${result.error}`;

      return {
        success: result.success,
        output,
        error: result.success ? undefined : result.error,
        data: result,
        sideEffects: result.success ? [{ type: 'compilation', details: result }] : undefined
      };

    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Compilation error'
      };
    }
  }

  /**
   * Create new network
   */
  private async createNetwork(networkId: string, flags: Record<string, any>): Promise<ShellResult> {
    if (this.networks.has(networkId)) {
      return { success: false, output: '', error: `Network already exists: ${networkId}` };
    }

    const config = {
      outputPath: flags.outputPath || path.join(this.config.workingDirectory, networkId),
      targets: Array.isArray(flags.targets) ? flags.targets : (flags.targets?.split(',') || ['filesystem']),
      optimizationLevel: flags.optimization || 'basic',
      dryRun: flags.dryRun || false,
      enableBackup: flags.backup !== false
    };

    const network = createCompilationNetwork(config);

    this.networks.set(networkId, {
      id: networkId,
      network,
      path: config.outputPath,
      status: 'active',
      lastActivity: Date.now()
    });

    return {
      success: true,
      output: `Created compilation network: ${networkId}`,
      data: { networkId, config },
      sideEffects: [{ type: 'network_created', details: { networkId, config } }]
    };
  }

  /**
   * Query network
   */
  private queryNetwork(networkId: string | null, queryPath: string, flags: Record<string, any>): ShellResult {
    networkId = networkId || this.currentNetworkId;

    if (!networkId) {
      return { success: false, output: '', error: 'No network specified' };
    }

    const network = this.networks.get(networkId);
    if (!network) {
      return { success: false, output: '', error: `Network not found: ${networkId}` };
    }

    const result = network.network.query(queryPath || '/status');
    const output = JSON.stringify(result, null, 2);

    return { success: true, output, data: result };
  }

  // Helper methods for generating interfaces and handling special directories
  private generateReceiveInterface(gadgetStatus: any): ShellResult {
    const interface_ = `# Gadget Receive Interface
# Send data to this gadget
echo "Capabilities: ${Object.keys(gadgetStatus.capabilities || {}).join(', ')}"
echo "Current state: AST v${gadgetStatus.astVersion || 0}"
echo "Usage: echo 'your-data' | ./receive"`;

    return { success: true, output: interface_ };
  }

  private generateEmitInterface(gadgetStatus: any): ShellResult {
    const interface_ = `# Gadget Emit Interface
# Monitor effects from this gadget
echo "Recent effects: ${gadgetStatus.recentEffects || 0}"
echo "Usage: ./emit | tail -f"`;

    return { success: true, output: interface_ };
  }

  private generateCurrentInterface(gadgetStatus: any): ShellResult {
    const interface_ = `# Current State Interface
# Get current gadget state
echo "AST Version: ${gadgetStatus.astVersion || 0}"
echo "Cache Size: ${gadgetStatus.cacheSize || 0}"
echo "Status: ${gadgetStatus.status || 'active'}"`;

    return { success: true, output: interface_ };
  }

  private listEffects(network: NetworkHandle, filePath: string[], flags: Record<string, any>): ShellResult {
    const effects = network.network.getRecentEffects(flags.limit || 50);
    const output = effects.map(effect => {
      const source = (effect as any)._source || 'unknown';
      const type = Object.keys(effect)[0];
      const timestamp = new Date((effect as any)._timestamp).toISOString();
      return `${timestamp} [${source}] ${type}`;
    }).join('\\n');

    return { success: true, output, data: effects };
  }

  private listMetrics(network: NetworkHandle, filePath: string[], flags: Record<string, any>): ShellResult {
    const metrics = network.network.getMetrics();
    const output = Object.entries(metrics).map(([key, value]) => `${key}: ${value}`).join('\\n');
    return { success: true, output, data: metrics };
  }

  private listConfig(network: NetworkHandle, filePath: string[], flags: Record<string, any>): ShellResult {
    const config = network.network.query('/config');
    const output = JSON.stringify(config, null, 2);
    return { success: true, output, data: config };
  }

  private watchNetwork(networkId: string | null, flags: Record<string, any>): ShellResult {
    // In a real implementation, this would set up file watching
    return { success: true, output: `Watching network ${networkId || 'current'} (not implemented yet)` };
  }

  private getNetworkStatus(networkId: string | null, flags: Record<string, any>): ShellResult {
    networkId = networkId || this.currentNetworkId;

    if (!networkId) {
      // Show all networks
      const networks = Array.from(this.networks.values());
      const output = networks.map(net =>
        `${net.id}: ${net.status} (last activity: ${new Date(net.lastActivity).toISOString()})`
      ).join('\\n');
      return { success: true, output, data: networks };
    }

    const network = this.networks.get(networkId);
    if (!network) {
      return { success: false, output: '', error: `Network not found: ${networkId}` };
    }

    const status = network.network.getStatus();
    const output = JSON.stringify(status, null, 2);
    return { success: true, output, data: status };
  }

  private getEffectsStream(networkId: string | null, flags: Record<string, any>): ShellResult {
    networkId = networkId || this.currentNetworkId;

    if (!networkId) {
      return { success: false, output: '', error: 'No network specified' };
    }

    const network = this.networks.get(networkId);
    if (!network) {
      return { success: false, output: '', error: `Network not found: ${networkId}` };
    }

    const effects = network.network.getRecentEffects(flags.limit || 50);
    const output = effects.map(effect => JSON.stringify(effect)).join('\\n');
    return { success: true, output, data: effects };
  }

  private showHelp(command?: string): ShellResult {
    if (command) {
      const help = this.getCommandHelp(command);
      return { success: true, output: help };
    }

    const help = `Choreography Shell - Universal Commands

Navigation:
  ls [path]              List networks, gadgets, or files
  cd <path>              Change directory
  pwd                    Print working directory

Network Operations:
  create-network <id>    Create new compilation network
  compile <source>       Compile choreography to artifacts
  watch <network>        Watch for changes (not implemented)
  status [network]       Show network status

Querying:
  cat <file>            Read file contents (state, config, interfaces)
  query <network> <path> Query network using path syntax
  effects [network]      Show recent effects stream

Flags:
  --long, -l            Long format listing
  --network <id>        Specify network for operations
  --targets <list>      Comma-separated compilation targets
  --limit <n>           Limit number of results

Examples:
  ls                    # List all networks
  cd my-network         # Enter network directory
  ls                    # List gadgets in network
  cat parser/state.json # Read parser gadget state
  compile choreography.yaml --targets filesystem,container
  query my-network /metrics
`;

    return { success: true, output: help };
  }

  private getCommandHelp(command: string): string {
    const helpText: Record<string, string> = {
      ls: 'ls [path] [--long] - List directory contents',
      cd: 'cd <path> - Change directory (~, network names, gadget names)',
      compile: 'compile <source> [--network <id>] [--targets <list>] - Compile choreography',
      'create-network': 'create-network <id> [--targets <list>] - Create compilation network',
      cat: 'cat <file> - Read file (state.json, status.json, receive, emit, current)',
      query: 'query [network] <path> - Query network (/status, /metrics, /effects/N)',
      status: 'status [network] - Show network compilation status',
      effects: 'effects [network] [--limit N] - Show recent compilation effects'
    };

    return helpText[command] || `No help available for command: ${command}`;
  }

  // Public interface methods
  getNetwork(id: string): NetworkHandle | null {
    return this.networks.get(id) || null;
  }

  listNetworks(): NetworkHandle[] {
    return Array.from(this.networks.values());
  }

  pwd(): string {
    return this.workingDirectory;
  }

  cd(path: string): boolean {
    const result = this.changeDirectory(path);
    return result.success;
  }

  private resolvePath(targetPath: string): string {
    if (path.isAbsolute(targetPath)) {
      return targetPath;
    }
    return path.resolve(this.workingDirectory, targetPath);
  }

  private addToHistory(command: string): void {
    this.commandHistory.push(command);
    if (this.commandHistory.length > (this.config.maxHistorySize || 1000)) {
      this.commandHistory = this.commandHistory.slice(-500);
    }
  }
}