/**
 * Choreography Parser Gadget (Functional Implementation)
 *
 * Continuously parses choreography specifications, emitting incremental AST updates
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import {
  CompilationEffect,
  CompilationGadgetState,
  ChoreographySpec,
  RoleNode,
  RelationshipNode,
  ParseError,
  SourceLocation
} from '../types';
import { createEmptyAST, createEmptyMetrics, CompilationEffects } from '../base';

interface ParserInput {
  source: string;
  path?: string;
  format?: 'yaml' | 'json';
}

interface ParserState extends CompilationGadgetState {
  lastSource?: string;
}

// Helper functions for parsing
function parseChoreographySpec(source: string, format: 'yaml' | 'json'): ChoreographySpec {
  if (format === 'json') {
    return JSON.parse(source);
  } else {
    return parseYAMLLike(source);
  }
}

function parseYAMLLike(source: string): ChoreographySpec {
  // Very basic YAML-like parser for demo
  const lines = source.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));

  const spec: ChoreographySpec = {
    name: 'parsed-choreography',
    version: '1.0.0',
    roles: {},
    relationships: []
  };

  let currentSection = '';
  let currentRole = '';

  for (const line of lines) {
    // Check for top-level sections (name:, roles:, relationships:)
    if (line.match(/^(name|version|roles|relationships):/) && line.endsWith(':')) {
      currentSection = line.split(':')[0];
      if (currentSection === 'name') {
        // Handle name: value on same line
        const parts = line.split(':');
        if (parts.length > 1) {
          spec.name = parts[1].trim();
        }
      } else if (currentSection === 'version') {
        // Handle version: value on same line
        const parts = line.split(':');
        if (parts.length > 1) {
          spec.version = parts[1].trim();
        }
      }
      continue;
    }

    if (currentSection === 'roles') {
      // Look for role names (lines ending with : that aren't properties)
      if (line.endsWith(':') && !line.includes(' ') && !line.match(/^(type|capabilities|deployment):/)) {
        currentRole = line.slice(0, -1);
        spec.roles[currentRole] = { type: 'worker' };
      } else if (line.startsWith('type:') && currentRole) {
        spec.roles[currentRole].type = line.split(':')[1].trim();
      } else if (line.startsWith('capabilities:') && currentRole) {
        const caps = line.split(':')[1].trim();
        // Handle both array notation and simple list
        if (caps.startsWith('[') && caps.endsWith(']')) {
          spec.roles[currentRole].capabilities = caps.slice(1, -1).split(',').map(c => c.trim());
        } else {
          spec.roles[currentRole].capabilities = caps.split(',').map(c => c.trim());
        }
      }
    } else if (currentSection === 'relationships') {
      if (line.includes('->')) {
        const [from, rest] = line.split('->').map(s => s.trim());
        const [to, protocol] = rest.split(':').map(s => s.trim());
        spec.relationships.push({
          from,
          to,
          type: 'sends',
          protocol: protocol || 'default'
        });
      }
    }
  }

  return spec;
}

function convertToAST(
  spec: ChoreographySpec,
  sourcePath?: string
): { roles: RoleNode[]; relationships: RelationshipNode[] } {
  const roles: RoleNode[] = [];
  const relationships: RelationshipNode[] = [];

  // Convert roles
  Object.entries(spec.roles).forEach(([name, roleSpec], index) => {
    const role: RoleNode = {
      id: name,
      type: 'role',
      version: 1,
      status: 'parsed',
      dependencies: [],
      dependents: [],
      name,
      roleType: roleSpec.type,
      capabilities: roleSpec.capabilities || [],
      deployment: roleSpec.deployment,
      sourceLocation: sourcePath ? {
        path: sourcePath,
        line: index + 1,
        column: 0
      } : undefined
    };
    roles.push(role);
  });

  // Convert relationships
  spec.relationships.forEach((relSpec, index) => {
    const relationship: RelationshipNode = {
      id: `${relSpec.from}-${relSpec.to}-${relSpec.protocol}`,
      type: 'relationship',
      version: 1,
      status: 'parsed',
      dependencies: [relSpec.from, relSpec.to],
      dependents: [],
      from: relSpec.from,
      to: relSpec.to,
      protocol: relSpec.protocol,
      transport: relSpec.transport,
      direction: 'unidirectional',
      sourceLocation: sourcePath ? {
        path: sourcePath,
        line: roles.length + index + 1,
        column: 0
      } : undefined
    };
    relationships.push(relationship);
  });

  return { roles, relationships };
}

/**
 * Create a choreography parser gadget using createGadget
 */
export function createChoreographyParser() {
  const initialState: ParserState = {
    ast: createEmptyAST(),
    metrics: createEmptyMetrics(),
    cache: new Map(),
    lastSource: undefined
  };

  return createGadget<ParserState, CompilationEffect | ParserInput>(
    (state, incoming) => {
      // Handle direct source input
      if ('source' in incoming) {
        return { action: 'parse', context: incoming };
      }

      // Handle compilation effects that might trigger re-parsing
      if ('astUpdate' in incoming && incoming.astUpdate.update.status === 'invalid') {
        // Re-parse if validation failed
        return { action: 'reparse', context: { nodeId: incoming.astUpdate.nodeId } };
      }

      return null;
    },
    {
    'parse': (gadget: any, input: ParserInput) => {
      const state = gadget.current() as ParserState;
      try {
        const spec = parseChoreographySpec(input.source, input.format || 'yaml');
        const { roles, relationships } = convertToAST(spec, input.path);

        // Update AST incrementally
        const newAST = { ...state.ast };

        // Add/update roles
        roles.forEach(role => {
          newAST.roles.set(role.id, role);
          newAST.parseState.set(role.id, {
            status: 'complete',
            errors: [],
            progress: 100
          });
        });

        // Add/update relationships
        relationships.forEach(rel => {
          newAST.relationships.set(rel.id, rel);
          newAST.parseState.set(rel.id, {
            status: 'complete',
            errors: [],
            progress: 100
          });
        });

        newAST.version++;

        // Update metrics
        const newMetrics = {
          ...state.metrics,
          totalNodes: newAST.roles.size + newAST.relationships.size,
          parsedNodes: newAST.roles.size + newAST.relationships.size
        };

        const newState = {
          ...state,
          ast: newAST,
          metrics: newMetrics,
          lastSource: input.source
        };

        gadget.update(newState);

        // Emit AST updates for all parsed nodes
        roles.forEach(role => {
          gadget.emit(CompilationEffects.astUpdate(role.id, role));
        });
        relationships.forEach(rel => {
          gadget.emit(CompilationEffects.astUpdate(rel.id, rel));
        });

        return changed({
          parsed: true,
          nodesCount: roles.length + relationships.length,
          roles: roles.length,
          relationships: relationships.length
        });

      } catch (error) {
        const parseError: ParseError = {
          message: error instanceof Error ? error.message : 'Unknown parsing error',
          location: { path: input.path || 'unknown', line: 0, column: 0 },
          severity: 'error'
        };

        gadget.emit(CompilationEffects.compilationError('parser', {
          code: 'PARSE_ERROR',
          message: parseError.message,
          severity: 'error'
        }));

        return changed({ parsed: false, error: parseError });
      }
    },

    'reparse': (gadget: any, { nodeId }: { nodeId: string }) => {
      const state = gadget.current() as ParserState;
      // For simplicity, trigger a full reparse if we have the source
      if (state.lastSource) {
        return gadget.receive({
          source: state.lastSource,
          format: 'yaml' as const
        });
      }

      gadget.emit(CompilationEffects.parseProgress(nodeId, 0, {
        status: 'parsing',
        errors: [],
        progress: 0
      }));

      return noop();
    }
    }
  )(initialState);
}