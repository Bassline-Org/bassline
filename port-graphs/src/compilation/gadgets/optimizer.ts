/**
 * Choreography Optimizer Gadget
 *
 * Continuously optimizes validated AST nodes, applying transformations to
 * improve performance, reduce complexity, and optimize for specific deployment targets
 */

import { CompilationGadget, CompilationEffects } from '../base';
import {
  CompilationEffect,
  CompilationGadgetState,
  OptimizationResult,
  OptimizationTransform,
  OptimizationMetrics,
  RoleNode,
  RelationshipNode
} from '../types';
import { changed, noop } from '../../effects';

interface OptimizationStrategy {
  name: string;
  priority: number;
  applicable: (node: any) => boolean;
  apply: (node: any, context: OptimizationContext) => OptimizationTransform[];
}

interface OptimizationContext {
  ast: any;
  targetPlatform?: string;
  performanceGoals: string[];
  constraints: Record<string, any>;
}

export class ChoreographyOptimizer extends CompilationGadget {
  private strategies: OptimizationStrategy[] = [];

  constructor(initialState: any = {}) {
    super(initialState);
    this.initializeOptimizationStrategies();
  }

  protected consider(
    state: CompilationGadgetState,
    effect: CompilationEffect
  ): { action: string; context: any } | null {
    if ('validationResult' in effect && effect.validationResult.valid) {
      return { action: 'optimize', context: effect.validationResult };
    }

    if ('astUpdate' in effect && effect.astUpdate.update.status === 'valid') {
      return { action: 'optimize', context: { nodeId: effect.astUpdate.nodeId } };
    }

    return null;
  }

  protected createActions() {
    return {
      'optimize': (gadget: any, context: { nodeId: string }) => {
        const state = gadget.current() as CompilationGadgetState;
        const { nodeId } = context;

        try {
          const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
          if (!node) {
            return noop();
          }

          const optimizationResult = this.optimizeNode(node, state);

          // Update optimization state
          const newAST = { ...state.ast };
          newAST.optimizationState.set(nodeId, optimizationResult);

          // Update node status
          this.updateASTNode(newAST, nodeId, { status: 'optimized' });

          // Update metrics
          const newMetrics = { ...state.metrics };
          newMetrics.optimizedNodes++;
          newMetrics.compilationTime += optimizationResult.metrics.compilationTime;

          gadget.update({
            ...state,
            ast: newAST,
            metrics: newMetrics
          });

          // Emit optimization result
          gadget.emit(CompilationEffects.optimization(optimizationResult));

          return changed({
            optimized: true,
            nodeId,
            transforms: optimizationResult.transforms.length,
            improvement: this.calculateImprovement(optimizationResult)
          });

        } catch (error) {
          gadget.emit(CompilationEffects.compilationError(nodeId, {
            code: 'OPTIMIZATION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown optimization error',
            severity: 'warning' // Optimization failures are usually non-fatal
          }));

          return changed({ optimized: false, nodeId, error: error.message });
        }
      }
    };
  }

  private optimizeNode(node: any, state: CompilationGadgetState): OptimizationResult {
    const context: OptimizationContext = {
      ast: state.ast,
      targetPlatform: state.target?.id,
      performanceGoals: ['latency', 'throughput', 'resource_efficiency'],
      constraints: {}
    };

    const transforms: OptimizationTransform[] = [];
    const startTime = Date.now();

    // Apply applicable optimization strategies
    this.strategies
      .filter(strategy => strategy.applicable(node))
      .sort((a, b) => b.priority - a.priority)
      .forEach(strategy => {
        try {
          const strategyTransforms = strategy.apply(node, context);
          transforms.push(...strategyTransforms);
        } catch (error) {
          console.warn(`Optimization strategy '${strategy.name}' failed:`, error);
        }
      });

    const compilationTime = Date.now() - startTime;

    const metrics: OptimizationMetrics = {
      compilationTime,
      codeSize: this.estimateCodeSize(node, transforms),
      estimatedPerformance: this.estimatePerformance(node, transforms)
    };

    return {
      nodeId: node.id,
      transforms,
      metrics
    };
  }

  private initializeOptimizationStrategies(): void {
    // Dead code elimination for roles
    this.strategies.push({
      name: 'dead_role_elimination',
      priority: 10,
      applicable: (node) => node.type === 'role',
      apply: (node: RoleNode, context) => {
        const transforms: OptimizationTransform[] = [];

        // Check if role is actually used in any relationships
        const isUsed = Array.from(context.ast.relationships.values()).some(
          (rel: RelationshipNode) => rel.from === node.name || rel.to === node.name
        );

        if (!isUsed) {
          transforms.push({
            type: 'dead_code_elimination',
            description: `Role '${node.name}' is never used in relationships`,
            before: node,
            after: null,
            impact: 0.8 // High impact
          });
        }

        return transforms;
      }
    });

    // Capability optimization for roles
    this.strategies.push({
      name: 'capability_optimization',
      priority: 7,
      applicable: (node) => node.type === 'role',
      apply: (node: RoleNode, context) => {
        const transforms: OptimizationTransform[] = [];

        // Find actually used capabilities
        const usedCapabilities = new Set<string>();
        Array.from(context.ast.relationships.values()).forEach((rel: RelationshipNode) => {
          if (rel.from === node.name) {
            usedCapabilities.add(`send_${rel.protocol}`);
          }
          if (rel.to === node.name) {
            usedCapabilities.add(`receive_${rel.protocol}`);
          }
        });

        // Remove unused capabilities (except wildcard '*')
        const optimizedCapabilities = node.capabilities.filter(cap =>
          cap === '*' || usedCapabilities.has(cap)
        );

        if (optimizedCapabilities.length < node.capabilities.length) {
          const optimizedNode = { ...node, capabilities: optimizedCapabilities };
          transforms.push({
            type: 'capability_optimization',
            description: `Removed ${node.capabilities.length - optimizedCapabilities.length} unused capabilities`,
            before: node.capabilities,
            after: optimizedCapabilities,
            impact: 0.3
          });
        }

        return transforms;
      }
    });

    // Relationship deduplication
    this.strategies.push({
      name: 'relationship_deduplication',
      priority: 8,
      applicable: (node) => node.type === 'relationship',
      apply: (node: RelationshipNode, context) => {
        const transforms: OptimizationTransform[] = [];

        // Find duplicate relationships
        const duplicates = Array.from(context.ast.relationships.values()).filter(
          (rel: RelationshipNode) =>
            rel.id !== node.id &&
            rel.from === node.from &&
            rel.to === node.to &&
            rel.protocol === node.protocol
        );

        if (duplicates.length > 0) {
          transforms.push({
            type: 'deduplication',
            description: `Found ${duplicates.length} duplicate relationships`,
            before: [node, ...duplicates],
            after: node,
            impact: 0.5
          });
        }

        return transforms;
      }
    });

    // Transport optimization
    this.strategies.push({
      name: 'transport_optimization',
      priority: 6,
      applicable: (node) => node.type === 'relationship',
      apply: (node: RelationshipNode, context) => {
        const transforms: OptimizationTransform[] = [];

        // Suggest optimal transport based on relationship pattern
        let suggestedTransport = node.transport;

        if (!suggestedTransport) {
          // Default transport selection logic
          if (node.protocol.includes('stream') || node.protocol.includes('data')) {
            suggestedTransport = 'tcp';
          } else if (node.protocol.includes('event') || node.protocol.includes('notification')) {
            suggestedTransport = 'udp';
          } else {
            suggestedTransport = 'http';
          }

          const optimizedNode = { ...node, transport: suggestedTransport };
          transforms.push({
            type: 'transport_optimization',
            description: `Selected optimal transport '${suggestedTransport}' for protocol '${node.protocol}'`,
            before: node.transport || 'unspecified',
            after: suggestedTransport,
            impact: 0.4
          });
        }

        return transforms;
      }
    });

    // Batching optimization for high-throughput relationships
    this.strategies.push({
      name: 'batching_optimization',
      priority: 5,
      applicable: (node) => node.type === 'relationship',
      apply: (node: RelationshipNode, context) => {
        const transforms: OptimizationTransform[] = [];

        // Check if this relationship might benefit from batching
        if (context.performanceGoals.includes('throughput') &&
            (node.protocol.includes('data') || node.protocol.includes('batch'))) {

          transforms.push({
            type: 'batching_optimization',
            description: 'Added batching configuration for high-throughput relationship',
            before: node,
            after: {
              ...node,
              configuration: {
                ...node.configuration,
                batching: {
                  enabled: true,
                  maxSize: 100,
                  maxDelay: 10
                }
              }
            },
            impact: 0.6
          });
        }

        return transforms;
      }
    });

    // Target-specific optimizations
    this.strategies.push({
      name: 'target_specific_optimization',
      priority: 4,
      applicable: (node) => true,
      apply: (node, context) => {
        const transforms: OptimizationTransform[] = [];

        if (context.targetPlatform === 'container') {
          // Container-specific optimizations
          if (node.type === 'role') {
            transforms.push({
              type: 'container_optimization',
              description: 'Added container-specific deployment configuration',
              before: node.deployment,
              after: {
                target: 'container',
                config: {
                  image: `${node.name}:latest`,
                  replicas: 1,
                  resources: {
                    requests: { cpu: '100m', memory: '128Mi' },
                    limits: { cpu: '500m', memory: '512Mi' }
                  }
                }
              },
              impact: 0.3
            });
          }
        } else if (context.targetPlatform === 'filesystem') {
          // Filesystem-specific optimizations
          if (node.type === 'role') {
            transforms.push({
              type: 'filesystem_optimization',
              description: 'Optimized for filesystem deployment',
              before: node.deployment,
              after: {
                target: 'filesystem',
                config: {
                  scriptPath: `/network/${node.name}`,
                  executable: true,
                  dependencies: []
                }
              },
              impact: 0.2
            });
          }
        }

        return transforms;
      }
    });
  }

  private estimateCodeSize(node: any, transforms: OptimizationTransform[]): number {
    // Simple heuristic for code size estimation
    let baseSize = 100; // Base size for any node

    if (node.type === 'role') {
      baseSize += node.capabilities.length * 10;
    } else if (node.type === 'relationship') {
      baseSize += 50;
    }

    // Apply transform impacts
    transforms.forEach(transform => {
      if (transform.type === 'dead_code_elimination') {
        baseSize *= (1 - transform.impact);
      } else if (transform.type === 'capability_optimization') {
        baseSize *= (1 - transform.impact * 0.1);
      }
    });

    return Math.round(baseSize);
  }

  private estimatePerformance(node: any, transforms: OptimizationTransform[]): number {
    // Simple heuristic for performance estimation (higher = better)
    let basePerformance = 50;

    // Apply transform impacts
    transforms.forEach(transform => {
      const improvement = transform.impact * 20; // Scale impact to performance points

      if (['batching_optimization', 'transport_optimization'].includes(transform.type)) {
        basePerformance += improvement;
      } else if (['dead_code_elimination', 'capability_optimization'].includes(transform.type)) {
        basePerformance += improvement * 0.5;
      }
    });

    return Math.min(100, Math.round(basePerformance));
  }

  private calculateImprovement(result: OptimizationResult): number {
    // Calculate overall improvement percentage
    const totalImpact = result.transforms.reduce((sum, transform) => sum + transform.impact, 0);
    return Math.min(100, Math.round(totalImpact * 100 / result.transforms.length));
  }
}

/**
 * Create a choreography optimizer gadget
 */
export function createChoreographyOptimizer(config: any = {}): ChoreographyOptimizer {
  return new ChoreographyOptimizer(config);
}