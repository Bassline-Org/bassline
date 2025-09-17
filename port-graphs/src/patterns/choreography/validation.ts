import { Role, Relationship } from "./roles";

/**
 * Choreography validation
 *
 * Ensures choreography specifications are valid before instantiation
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate a complete choreography specification
 */
export function validateChoreography(
  roles: Role[],
  relationships: Relationship[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for roles
  if (roles.length === 0) {
    errors.push("No roles defined");
  }

  if (roles.length === 1) {
    warnings.push("Only one role defined - choreography may be trivial");
  }

  // Check for duplicate role names
  const roleNames = roles.map(r => r.name);
  const uniqueNames = new Set(roleNames);
  if (uniqueNames.size !== roleNames.length) {
    errors.push("Duplicate role names found");
  }

  // Validate relationships
  for (const rel of relationships) {
    // Check endpoints exist
    if (!roleNames.includes(rel.from)) {
      errors.push(`Relationship references unknown role: ${rel.from}`);
    }
    if (!roleNames.includes(rel.to)) {
      errors.push(`Relationship references unknown role: ${rel.to}`);
    }

    // Check for self-loops
    if (rel.from === rel.to) {
      warnings.push(`Self-loop detected: ${rel.from} → ${rel.from}`);
    }
  }

  // Check for isolated roles
  const connectedRoles = new Set<string>();
  relationships.forEach(rel => {
    connectedRoles.add(rel.from);
    connectedRoles.add(rel.to);
  });

  for (const role of roles) {
    if (!connectedRoles.has(role.name)) {
      warnings.push(`Role '${role.name}' has no relationships`);
    }
  }

  // Check for cycles (simple detection)
  const hasCycle = detectCycles(relationships);
  if (hasCycle) {
    warnings.push("Cycle detected in relationships - may cause infinite loops");
  }

  // Validate cardinality
  for (const role of roles) {
    if (role.cardinality === 'many') {
      // Check if relationships can handle multiple instances
      const hasProblematicRelationships = relationships.some(
        rel => rel.from === role.name && rel.type === 'responds'
      );
      if (hasProblematicRelationships) {
        warnings.push(
          `Role '${role.name}' has cardinality 'many' but uses 'responds' relationship`
        );
      }
    }
  }

  // Check capability requirements
  validateCapabilities(roles, relationships, errors);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Detect cycles in relationship graph
 */
function detectCycles(relationships: Relationship[]): boolean {
  const graph: Record<string, Set<string>> = {};

  // Build adjacency list
  for (const rel of relationships) {
    if (!graph[rel.from]) graph[rel.from] = new Set();
    graph[rel.from].add(rel.to);
  }

  // DFS to detect cycles
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycleDFS(node: string): boolean {
    visited.add(node);
    recursionStack.add(node);

    const neighbors = graph[node];
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycleDFS(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }
    }

    recursionStack.delete(node);
    return false;
  }

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) {
      if (hasCycleDFS(node)) return true;
    }
  }

  return false;
}

/**
 * Validate capability requirements
 */
function validateCapabilities(
  roles: Role[],
  relationships: Relationship[],
  errors: string[]
) {
  // Map role to capabilities
  const roleCapabilities: Record<string, Set<string>> = {};
  for (const role of roles) {
    roleCapabilities[role.name] = new Set(role.capabilities || []);
  }

  // Check relationship requirements
  for (const rel of relationships) {
    // Certain relationship types require capabilities
    if (rel.type === 'coordinates') {
      const fromCaps = roleCapabilities[rel.from];
      if (!fromCaps || !fromCaps.has('coordinate')) {
        errors.push(
          `Role '${rel.from}' needs 'coordinate' capability for coordination relationship`
        );
      }
    }

    if (rel.type === 'responds') {
      const toCaps = roleCapabilities[rel.to];
      if (!toCaps || !toCaps.has('respond')) {
        errors.push(
          `Role '${rel.to}' needs 'respond' capability for response relationship`
        );
      }
    }
  }
}

/**
 * Validate that a role can be added to running choreography
 */
export function validateRoleAddition(
  existingRoles: Role[],
  newRole: Role,
  relationships: Relationship[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check name uniqueness
  if (existingRoles.some(r => r.name === newRole.name)) {
    errors.push(`Role name '${newRole.name}' already exists`);
  }

  // Check that relationships are valid
  const existingNames = existingRoles.map(r => r.name);
  for (const rel of relationships) {
    if (rel.from === newRole.name && !existingNames.includes(rel.to)) {
      errors.push(`New role references unknown role: ${rel.to}`);
    }
    if (rel.to === newRole.name && !existingNames.includes(rel.from)) {
      errors.push(`New role referenced by unknown role: ${rel.from}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}