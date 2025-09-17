/**
 * Base classes and utilities for compilation gadgets
 */

import { createGadget } from '../core';
import { changed, noop } from '../effects';
import {
  CompilationEffect,
  CompilationAST,
  CompilationGadgetState,
  ASTNode,
  IncrementalUpdate,
  DependencyGraph,
  ChangeEvent
} from './types';

/**
 * Abstract base class for compilation gadgets
 */
export abstract class CompilationGadget {
  protected gadget: any;

  constructor(initialState: Partial<CompilationGadgetState>) {
    const state: CompilationGadgetState = {
      ast: createEmptyAST(),
      metrics: createEmptyMetrics(),
      cache: new Map(),
      ...initialState
    };

    this.gadget = createGadget(
      (currentState: CompilationGadgetState, effect: CompilationEffect) => {
        return this.consider(currentState, effect);
      },
      this.createActions()
    )(state);
  }

  /**
   * Consider what to do with incoming compilation effect
   */
  protected abstract consider(
    state: CompilationGadgetState,
    effect: CompilationEffect
  ): { action: string; context: any } | null;

  /**
   * Create action handlers for this compilation gadget
   */
  protected abstract createActions(): Record<string, (gadget: any, context: any) => any>;

  /**
   * Get current state
   */
  current(): CompilationGadgetState {
    return this.gadget.current();
  }

  /**
   * Update state
   */
  update(state: CompilationGadgetState): void {
    this.gadget.update(state);
  }

  /**
   * Receive compilation effect
   */
  receive(effect: CompilationEffect): void {
    this.gadget.receive(effect);
  }

  /**
   * Emit compilation effect
   */
  emit(effect: CompilationEffect): void {
    this.gadget.emit(effect);
  }

  /**
   * Helper: Check if this gadget should process a specific node
   */
  protected shouldProcess(nodeId: string, effect: CompilationEffect): boolean {
    // Default implementation - override for specific filtering logic
    return true;
  }

  /**
   * Helper: Update AST node incrementally
   */
  protected updateASTNode(
    ast: CompilationAST,
    nodeId: string,
    update: Partial<ASTNode>
  ): CompilationAST {
    const existingNode = ast.roles.get(nodeId) || ast.relationships.get(nodeId);
    if (!existingNode) {
      return ast;
    }

    const updatedNode = { ...existingNode, ...update, version: existingNode.version + 1 };

    // Update in appropriate collection
    if (updatedNode.type === 'role') {
      ast.roles.set(nodeId, updatedNode as any);
    } else if (updatedNode.type === 'relationship') {
      ast.relationships.set(nodeId, updatedNode as any);
    }

    // Record change
    ast.changeLog.push({
      type: 'node_updated',
      nodeId,
      timestamp: Date.now(),
      details: { update }
    });

    ast.version++;
    return ast;
  }

  /**
   * Helper: Add dependency between nodes
   */
  protected addDependency(
    dependencies: DependencyGraph,
    from: string,
    to: string
  ): DependencyGraph {
    dependencies.nodes.add(from);
    dependencies.nodes.add(to);

    if (!dependencies.edges.has(from)) {
      dependencies.edges.set(from, new Set());
    }
    dependencies.edges.get(from)!.add(to);

    return dependencies;
  }

  /**
   * Helper: Get all dependents of a node
   */
  protected getDependents(dependencies: DependencyGraph, nodeId: string): string[] {
    const dependents: string[] = [];

    for (const [from, tos] of dependencies.edges) {
      if (tos.has(nodeId)) {
        dependents.push(from);
      }
    }

    return dependents;
  }

  /**
   * Helper: Check if recompilation is needed for a node
   */
  protected needsRecompilation(
    nodeId: string,
    update: IncrementalUpdate,
    cache: Map<string, any>
  ): boolean {
    const cachedVersion = cache.get(`${nodeId}_version`);
    const cachedDependencies = cache.get(`${nodeId}_dependencies`) || [];

    // Need recompilation if:
    // 1. Node itself changed
    // 2. Dependencies changed
    // 3. No cached version exists
    return (
      !cachedVersion ||
      update.nodeId === nodeId ||
      update.affectedDependents.includes(nodeId) ||
      cachedDependencies.some((dep: string) => update.affectedDependents.includes(dep))
    );
  }
}

/**
 * Utility to create empty compilation AST
 */
export function createEmptyAST(): CompilationAST {
  return {
    version: 0,
    roles: new Map(),
    relationships: new Map(),
    parseState: new Map(),
    validationState: new Map(),
    typeState: new Map(),
    optimizationState: new Map(),
    changeLog: [],
    dependencies: {
      nodes: new Set(),
      edges: new Map()
    }
  };
}

/**
 * Utility to create empty compilation metrics
 */
export function createEmptyMetrics() {
  return {
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
}

/**
 * Compilation effect utilities
 */
export class CompilationEffects {
  static astUpdate(nodeId: string, update: Partial<ASTNode>): CompilationEffect {
    return { astUpdate: { nodeId, update } };
  }

  static validationResult(result: any): CompilationEffect {
    return { validationResult: result };
  }

  static typeInference(typeInfo: any): CompilationEffect {
    return { typeInference: typeInfo };
  }

  static optimization(result: any): CompilationEffect {
    return { optimization: result };
  }

  static codeGeneration(targetId: string, artifacts: any[]): CompilationEffect {
    return { codeGeneration: { targetId, artifacts } };
  }

  static materialization(requests: any[]): CompilationEffect {
    return { materialization: { requests } };
  }

  static dependencyChange(from: string, to: string, type: 'added' | 'removed'): CompilationEffect {
    return { dependencyChange: { from, to, type } };
  }

  static parseProgress(nodeId: string, progress: number, status: any): CompilationEffect {
    return { parseProgress: { nodeId, progress, status } };
  }

  static compilationError(nodeId: string, error: any): CompilationEffect {
    return { compilationError: { nodeId, error } };
  }
}

/**
 * Dependency analysis utilities
 */
export class DependencyAnalyzer {
  static analyzeDependencies(ast: CompilationAST): DependencyGraph {
    const graph: DependencyGraph = {
      nodes: new Set(),
      edges: new Map()
    };

    // Add all nodes
    ast.roles.forEach((_, id) => graph.nodes.add(id));
    ast.relationships.forEach((_, id) => graph.nodes.add(id));

    // Add relationship dependencies
    ast.relationships.forEach(rel => {
      // Relationships depend on their roles
      this.addEdge(graph, rel.id, rel.from);
      this.addEdge(graph, rel.id, rel.to);

      // Roles may depend on each other through relationships
      this.addEdge(graph, rel.from, rel.to);
    });

    return graph;
  }

  private static addEdge(graph: DependencyGraph, from: string, to: string): void {
    if (!graph.edges.has(from)) {
      graph.edges.set(from, new Set());
    }
    graph.edges.get(from)!.add(to);
  }

  static getAffectedNodes(
    graph: DependencyGraph,
    changedNodeId: string
  ): string[] {
    const affected = new Set<string>();
    const toVisit = [changedNodeId];

    while (toVisit.length > 0) {
      const current = toVisit.pop()!;
      if (affected.has(current)) continue;

      affected.add(current);

      // Find all nodes that depend on current
      for (const [from, tos] of graph.edges) {
        if (tos.has(current) && !affected.has(from)) {
          toVisit.push(from);
        }
      }
    }

    affected.delete(changedNodeId); // Remove the changed node itself
    return Array.from(affected);
  }
}

/**
 * Incremental compilation coordinator
 */
export class IncrementalCompiler {
  private compilationGadgets: Map<string, CompilationGadget> = new Map();
  private dependencyGraph: DependencyGraph = { nodes: new Set(), edges: new Map() };

  addGadget(name: string, gadget: CompilationGadget): void {
    this.compilationGadgets.set(name, gadget);
  }

  removeGadget(name: string): void {
    this.compilationGadgets.delete(name);
  }

  propagateEffect(effect: CompilationEffect): void {
    // Send effect to all compilation gadgets
    // Each gadget will decide if it should process the effect
    this.compilationGadgets.forEach(gadget => {
      gadget.receive(effect);
    });

    // Update dependency graph if needed
    if ('dependencyChange' in effect) {
      this.updateDependencyGraph(effect.dependencyChange);
    }
  }

  private updateDependencyGraph(change: { from: string; to: string; type: 'added' | 'removed' }): void {
    const { from, to, type } = change;

    if (type === 'added') {
      this.dependencyGraph.nodes.add(from);
      this.dependencyGraph.nodes.add(to);

      if (!this.dependencyGraph.edges.has(from)) {
        this.dependencyGraph.edges.set(from, new Set());
      }
      this.dependencyGraph.edges.get(from)!.add(to);
    } else if (type === 'removed') {
      this.dependencyGraph.edges.get(from)?.delete(to);
    }
  }

  getCompilationStatus(): Record<string, any> {
    const status: Record<string, any> = {};

    this.compilationGadgets.forEach((gadget, name) => {
      const state = gadget.current();
      status[name] = {
        metrics: state.metrics,
        cacheSize: state.cache.size,
        astVersion: state.ast.version
      };
    });

    return status;
  }
}