/**
 * Choreography Optimizer Gadget (Functional Implementation)
 *
 * Continuously optimizes validated AST nodes for better performance,
 * reduced resource usage, and improved deployment characteristics
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import {
  CompilationEffect,
  CompilationGadgetState,
  RoleNode,
  RelationshipNode,
  OptimizationResult,
  OptimizationStrategy
} from '../types';
import { createEmptyAST, createEmptyMetrics, CompilationEffects } from '../base';

interface OptimizerConfig {
  level: 'none' | 'basic' | 'aggressive';
  strategies: OptimizationStrategy[];
}

interface OptimizerState extends CompilationGadgetState {
  config: OptimizerConfig;
  optimizedNodes: Set<string>;
}

// Helper functions for optimization
function optimizeNode(nodeId: string, update: any, state: OptimizerState): OptimizationResult {
  const optimizations: string[] = [];
  const timeSaved = 0;
  const resourcesReduced = 0;

  try {
    if (update.type === 'role') {
      const roleOptimizations = optimizeRole(update as RoleNode, state);
      optimizations.push(...roleOptimizations.optimizations);
    } else if (update.type === 'relationship') {
      const relOptimizations = optimizeRelationship(update as RelationshipNode, state);
      optimizations.push(...relOptimizations.optimizations);
    }

    return {
      nodeId,
      originalNode: update,
      optimizedNode: applyOptimizations(update, optimizations),
      optimizations,
      strategy: state.config.level,
      timeSaved,
      resourcesReduced,
      timestamp: Date.now()
    };

  } catch (error) {
    return {
      nodeId,
      originalNode: update,
      optimizedNode: update, // Return original on error
      optimizations: [],
      strategy: state.config.level,
      timeSaved: 0,
      resourcesReduced: 0,
      timestamp: Date.now(),
      error: error instanceof Error ? error.message : 'Unknown optimization error'
    };
  }
}

function optimizeRole(role: RoleNode, state: OptimizerState): { optimizations: string[] } {
  const optimizations: string[] = [];

  if (state.config.level === 'none') {
    return { optimizations };
  }

  // Basic optimizations
  if (state.config.level === 'basic' || state.config.level === 'aggressive') {
    // Remove duplicate capabilities
    if (role.capabilities && role.capabilities.length > new Set(role.capabilities).size) {
      optimizations.push('remove_duplicate_capabilities');
    }

    // Suggest deployment optimizations
    if (!role.deployment) {
      // Suggest deployment based on role type
      if (role.roleType === 'coordinator') {
        optimizations.push('suggest_container_deployment');
      } else if (role.roleType === 'observer') {
        optimizations.push('suggest_filesystem_deployment');
      }
    }
  }

  // Aggressive optimizations
  if (state.config.level === 'aggressive') {
    // Capability consolidation
    if (role.capabilities && role.capabilities.length > 5) {
      optimizations.push('consolidate_capabilities');
    }

    // Resource optimization
    if (role.deployment?.config?.resources) {
      optimizations.push('optimize_resources');
    }
  }

  return { optimizations };
}

function optimizeRelationship(rel: RelationshipNode, state: OptimizerState): { optimizations: string[] } {
  const optimizations: string[] = [];

  if (state.config.level === 'none') {
    return { optimizations };
  }

  // Basic optimizations
  if (state.config.level === 'basic' || state.config.level === 'aggressive') {
    // Transport optimization
    if (!rel.transport) {
      optimizations.push('suggest_transport');
    }

    // Protocol optimization
    if (rel.protocol === 'default') {
      optimizations.push('optimize_protocol');
    }
  }

  // Aggressive optimizations
  if (state.config.level === 'aggressive') {
    // Check for relationship batching opportunities
    const similarRels = Array.from(state.ast.relationships.values())
      .filter(r => r.from === rel.from && r.to === rel.to && r.id !== rel.id);

    if (similarRels.length > 0) {
      optimizations.push('batch_relationships');
    }

    // Connection pooling
    optimizations.push('enable_connection_pooling');
  }

  return { optimizations };
}

function applyOptimizations(node: any, optimizations: string[]): any {
  let optimizedNode = { ...node };

  optimizations.forEach(optimization => {
    switch (optimization) {
      case 'remove_duplicate_capabilities':
        if (optimizedNode.capabilities) {
          optimizedNode.capabilities = Array.from(new Set(optimizedNode.capabilities));
        }
        break;

      case 'suggest_container_deployment':
        if (!optimizedNode.deployment) {
          optimizedNode.deployment = {
            target: 'container',
            config: {
              replicas: 1,
              resources: { cpu: '100m', memory: '128Mi' }
            }
          };
        }
        break;

      case 'suggest_filesystem_deployment':
        if (!optimizedNode.deployment) {
          optimizedNode.deployment = {
            target: 'filesystem',
            config: { isolation: true }
          };
        }
        break;

      case 'consolidate_capabilities':
        if (optimizedNode.capabilities && optimizedNode.capabilities.length > 5) {
          // Group related capabilities
          optimizedNode.capabilities = optimizedNode.capabilities.slice(0, 5);
          optimizedNode.capabilities.push('extended_capabilities');
        }
        break;

      case 'suggest_transport':
        if (!optimizedNode.transport) {
          optimizedNode.transport = 'http';
        }
        break;

      case 'optimize_protocol':
        if (optimizedNode.protocol === 'default') {
          optimizedNode.protocol = 'json-rpc';
        }
        break;

      case 'enable_connection_pooling':
        optimizedNode.connectionPool = { maxConnections: 10, timeout: 5000 };
        break;

      default:
        // Unknown optimization, skip
        break;
    }
  });

  // Mark as optimized
  optimizedNode.status = 'optimized';
  optimizedNode.version = (optimizedNode.version || 0) + 1;

  return optimizedNode;
}

/**
 * Create a choreography optimizer gadget using createGadget
 */
export function createChoreographyOptimizer(config: { level?: 'none' | 'basic' | 'aggressive' } = {}) {
  const optimizerConfig: OptimizerConfig = {
    level: config.level || 'basic',
    strategies: [] // Could be expanded with custom strategies
  };

  const initialState: OptimizerState = {
    ast: createEmptyAST(),
    metrics: createEmptyMetrics(),
    cache: new Map(),
    config: optimizerConfig,
    optimizedNodes: new Set()
  };

  return createGadget<OptimizerState, CompilationEffect>(
    (state, incoming) => {
      // Handle validation results for optimization
      if ('validationResult' in incoming && incoming.validationResult.valid) {
        return { action: 'optimize', context: incoming.validationResult };
      }

      // Handle AST updates that are valid
      if ('astUpdate' in incoming && incoming.astUpdate.update.status === 'valid') {
        return { action: 'optimize_node', context: incoming.astUpdate };
      }

      // Handle optimization configuration changes
      if ('optimizationConfig' in incoming) {
        return { action: 'update_config', context: incoming.optimizationConfig };
      }

      return null;
    },
    {
      'optimize': (gadget: any, validationResult: any) => {
        const state = gadget.current() as OptimizerState;
        const { nodeId } = validationResult;

        // Get the node from AST
        const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
        if (!node) {
          return noop();
        }

        // Perform optimization
        const optimizationResult = optimizeNode(nodeId, node, state);

        // Update AST with optimized node
        const newAST = { ...state.ast };
        if (optimizationResult.optimizedNode.type === 'role') {
          newAST.roles.set(nodeId, optimizationResult.optimizedNode);
        } else if (optimizationResult.optimizedNode.type === 'relationship') {
          newAST.relationships.set(nodeId, optimizationResult.optimizedNode);
        }

        newAST.optimizationState.set(nodeId, optimizationResult);
        newAST.version++;

        // Update metrics
        const newMetrics = { ...state.metrics };
        if (!state.optimizedNodes.has(nodeId)) {
          newMetrics.optimizedNodes++;
        }

        // Update state
        const newOptimizedNodes = new Set(state.optimizedNodes);
        newOptimizedNodes.add(nodeId);

        const newState = {
          ...state,
          ast: newAST,
          metrics: newMetrics,
          optimizedNodes: newOptimizedNodes
        };

        gadget.update(newState);

        // Emit optimization result
        gadget.emit(CompilationEffects.optimization({
          nodeId,
          optimizations: optimizationResult.optimizations,
          timeSaved: optimizationResult.timeSaved,
          resourcesReduced: optimizationResult.resourcesReduced,
          strategy: optimizationResult.strategy
        }));

        return changed({
          optimized: true,
          nodeId,
          optimizations: optimizationResult.optimizations.length,
          strategy: optimizationResult.strategy
        });
      },

      'optimize_node': (gadget: any, { nodeId, update }: { nodeId: string; update: any }) => {
        // Same as optimize action but triggered by AST updates
        return gadget.receive(CompilationEffects.validationResult({
          nodeId,
          valid: true,
          errors: [],
          warnings: [],
          dependencies: [],
          timestamp: Date.now()
        }));
      },

      'update_config': (gadget: any, newConfig: Partial<OptimizerConfig>) => {
        const state = gadget.current() as OptimizerState;

        const updatedConfig = {
          ...state.config,
          ...newConfig
        };

        const newState = {
          ...state,
          config: updatedConfig
        };

        gadget.update(newState);

        // Re-optimize all nodes with new configuration
        const nodesToReoptimize = Array.from(state.optimizedNodes);
        nodesToReoptimize.forEach(nodeId => {
          const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
          if (node) {
            gadget.receive(CompilationEffects.astUpdate(nodeId, node));
          }
        });

        return changed({
          configUpdated: true,
          newLevel: updatedConfig.level,
          reoptimizedNodes: nodesToReoptimize.length
        });
      }
    }
  )(initialState);
}