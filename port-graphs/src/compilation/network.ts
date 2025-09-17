/**
 * Compilation Choreography Network
 *
 * Creates and orchestrates the always-on compilation network where
 * parser, validator, and compiler gadgets collaborate
 * continuously to transform choreographies into deployable artifacts
 */

import { IncrementalCompiler } from './base';
import { createChoreographyParser } from './gadgets/parser-functional';
import { createSemanticValidator } from './gadgets/validator-functional';
import { createFilesystemCompiler } from './targets/filesystem-functional';
import { createContainerCompiler } from './targets/container';
import { createFileMaterializer } from './gadgets/materializer-functional';
import { CompilationEffect, CompilationMetrics } from './types';

export interface CompilationNetworkConfig {
  outputPath: string;
  targets?: string[];
  dryRun?: boolean;
  enableBackup?: boolean;
}

export class CompilationNetwork {
  private coordinator: IncrementalCompiler;
  private parser: any;
  private validator: any;
  private filesystemCompiler: any;
  private containerCompiler: any;
  private materializer: any;
  private config: CompilationNetworkConfig;
  private effectLog: CompilationEffect[] = [];

  constructor(config: CompilationNetworkConfig) {
    this.config = {
      targets: ['filesystem'],
      dryRun: false,
      enableBackup: true,
      ...config
    };

    this.coordinator = new IncrementalCompiler();
    this.setupGadgets();
    this.wireNetwork();
  }

  private setupGadgets(): void {
    // Create compilation gadgets
    this.parser = createChoreographyParser();
    this.validator = createSemanticValidator();

    // Create target compilers
    if (this.config.targets?.includes('filesystem')) {
      this.filesystemCompiler = createFilesystemCompiler({
        outputPath: this.config.outputPath
      });
    }

    if (this.config.targets?.includes('container')) {
      this.containerCompiler = createContainerCompiler({
        outputPath: this.config.outputPath,
        generateK8s: true
      });
    }

    // Create materializer for any target that needs file output
    if (this.config.targets?.some(t => ['filesystem', 'container'].includes(t))) {
      this.materializer = createFileMaterializer({
        outputPath: this.config.outputPath,
        dryRun: this.config.dryRun,
        backupExisting: this.config.enableBackup
      });
    }

    // Register gadgets with coordinator
    this.coordinator.addGadget('parser', this.parser);
    this.coordinator.addGadget('validator', this.validator);

    if (this.filesystemCompiler) {
      this.coordinator.addGadget('filesystem_compiler', this.filesystemCompiler);
    }

    if (this.containerCompiler) {
      this.coordinator.addGadget('container_compiler', this.containerCompiler);
    }

    if (this.materializer) {
      this.coordinator.addGadget('materializer', this.materializer);
    }
  }

  private wireNetwork(): void {
    // Set up effect routing between gadgets
    this.setupEffectRouting();

    // Set up logging
    this.setupEffectLogging();
  }

  private setupEffectRouting(): void {
    // Store original emit methods and wrap them
    const originalParserEmit = this.parser.emit.bind(this.parser);
    const originalValidatorEmit = this.validator.emit.bind(this.validator);

    // Parser -> Validator
    this.parser.emit = (effect: CompilationEffect) => {
      this.logEffect('parser', effect);
      this.coordinator.propagateEffect(effect);
      // Call original emit for any internal gadget processing
      originalParserEmit(effect);
    };

    // Validator -> Compilers
    this.validator.emit = (effect: CompilationEffect) => {
      this.logEffect('validator', effect);
      this.coordinator.propagateEffect(effect);
      originalValidatorEmit(effect);
    };

    // Target Compilers -> Materializer
    if (this.filesystemCompiler && this.materializer) {
      const originalFilesystemEmit = this.filesystemCompiler.emit.bind(this.filesystemCompiler);
      this.filesystemCompiler.emit = (effect: CompilationEffect) => {
        this.logEffect('filesystem_compiler', effect);

        // Route materialization effects to materializer
        if ('materialization' in effect) {
          this.materializer.receive(effect);
        }

        this.coordinator.propagateEffect(effect);
        originalFilesystemEmit(effect);
      };
    }

    if (this.containerCompiler && this.materializer) {
      const originalContainerEmit = this.containerCompiler.emit.bind(this.containerCompiler);
      this.containerCompiler.emit = (effect: CompilationEffect) => {
        this.logEffect('container_compiler', effect);

        // Route materialization effects to materializer
        if ('materialization' in effect) {
          this.materializer.receive(effect);
        }

        this.coordinator.propagateEffect(effect);
        originalContainerEmit(effect);
      };
    }

    if (this.materializer) {
      const originalMaterializerEmit = this.materializer.emit.bind(this.materializer);
      this.materializer.emit = (effect: CompilationEffect) => {
        this.logEffect('materializer', effect);
        this.coordinator.propagateEffect(effect);
        originalMaterializerEmit(effect);
      };
    }
  }

  private setupEffectLogging(): void {
    // Keep track of all effects for debugging and metrics
    this.effectLog = [];
  }

  private logEffect(source: string, effect: CompilationEffect): void {
    const logEntry = {
      ...effect,
      _source: source,
      _timestamp: Date.now()
    };
    this.effectLog.push(logEntry);

    // Keep only recent effects to prevent memory issues
    if (this.effectLog.length > 1000) {
      this.effectLog = this.effectLog.slice(-500);
    }
  }

  /**
   * Compile a choreography specification
   */
  async compile(source: string, options: {
    path?: string;
    format?: 'yaml' | 'json';
    watch?: boolean;
  } = {}): Promise<CompilationResult> {
    const startTime = Date.now();

    try {
      // Start compilation by sending source to parser
      this.parser.receive({
        source,
        path: options.path,
        format: options.format || 'yaml'
      });

      // Wait for compilation to complete
      const result = await this.waitForCompletion();

      const endTime = Date.now();
      result.metrics.compilationTime = endTime - startTime;

      return result;

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown compilation error',
        metrics: this.getMetrics(),
        artifacts: [],
        effects: this.getRecentEffects()
      };
    }
  }

  /**
   * Watch for changes and recompile automatically
   */
  watch(source: string, options: { path?: string; format?: 'yaml' | 'json' } = {}): void {
    // Initial compilation
    this.compile(source, options);

    // In a real implementation, this would watch for file changes
    // For now, we just provide the interface
    console.log('Watching for changes... (not implemented yet)');
  }

  /**
   * Get current compilation status
   */
  getStatus(): CompilationStatus {
    const gadgetStatus = this.coordinator.getCompilationStatus();
    const recentEffects = this.getRecentEffects();

    return {
      active: true,
      gadgets: gadgetStatus,
      recentEffects: recentEffects.length,
      metrics: this.getMetrics(),
      configuration: this.config
    };
  }

  /**
   * Get compilation metrics
   */
  getMetrics(): CompilationMetrics {
    // Aggregate metrics from all gadgets
    const gadgetStatus = this.coordinator.getCompilationStatus();

    const aggregated: CompilationMetrics = {
      totalNodes: 0,
      parsedNodes: 0,
      validNodes: 0,
      optimizedNodes: 0,
      generatedArtifacts: 0,
      materializedFiles: 0,
      compilationTime: 0,
      errors: 0,
      warnings: 0
    };

    Object.values(gadgetStatus).forEach((status: any) => {
      if (status.metrics) {
        aggregated.totalNodes = Math.max(aggregated.totalNodes, status.metrics.totalNodes || 0);
        aggregated.parsedNodes += status.metrics.parsedNodes || 0;
        aggregated.validNodes += status.metrics.validNodes || 0;
        aggregated.optimizedNodes += status.metrics.optimizedNodes || 0;
        aggregated.generatedArtifacts += status.metrics.generatedArtifacts || 0;
        aggregated.materializedFiles += status.metrics.materializedFiles || 0;
        aggregated.compilationTime += status.metrics.compilationTime || 0;
        aggregated.errors += status.metrics.errors || 0;
        aggregated.warnings += status.metrics.warnings || 0;
      }
    });

    return aggregated;
  }

  /**
   * Get recent compilation effects
   */
  getRecentEffects(limit: number = 50): CompilationEffect[] {
    return this.effectLog.slice(-limit);
  }

  /**
   * Query compilation state using path-like syntax
   */
  query(path: string): any {
    const parts = path.split('/').filter(p => p);

    if (parts.length === 0) {
      return this.getStatus();
    }

    const [component, ...rest] = parts;

    switch (component) {
      case 'status':
        return this.getStatus();
      case 'metrics':
        return this.getMetrics();
      case 'effects':
        const limit = rest[0] ? parseInt(rest[0], 10) : 50;
        return this.getRecentEffects(limit);
      case 'gadgets':
        if (rest.length === 0) {
          return this.coordinator.getCompilationStatus();
        }
        const gadgetName = rest[0];
        const gadgetStatus = this.coordinator.getCompilationStatus();
        return gadgetStatus[gadgetName] || null;
      case 'config':
        return this.config;
      default:
        return null;
    }
  }

  /**
   * Modify compilation network configuration
   */
  configure(updates: Partial<CompilationNetworkConfig>): void {
    this.config = { ...this.config, ...updates };

    // Apply configuration changes to gadgets
    if (updates.dryRun !== undefined && this.materializer) {
      // Reconfigure materializer
      this.materializer.configure({ dryRun: updates.dryRun });
    }
  }

  /**
   * Shutdown compilation network
   */
  shutdown(): void {
    // In a real implementation, this would clean up resources,
    // stop background processes, etc.
    console.log('Shutting down compilation network...');
  }

  private async waitForCompletion(timeout: number = 30000): Promise<CompilationResult> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = 100; // Check every 100ms

      const check = () => {
        const elapsed = Date.now() - startTime;

        if (elapsed > timeout) {
          resolve({
            success: false,
            error: 'Compilation timeout',
            metrics: this.getMetrics(),
            artifacts: [],
            effects: this.getRecentEffects()
          });
          return;
        }

        const metrics = this.getMetrics();

        // Check if compilation appears complete
        // (This is a simplified heuristic - in practice, you'd track completion more precisely)
        if (metrics.totalNodes > 0 &&
            metrics.parsedNodes === metrics.totalNodes &&
            metrics.validNodes === metrics.totalNodes &&
            (this.config.optimizationLevel === 'none' || metrics.optimizedNodes === metrics.totalNodes)) {

          resolve({
            success: true,
            metrics,
            artifacts: this.getGeneratedArtifacts(),
            effects: this.getRecentEffects()
          });
          return;
        }

        setTimeout(check, checkInterval);
      };

      check();
    });
  }

  private getGeneratedArtifacts(): any[] {
    // Extract artifacts from recent effects
    return this.effectLog
      .filter((effect: any) => 'codeGeneration' in effect)
      .flatMap((effect: any) => effect.codeGeneration.artifacts || []);
  }
}

export interface CompilationResult {
  success: boolean;
  error?: string;
  metrics: CompilationMetrics;
  artifacts: any[];
  effects: CompilationEffect[];
}

export interface CompilationStatus {
  active: boolean;
  gadgets: Record<string, any>;
  recentEffects: number;
  metrics: CompilationMetrics;
  configuration: CompilationNetworkConfig;
}

/**
 * Create a compilation network
 */
export function createCompilationNetwork(config: CompilationNetworkConfig): CompilationNetwork {
  return new CompilationNetwork(config);
}