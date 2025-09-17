/**
 * Semantic Validator Gadget (Functional Implementation)
 *
 * Continuously validates AST nodes as they become available, checking for
 * semantic correctness, dependency consistency, and choreography validity
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import {
  CompilationEffect,
  CompilationGadgetState,
  ValidationResult,
  ValidationError,
  Warning,
  RoleNode,
  RelationshipNode
} from '../types';
import { createEmptyAST, createEmptyMetrics, CompilationEffects } from '../base';

interface ValidatorState extends CompilationGadgetState {
  validatedNodes: Set<string>;
}

// Helper functions for validation
function validateNode(nodeId: string, update: any, state: ValidatorState): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: Warning[] = [];
  const dependencies: string[] = [];

  try {
    if (update.type === 'role') {
      const roleValidation = validateRole(update as RoleNode, state);
      errors.push(...roleValidation.errors);
      warnings.push(...roleValidation.warnings);
      dependencies.push(...roleValidation.dependencies);
    } else if (update.type === 'relationship') {
      const relValidation = validateRelationship(update as RelationshipNode, state);
      errors.push(...relValidation.errors);
      warnings.push(...relValidation.warnings);
      dependencies.push(...relValidation.dependencies);
    }

    return {
      nodeId,
      valid: errors.length === 0,
      errors,
      warnings,
      dependencies,
      timestamp: Date.now()
    };

  } catch (error) {
    errors.push({
      code: 'VALIDATION_EXCEPTION',
      message: error instanceof Error ? error.message : 'Unknown validation error',
      severity: 'error',
      location: update.sourceLocation
    });

    return {
      nodeId,
      valid: false,
      errors,
      warnings: [],
      dependencies: [],
      timestamp: Date.now()
    };
  }
}

function validateRole(role: RoleNode, state: ValidatorState): {
  errors: ValidationError[];
  warnings: Warning[];
  dependencies: string[];
} {
  const errors: ValidationError[] = [];
  const warnings: Warning[] = [];
  const dependencies: string[] = [];

  // Validate role type
  const validRoleTypes = ['coordinator', 'worker', 'validator', 'observer'];
  if (!validRoleTypes.includes(role.roleType)) {
    errors.push({
      code: 'INVALID_ROLE_TYPE',
      message: `Invalid role type '${role.roleType}'. Must be one of: ${validRoleTypes.join(', ')}`,
      severity: 'error',
      location: role.sourceLocation
    });
  }

  // Validate capabilities
  if (!role.capabilities || role.capabilities.length === 0) {
    warnings.push({
      code: 'NO_CAPABILITIES',
      message: `Role '${role.name}' has no capabilities defined`,
      severity: 'warning',
      location: role.sourceLocation
    });
  }

  // Check for capability naming conventions
  role.capabilities.forEach(cap => {
    if (!cap.match(/^[a-z_][a-z0-9_]*$/)) {
      warnings.push({
        code: 'CAPABILITY_NAMING',
        message: `Capability '${cap}' should use snake_case naming`,
        severity: 'warning',
        location: role.sourceLocation
      });
    }
  });

  // Validate deployment configuration if present
  if (role.deployment) {
    if (role.deployment.target && !['filesystem', 'container', 'cloud'].includes(role.deployment.target)) {
      errors.push({
        code: 'INVALID_DEPLOYMENT_TARGET',
        message: `Invalid deployment target '${role.deployment.target}'`,
        severity: 'error',
        location: role.sourceLocation
      });
    }
  }

  return { errors, warnings, dependencies };
}

function validateRelationship(rel: RelationshipNode, state: ValidatorState): {
  errors: ValidationError[];
  warnings: Warning[];
  dependencies: string[];
} {
  const errors: ValidationError[] = [];
  const warnings: Warning[] = [];
  const dependencies = [rel.from, rel.to];

  // Check if roles exist
  if (!state.ast.roles.has(rel.from)) {
    errors.push({
      code: 'MISSING_ROLE',
      message: `Role '${rel.from}' referenced in relationship but not defined`,
      severity: 'error',
      location: rel.sourceLocation
    });
  }

  if (!state.ast.roles.has(rel.to)) {
    errors.push({
      code: 'MISSING_ROLE',
      message: `Role '${rel.to}' referenced in relationship but not defined`,
      severity: 'error',
      location: rel.sourceLocation
    });
  }

  // Check for self-relationships
  if (rel.from === rel.to) {
    warnings.push({
      code: 'SELF_RELATIONSHIP',
      message: `Role '${rel.from}' has relationship with itself`,
      severity: 'warning',
      location: rel.sourceLocation
    });
  }

  // Validate protocol
  if (!rel.protocol || rel.protocol.trim() === '') {
    warnings.push({
      code: 'MISSING_PROTOCOL',
      message: 'Relationship has no protocol specified',
      severity: 'warning',
      location: rel.sourceLocation
    });
  }

  // Check for duplicate relationships
  const existingRels = Array.from(state.ast.relationships.values());
  const duplicates = existingRels.filter(existing =>
    existing.id !== rel.id &&
    existing.from === rel.from &&
    existing.to === rel.to &&
    existing.protocol === rel.protocol
  );

  if (duplicates.length > 0) {
    warnings.push({
      code: 'DUPLICATE_RELATIONSHIP',
      message: `Duplicate relationship between '${rel.from}' and '${rel.to}' with protocol '${rel.protocol}'`,
      severity: 'warning',
      location: rel.sourceLocation
    });
  }

  return { errors, warnings, dependencies };
}

/**
 * Create a semantic validator gadget using createGadget
 */
export function createSemanticValidator() {
  const initialState: ValidatorState = {
    ast: createEmptyAST(),
    metrics: createEmptyMetrics(),
    cache: new Map(),
    validatedNodes: new Set()
  };

  return createGadget<ValidatorState, CompilationEffect>(
    (state, incoming) => {
      // Handle AST updates for validation
      if ('astUpdate' in incoming && incoming.astUpdate.update.status === 'parsed') {
        return { action: 'validate', context: incoming.astUpdate };
      }

      // Handle dependency changes that might require revalidation
      if ('dependencyChange' in incoming) {
        return { action: 'revalidate_dependencies', context: incoming.dependencyChange };
      }

      return null;
    },
    {
      'validate': (gadget: any, { nodeId, update }: { nodeId: string; update: any }) => {
        const state = gadget.current() as ValidatorState;

        try {
          const validationResult = validateNode(nodeId, update, state);

          // Update validation state in AST
          const newAST = { ...state.ast };
          newAST.validationState.set(nodeId, validationResult);

          // Update the node in AST if it's not already there
          if (update.type === 'role' && !newAST.roles.has(nodeId)) {
            newAST.roles.set(nodeId, update);
          } else if (update.type === 'relationship' && !newAST.relationships.has(nodeId)) {
            newAST.relationships.set(nodeId, update);
          }

          // Update node status based on validation
          const nodeStatus = validationResult.valid ? 'valid' : 'invalid';
          if (update.type === 'role') {
            const role = newAST.roles.get(nodeId);
            if (role) {
              newAST.roles.set(nodeId, { ...role, status: nodeStatus });
            }
          } else if (update.type === 'relationship') {
            const rel = newAST.relationships.get(nodeId);
            if (rel) {
              newAST.relationships.set(nodeId, { ...rel, status: nodeStatus });
            }
          }

          newAST.version++;

          // Update metrics
          const newMetrics = { ...state.metrics };
          newMetrics.totalNodes = Math.max(newMetrics.totalNodes, newAST.roles.size + newAST.relationships.size);

          if (validationResult.valid) {
            if (!state.validatedNodes.has(nodeId)) {
              newMetrics.validNodes++;
            }
          } else {
            newMetrics.errors += validationResult.errors.length;
            newMetrics.warnings += validationResult.warnings.length;
          }

          // Update state
          const newValidatedNodes = new Set(state.validatedNodes);
          if (validationResult.valid) {
            newValidatedNodes.add(nodeId);
          }

          const newState = {
            ...state,
            ast: newAST,
            metrics: newMetrics,
            validatedNodes: newValidatedNodes
          };

          gadget.update(newState);

          // Emit validation result
          gadget.emit(CompilationEffects.validationResult(validationResult));

          // If validation found new dependencies, emit dependency changes
          validationResult.dependencies.forEach(dep => {
            if (!state.ast.dependencies.edges.get(nodeId)?.has(dep)) {
              gadget.emit(CompilationEffects.dependencyChange(nodeId, dep, 'added'));
            }
          });

          return changed({
            validated: true,
            nodeId,
            valid: validationResult.valid,
            errors: validationResult.errors.length,
            warnings: validationResult.warnings.length
          });

        } catch (error) {
          gadget.emit(CompilationEffects.compilationError(nodeId, {
            code: 'VALIDATION_ERROR',
            message: error instanceof Error ? error.message : 'Unknown validation error',
            severity: 'error'
          }));

          return changed({
            validated: false,
            nodeId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      },

      'revalidate_dependencies': (gadget: any, { from, to, type }: { from: string; to: string; type: string }) => {
        const state = gadget.current() as ValidatorState;

        // Find all nodes that might be affected by this dependency change
        const affectedNodes = new Set<string>();

        // The node that had its dependencies changed
        affectedNodes.add(from);

        // Any nodes that depend on the changed dependency
        for (const [nodeId, deps] of state.ast.dependencies.edges) {
          if (deps.has(from) || deps.has(to)) {
            affectedNodes.add(nodeId);
          }
        }

        // Revalidate affected nodes
        let revalidatedCount = 0;
        for (const nodeId of affectedNodes) {
          const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
          if (node) {
            // Trigger revalidation by calling validate action
            gadget.receive(CompilationEffects.astUpdate(nodeId, node));
            revalidatedCount++;
          }
        }

        return changed({
          dependencyRevalidation: true,
          affectedNodes: Array.from(affectedNodes),
          revalidatedCount
        });
      }
    }
  )(initialState);
}