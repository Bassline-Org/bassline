/**
 * Choreography Parser Gadget
 *
 * Continuously parses choreography specifications, emitting incremental AST updates
 */

import { CompilationGadget, CompilationEffects } from '../base';
import {
  CompilationEffect,
  CompilationGadgetState,
  ChoreographySpec,
  RoleNode,
  RelationshipNode,
  ParseError,
  SourceLocation
} from '../types';
import { changed, noop } from '../../effects';

interface ParserInput {
  source: string;
  path?: string;
  format?: 'yaml' | 'json';
}

export class ChoreographyParser extends CompilationGadget {
  protected consider(
    state: CompilationGadgetState,
    effect: CompilationEffect | ParserInput
  ): { action: string; context: any } | null {
    // Handle direct source input
    if ('source' in effect) {
      return { action: 'parse', context: effect };
    }

    // Handle compilation effects that might trigger re-parsing
    if ('astUpdate' in effect && effect.astUpdate.update.status === 'invalid') {
      // Re-parse if validation failed
      return { action: 'reparse', context: { nodeId: effect.astUpdate.nodeId } };
    }

    return null;
  }

  protected createActions() {
    return {
      'parse': (gadget: any, input: ParserInput) => {
        const state = gadget.current() as CompilationGadgetState;

        try {
          const spec = this.parseChoreographySpec(input.source, input.format || 'yaml');
          const { roles, relationships } = this.convertToAST(spec, input.path);

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

            // Emit AST update for each role
            gadget.emit(CompilationEffects.astUpdate(role.id, role));
          });

          // Add/update relationships
          relationships.forEach(rel => {
            newAST.relationships.set(rel.id, rel);
            newAST.parseState.set(rel.id, {
              status: 'complete',
              errors: [],
              progress: 100
            });

            // Emit AST update for each relationship
            gadget.emit(CompilationEffects.astUpdate(rel.id, rel));
          });

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
      if (line.endsWith(':') && !line.includes(' ')) {
        currentSection = line.slice(0, -1);
        continue;
      }

      if (currentSection === 'roles') {
        if (line.includes(':') && !line.startsWith(' ')) {
          currentRole = line.split(':')[0];
          spec.roles[currentRole] = { type: 'worker' };
        } else if (line.startsWith('type:')) {
          spec.roles[currentRole].type = line.split(':')[1].trim();
        } else if (line.startsWith('capabilities:')) {
          const caps = line.split(':')[1].trim();
          spec.roles[currentRole].capabilities = caps.split(',').map(c => c.trim());
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