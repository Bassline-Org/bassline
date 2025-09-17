/**
 * Choreography Parser Gadget
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
    }
  )({
    'parse': (gadget: any, state: ParserState, input: ParserInput) => {

        try {
          const spec = this.parseChoreographySpec(input.source, input.format || 'yaml');
          const { roles, relationships } = this.convertToAST(spec, input.path);

          // Update AST incrementally
          const newAST = { ...state.ast };

          // Store effects to emit
          const effectsToEmit: any[] = [];

          // Add/update roles
          roles.forEach(role => {
            newAST.roles.set(role.id, role);
            newAST.parseState.set(role.id, {
              status: 'complete',
              errors: [],
              progress: 100
            });

            // Store AST update effect for each role
            effectsToEmit.push(CompilationEffects.astUpdate(role.id, role));
          });

          // Add/update relationships
          relationships.forEach(rel => {
            newAST.relationships.set(rel.id, rel);
            newAST.parseState.set(rel.id, {
              status: 'complete',
              errors: [],
              progress: 100
            });

            // Store AST update effect for each relationship
            effectsToEmit.push(CompilationEffects.astUpdate(rel.id, rel));
          });

          // Emit all effects after updating state
          effectsToEmit.forEach(effect => gadget.emit(effect));

          newAST.version++;

          // Update metrics
          const newMetrics = {
            ...state.metrics,
            totalNodes: newAST.roles.size + newAST.relationships.size,
            parsedNodes: newAST.roles.size + newAST.relationships.size
          };

          gadget.update({
            ...state,
            ast: newAST,
            metrics: newMetrics
          });

          return changed({ parsed: true, nodesCount: roles.length + relationships.length });

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
        // For simplicity, trigger a full reparse
        // In a real implementation, this would do incremental reparsing
        const state = gadget.current() as CompilationGadgetState;

        gadget.emit(CompilationEffects.parseProgress(nodeId, 0, {
          status: 'parsing',
          errors: [],
          progress: 0
        }));

        return noop();
      }
    };
  }

  private parseChoreographySpec(source: string, format: 'yaml' | 'json'): ChoreographySpec {
    if (format === 'json') {
      return JSON.parse(source);
    } else {
      // Simple YAML-like parsing for demo purposes
      // In production, use a real YAML parser
      return this.parseYAMLLike(source);
    }
  }

  private parseYAMLLike(source: string): ChoreographySpec {
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

  private convertToAST(
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
}

/**
 * Create a choreography parser gadget
 */
export function createChoreographyParser(): ChoreographyParser {
  return new ChoreographyParser({});
}