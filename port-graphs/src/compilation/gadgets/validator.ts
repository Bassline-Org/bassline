/**
 * Semantic Validator Gadget
 *
 * Continuously validates AST nodes as they become available, checking for
 * semantic correctness, dependency consistency, and choreography validity
 */

import { CompilationGadget, CompilationEffects, DependencyAnalyzer } from '../base';
import {
  CompilationEffect,
  CompilationGadgetState,
  ValidationResult,
  ValidationError,
  Warning,
  RoleNode,
  RelationshipNode
} from '../types';
import { changed, noop } from '../../effects';

export class SemanticValidator extends CompilationGadget {
  protected consider(
    state: CompilationGadgetState,
    effect: CompilationEffect
  ): { action: string; context: any } | null {
    if ('astUpdate' in effect && effect.astUpdate.update.status === 'parsed') {
      return { action: 'validate', context: effect.astUpdate };
    }

    if ('dependencyChange' in effect) {
      return { action: 'revalidate_dependencies', context: effect.dependencyChange };
    }

    return null;
  }

  protected createActions() {
    return {
      'validate': (gadget: any, { nodeId, update }: { nodeId: string; update: any }) => {
        const state = gadget.current() as CompilationGadgetState;

        try {
          const validationResult = this.validateNode(nodeId, update, state);

          // Update validation state
          const newAST = { ...state.ast };
          newAST.validationState.set(nodeId, validationResult);

          // Update node status based on validation
          const nodeStatus = validationResult.valid ? 'valid' : 'invalid';
          this.updateASTNode(newAST, nodeId, { status: nodeStatus });

          // Update metrics
          const newMetrics = { ...state.metrics };
          if (validationResult.valid) {
            newMetrics.validNodes++;
          } else {
            newMetrics.errors += validationResult.errors.length;
            newMetrics.warnings += validationResult.warnings.length;
          }

          gadget.update({
            ...state,
            ast: newAST,
            metrics: newMetrics
          });

          // Emit validation result
          gadget.emit(CompilationEffects.validationResult(validationResult));

          // If validation found new dependencies, emit dependency changes
          const existingDeps = state.ast.dependencies;
          validationResult.dependencies.forEach(dep => {
            if (!existingDeps.edges.get(nodeId)?.has(dep)) {
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

          return changed({ validated: false, nodeId, error: error.message });
        }
      },

      'revalidate_dependencies': (gadget: any, { from, to, type }: { from: string; to: string; type: string }) => {
        const state = gadget.current() as CompilationGadgetState;

        // Find all nodes that might be affected by this dependency change
        const affectedNodes = DependencyAnalyzer.getAffectedNodes(state.ast.dependencies, from);

        // Re-validate all affected nodes
        affectedNodes.forEach(nodeId => {
          const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
          if (node) {
            const validationResult = this.validateNode(nodeId, node, state);
            gadget.emit(CompilationEffects.validationResult(validationResult));
          }
        });

        return changed({ revalidated: affectedNodes.length, trigger: from });
      }
    };
  }

  private validateNode(
    nodeId: string,
    node: any,
    state: CompilationGadgetState
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: Warning[] = [];
    const dependencies: string[] = [];

    if (node.type === 'role') {
      this.validateRole(node as RoleNode, state, errors, warnings, dependencies);
    } else if (node.type === 'relationship') {
      this.validateRelationship(node as RelationshipNode, state, errors, warnings, dependencies);
    }

    return {
      nodeId,
      valid: errors.length === 0,
      errors,
      warnings,
      dependencies
    };
  }

  private validateRole(
    role: RoleNode,
    state: CompilationGadgetState,
    errors: ValidationError[],
    warnings: Warning[],
    dependencies: string[]
  ): void {
    // Validate role name
    if (!role.name || role.name.trim() === '') {
      errors.push({
        code: 'EMPTY_ROLE_NAME',
        message: 'Role name cannot be empty',
        location: role.sourceLocation
      });
    }

    // Validate role name uniqueness
    const existingRoles = Array.from(state.ast.roles.values());
    const duplicates = existingRoles.filter(r => r.id !== role.id && r.name === role.name);
    if (duplicates.length > 0) {
      errors.push({
        code: 'DUPLICATE_ROLE_NAME',
        message: `Role name '${role.name}' is already used`,
        location: role.sourceLocation,
        suggestions: [`${role.name}_1`, `${role.name}_alt`]
      });
    }

    // Validate role type
    const validRoleTypes = ['worker', 'coordinator', 'mediator', 'observer'];
    if (!validRoleTypes.includes(role.roleType)) {
      warnings.push({
        code: 'UNKNOWN_ROLE_TYPE',
        message: `Unknown role type '${role.roleType}'. Known types: ${validRoleTypes.join(', ')}`,
        location: role.sourceLocation
      });
    }

    // Validate capabilities
    if (role.capabilities.length === 0) {
      warnings.push({
        code: 'NO_CAPABILITIES',
        message: 'Role has no defined capabilities',
        location: role.sourceLocation
      });
    }

    // Check for unused capabilities
    const usedCapabilities = this.getUsedCapabilities(role.name, state);
    const unusedCapabilities = role.capabilities.filter(cap => !usedCapabilities.has(cap));
    if (unusedCapabilities.length > 0) {
      warnings.push({
        code: 'UNUSED_CAPABILITIES',
        message: `Capabilities not used in any relationships: ${unusedCapabilities.join(', ')}`,
        location: role.sourceLocation
      });
    }

    // Validate deployment configuration
    if (role.deployment) {
      this.validateDeployment(role.deployment, errors, warnings);
    }
  }

  private validateRelationship(
    relationship: RelationshipNode,
    state: CompilationGadgetState,
    errors: ValidationError[],
    warnings: Warning[],
    dependencies: string[]
  ): void {
    // Validate that source and target roles exist
    if (!state.ast.roles.has(relationship.from)) {
      errors.push({
        code: 'UNDEFINED_ROLE',
        message: `Source role '${relationship.from}' is not defined`,
        location: relationship.sourceLocation,
        suggestions: Array.from(state.ast.roles.keys())
      });
    } else {
      dependencies.push(relationship.from);
    }

    if (!state.ast.roles.has(relationship.to)) {
      errors.push({
        code: 'UNDEFINED_ROLE',
        message: `Target role '${relationship.to}' is not defined`,
        location: relationship.sourceLocation,
        suggestions: Array.from(state.ast.roles.keys())
      });
    } else {
      dependencies.push(relationship.to);
    }

    // Validate protocol
    if (!relationship.protocol || relationship.protocol.trim() === '') {
      errors.push({
        code: 'EMPTY_PROTOCOL',
        message: 'Relationship protocol cannot be empty',
        location: relationship.sourceLocation
      });
    }

    // Check for self-relationships
    if (relationship.from === relationship.to) {
      warnings.push({
        code: 'SELF_RELATIONSHIP',
        message: 'Role has relationship with itself',
        location: relationship.sourceLocation
      });
    }

    // Check for duplicate relationships
    const existingRelationships = Array.from(state.ast.relationships.values());
    const duplicates = existingRelationships.filter(r =>
      r.id !== relationship.id &&
      r.from === relationship.from &&
      r.to === relationship.to &&
      r.protocol === relationship.protocol
    );

    if (duplicates.length > 0) {
      warnings.push({
        code: 'DUPLICATE_RELATIONSHIP',
        message: `Duplicate relationship between '${relationship.from}' and '${relationship.to}' with protocol '${relationship.protocol}'`,
        location: relationship.sourceLocation
      });
    }

    // Validate that roles have required capabilities for this relationship
    this.validateRoleCapabilities(relationship, state, errors, warnings);
  }

  private validateRoleCapabilities(
    relationship: RelationshipNode,
    state: CompilationGadgetState,
    errors: ValidationError[],
    warnings: Warning[]
  ): void {
    const fromRole = state.ast.roles.get(relationship.from);
    const toRole = state.ast.roles.get(relationship.to);

    if (!fromRole || !toRole) return;

    // Check if source role can send this protocol
    const sendCapability = `send_${relationship.protocol}`;
    if (!fromRole.capabilities.includes(sendCapability) && !fromRole.capabilities.includes('*')) {
      warnings.push({
        code: 'MISSING_SEND_CAPABILITY',
        message: `Role '${relationship.from}' lacks capability '${sendCapability}' for relationship`,
        location: relationship.sourceLocation
      });
    }

    // Check if target role can receive this protocol
    const receiveCapability = `receive_${relationship.protocol}`;
    if (!toRole.capabilities.includes(receiveCapability) && !toRole.capabilities.includes('*')) {
      warnings.push({
        code: 'MISSING_RECEIVE_CAPABILITY',
        message: `Role '${relationship.to}' lacks capability '${receiveCapability}' for relationship`,
        location: relationship.sourceLocation
      });
    }
  }

  private getUsedCapabilities(roleName: string, state: CompilationGadgetState): Set<string> {
    const used = new Set<string>();

    state.ast.relationships.forEach(rel => {
      if (rel.from === roleName) {
        used.add(`send_${rel.protocol}`);
      }
      if (rel.to === roleName) {
        used.add(`receive_${rel.protocol}`);
      }
    });

    return used;
  }

  private validateDeployment(
    deployment: any,
    errors: ValidationError[],
    warnings: Warning[]
  ): void {
    if (!deployment.target) {
      errors.push({
        code: 'MISSING_DEPLOYMENT_TARGET',
        message: 'Deployment target is required'
      });
    }

    const validTargets = ['filesystem', 'container', 'cloud', 'embedded'];
    if (!validTargets.includes(deployment.target)) {
      warnings.push({
        code: 'UNKNOWN_DEPLOYMENT_TARGET',
        message: `Unknown deployment target '${deployment.target}'. Known targets: ${validTargets.join(', ')}`
      });
    }
  }
}

/**
 * Create a semantic validator gadget
 */
export function createSemanticValidator(): SemanticValidator {
  return new SemanticValidator({});
}