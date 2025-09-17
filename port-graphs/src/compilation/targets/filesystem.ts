/**
 * Filesystem Compilation Target
 *
 * Compiles choreographies to executable shell scripts and configuration files
 * that can run as a filesystem-based gadget network
 */

import { CompilationGadget, CompilationEffects } from '../base';
import {
  CompilationEffect,
  CompilationGadgetState,
  CodeArtifact,
  MaterializationRequest,
  RoleNode,
  RelationshipNode,
  CompilationTarget
} from '../types';
import { changed, noop } from '../../effects';
import * as path from 'path';

interface FilesystemConfig {
  outputPath: string;
  templatePath?: string;
  shellTemplate?: 'bash' | 'zsh' | 'sh';
  includeHelpers?: boolean;
}

export class FilesystemCompiler extends CompilationGadget {
  private config: FilesystemConfig;

  constructor(config: FilesystemConfig) {
    super({
      target: {
        id: 'filesystem',
        name: 'Filesystem Target',
        description: 'Compiles choreographies to shell scripts and config files',
        capabilities: ['shell_script_generation', 'file_materialization'],
        configuration: {
          outputPath: config.outputPath,
          fileExtensions: {
            script: '.sh',
            config: '.json',
            state: '.json'
          }
        }
      }
    });

    this.config = {
      shellTemplate: 'bash',
      includeHelpers: true,
      ...config
    };
  }

  protected consider(
    state: CompilationGadgetState,
    effect: CompilationEffect
  ): { action: string; context: any } | null {
    if ('optimization' in effect) {
      return { action: 'generate_code', context: effect.optimization };
    }

    if ('validationResult' in effect && effect.validationResult.valid) {
      // Generate code for valid nodes even without optimization
      return { action: 'generate_code', context: { nodeId: effect.validationResult.nodeId } };
    }

    return null;
  }

  protected createActions() {
    return {
      'generate_code': (gadget: any, context: { nodeId: string }) => {
        const state = gadget.current() as CompilationGadgetState;
        const { nodeId } = context;

        try {
          const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
          if (!node) {
            return noop();
          }

          const artifacts = this.generateArtifacts(node, state);

          // Emit code generation effect
          gadget.emit(CompilationEffects.codeGeneration('filesystem', artifacts));

          // Generate materialization requests
          const materializationRequests = this.createMaterializationRequests(artifacts);
          if (materializationRequests.length > 0) {
            gadget.emit(CompilationEffects.materialization(materializationRequests));
          }

          // Update metrics
          const newMetrics = { ...state.metrics };
          newMetrics.generatedArtifacts += artifacts.length;

          gadget.update({
            ...state,
            metrics: newMetrics
          });

          return changed({
            generated: true,
            nodeId,
            artifacts: artifacts.length,
            files: materializationRequests.length
          });

        } catch (error) {
          gadget.emit(CompilationEffects.compilationError(nodeId, {
            code: 'CODEGEN_ERROR',
            message: error instanceof Error ? error.message : 'Unknown code generation error',
            severity: 'error'
          }));

          return changed({ generated: false, nodeId, error: error.message });
        }
      }
    };
  }

  private generateArtifacts(node: any, state: CompilationGadgetState): CodeArtifact[] {
    const artifacts: CodeArtifact[] = [];

    if (node.type === 'role') {
      artifacts.push(...this.generateRoleArtifacts(node as RoleNode, state));
    } else if (node.type === 'relationship') {
      artifacts.push(...this.generateRelationshipArtifacts(node as RelationshipNode, state));
    }

    return artifacts;
  }

  private generateRoleArtifacts(role: RoleNode, state: CompilationGadgetState): CodeArtifact[] {
    const artifacts: CodeArtifact[] = [];
    const rolePath = path.join(this.config.outputPath, role.name);

    // Generate main gadget script
    artifacts.push({
      id: `${role.id}_main`,
      type: 'shell_script',
      path: path.join(rolePath, 'gadget.sh'),
      content: this.generateRoleScript(role, state),
      executable: true,
      dependencies: [],
      metadata: { role: role.name, type: 'main_script' }
    });

    // Generate receive script
    artifacts.push({
      id: `${role.id}_receive`,
      type: 'shell_script',
      path: path.join(rolePath, 'receive'),
      content: this.generateReceiveScript(role, state),
      executable: true,
      dependencies: [],
      metadata: { role: role.name, type: 'receive_script' }
    });

    // Generate emit script
    artifacts.push({
      id: `${role.id}_emit`,
      type: 'shell_script',
      path: path.join(rolePath, 'emit'),
      content: this.generateEmitScript(role, state),
      executable: true,
      dependencies: [],
      metadata: { role: role.name, type: 'emit_script' }
    });

    // Generate current script
    artifacts.push({
      id: `${role.id}_current`,
      type: 'shell_script',
      path: path.join(rolePath, 'current'),
      content: this.generateCurrentScript(role, state),
      executable: true,
      dependencies: [],
      metadata: { role: role.name, type: 'current_script' }
    });

    // Generate update script
    artifacts.push({
      id: `${role.id}_update`,
      type: 'shell_script',
      path: path.join(rolePath, 'update'),
      content: this.generateUpdateScript(role, state),
      executable: true,
      dependencies: [],
      metadata: { role: role.name, type: 'update_script' }
    });

    // Generate initial state file
    artifacts.push({
      id: `${role.id}_state`,
      type: 'config_file',
      path: path.join(rolePath, 'state.json'),
      content: this.generateInitialState(role, state),
      executable: false,
      dependencies: [],
      metadata: { role: role.name, type: 'state_file' }
    });

    // Generate configuration file
    artifacts.push({
      id: `${role.id}_config`,
      type: 'config_file',
      path: path.join(rolePath, 'config.json'),
      content: this.generateRoleConfig(role, state),
      executable: false,
      dependencies: [],
      metadata: { role: role.name, type: 'config_file' }
    });

    return artifacts;
  }

  private generateRelationshipArtifacts(relationship: RelationshipNode, state: CompilationGadgetState): CodeArtifact[] {
    const artifacts: CodeArtifact[] = [];
    const relPath = path.join(this.config.outputPath, 'relationships', relationship.id);

    // Generate relationship configuration
    artifacts.push({
      id: `${relationship.id}_config`,
      type: 'config_file',
      path: path.join(relPath, 'config.json'),
      content: this.generateRelationshipConfig(relationship, state),
      executable: false,
      dependencies: [relationship.from, relationship.to],
      metadata: { relationship: relationship.id, type: 'config_file' }
    });

    // Generate wiring script
    artifacts.push({
      id: `${relationship.id}_wire`,
      type: 'shell_script',
      path: path.join(relPath, 'wire.sh'),
      content: this.generateWiringScript(relationship, state),
      executable: true,
      dependencies: [relationship.from, relationship.to],
      metadata: { relationship: relationship.id, type: 'wiring_script' }
    });

    return artifacts;
  }

  private generateRoleScript(role: RoleNode, state: CompilationGadgetState): string {
    const shell = this.config.shellTemplate;

    return `#!/bin/${shell}
# Generated gadget script for role: ${role.name}
# Type: ${role.roleType}
# Capabilities: ${role.capabilities.join(', ')}

set -euo pipefail

# Role configuration
ROLE_NAME="${role.name}"
ROLE_TYPE="${role.roleType}"
GADGET_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="\$GADGET_DIR/state.json"
CONFIG_FILE="\$GADGET_DIR/config.json"
EFFECTS_LOG="\$GADGET_DIR/effects.log"

# Load helper functions
${this.config.includeHelpers ? this.generateHelperFunctions() : ''}

# Main gadget loop
main() {
    echo "[$(date)] Starting gadget: \$ROLE_NAME" | tee -a "\$EFFECTS_LOG"

    # Initialize state if needed
    if [[ ! -f "\$STATE_FILE" ]]; then
        echo '${this.generateInitialState(role, state)}' > "\$STATE_FILE"
    fi

    # Start background processes
    start_receiver &
    start_monitor &

    # Keep main process alive
    wait
}

# Start message receiver
start_receiver() {
    local pipe="\$GADGET_DIR/receive_pipe"
    mkfifo "\$pipe" 2>/dev/null || true

    while IFS= read -r message < "\$pipe"; do
        if [[ -n "\$message" ]]; then
            echo "[$(date)] Received: \$message" | tee -a "\$EFFECTS_LOG"
            "\$GADGET_DIR/receive" "\$message"
        fi
    done
}

# Monitor for state changes
start_monitor() {
    while true; do
        sleep 1
        # Add monitoring logic here
    done
}

# Signal handlers
trap 'echo "[$(date)] Shutting down \$ROLE_NAME" | tee -a "\$EFFECTS_LOG"; exit 0' SIGTERM SIGINT

# Start main process
if [[ "\${BASH_SOURCE[0]}" == "\${0}" ]]; then
    main "\$@"
fi
`;
  }

  private generateReceiveScript(role: RoleNode, state: CompilationGadgetState): string {
    const relationships = Array.from(state.ast.relationships.values())
      .filter(rel => rel.to === role.name);

    return `#!/bin/bash
# Receive script for role: ${role.name}

set -euo pipefail

GADGET_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="\$GADGET_DIR/state.json"
EFFECTS_LOG="\$GADGET_DIR/effects.log"

# Input message
MESSAGE="\$1"

# Load current state
CURRENT_STATE="\$(cat "\$STATE_FILE")"

# Parse message (expecting JSON)
if command -v jq >/dev/null 2>&1; then
    MESSAGE_TYPE="\$(echo "\$MESSAGE" | jq -r '.type // "unknown"')"
    MESSAGE_DATA="\$(echo "\$MESSAGE" | jq -r '.data // {}')"
else
    # Fallback parsing
    MESSAGE_TYPE="unknown"
    MESSAGE_DATA="\$MESSAGE"
fi

echo "[$(date)] Processing message type: \$MESSAGE_TYPE" | tee -a "\$EFFECTS_LOG"

# Handle different message types based on role capabilities
case "\$MESSAGE_TYPE" in
${role.capabilities.map(cap => this.generateCapabilityHandler(cap, role)).join('\n')}
    *)
        echo "[$(date)] Unknown message type: \$MESSAGE_TYPE" | tee -a "\$EFFECTS_LOG"
        ;;
esac

# Update state and emit effects
"\$GADGET_DIR/update" "\$CURRENT_STATE"
`;
  }

  private generateCapabilityHandler(capability: string, role: RoleNode): string {
    return `    "${capability}")
        echo "[$(date)] Handling ${capability}" | tee -a "\$EFFECTS_LOG"
        # Add specific logic for ${capability}
        EFFECT="{\\"type\\":\\"${capability}_handled\\",\\"role\\":\\"${role.name}\\",\\"timestamp\\":\\"\$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\\"}"
        "\$GADGET_DIR/emit" "\$EFFECT"
        ;;`;
  }

  private generateEmitScript(role: RoleNode, state: CompilationGadgetState): string {
    const outgoingRelationships = Array.from(state.ast.relationships.values())
      .filter(rel => rel.from === role.name);

    return `#!/bin/bash
# Emit script for role: ${role.name}

set -euo pipefail

GADGET_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
EFFECTS_LOG="\$GADGET_DIR/effects.log"

# Effect to emit
EFFECT="\$1"

echo "[$(date)] Emitting: \$EFFECT" | tee -a "\$EFFECTS_LOG"

# Route effect to connected roles
${outgoingRelationships.map(rel => this.generateRoutingLogic(rel)).join('\n')}

# Also log to global effects stream
echo "\$EFFECT" >> "\$GADGET_DIR/../effects.log"
`;
  }

  private generateRoutingLogic(relationship: RelationshipNode): string {
    return `
# Route to ${relationship.to} via ${relationship.protocol}
TARGET_DIR="\$GADGET_DIR/../${relationship.to}"
if [[ -d "\$TARGET_DIR" ]]; then
    echo "\$EFFECT" > "\$TARGET_DIR/receive_pipe" || true
fi`;
  }

  private generateCurrentScript(role: RoleNode, state: CompilationGadgetState): string {
    return `#!/bin/bash
# Current state script for role: ${role.name}

GADGET_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="\$GADGET_DIR/state.json"

if [[ -f "\$STATE_FILE" ]]; then
    cat "\$STATE_FILE"
else
    echo '${this.generateInitialState(role, state)}'
fi
`;
  }

  private generateUpdateScript(role: RoleNode, state: CompilationGadgetState): string {
    return `#!/bin/bash
# Update state script for role: ${role.name}

set -euo pipefail

GADGET_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="\$GADGET_DIR/state.json"
EFFECTS_LOG="\$GADGET_DIR/effects.log"

# New state
NEW_STATE="\$1"

# Validate JSON if jq is available
if command -v jq >/dev/null 2>&1; then
    echo "\$NEW_STATE" | jq . >/dev/null || {
        echo "[$(date)] Invalid JSON state" | tee -a "\$EFFECTS_LOG"
        exit 1
    }
fi

# Update state file
echo "\$NEW_STATE" > "\$STATE_FILE"
echo "[$(date)] State updated for ${role.name}" | tee -a "\$EFFECTS_LOG"
`;
  }

  private generateInitialState(role: RoleNode, state: CompilationGadgetState): string {
    const initialState = {
      role: role.name,
      type: role.roleType,
      capabilities: role.capabilities,
      status: 'initialized',
      timestamp: new Date().toISOString(),
      data: {}
    };

    return JSON.stringify(initialState, null, 2);
  }

  private generateRoleConfig(role: RoleNode, state: CompilationGadgetState): string {
    const config = {
      name: role.name,
      type: role.roleType,
      capabilities: role.capabilities,
      deployment: role.deployment || { target: 'filesystem' },
      relationships: {
        incoming: Array.from(state.ast.relationships.values())
          .filter(rel => rel.to === role.name)
          .map(rel => ({ from: rel.from, protocol: rel.protocol })),
        outgoing: Array.from(state.ast.relationships.values())
          .filter(rel => rel.from === role.name)
          .map(rel => ({ to: rel.to, protocol: rel.protocol }))
      }
    };

    return JSON.stringify(config, null, 2);
  }

  private generateRelationshipConfig(relationship: RelationshipNode, state: CompilationGadgetState): string {
    const config = {
      id: relationship.id,
      from: relationship.from,
      to: relationship.to,
      protocol: relationship.protocol,
      transport: relationship.transport || 'pipe',
      direction: relationship.direction,
      status: 'active'
    };

    return JSON.stringify(config, null, 2);
  }

  private generateWiringScript(relationship: RelationshipNode, state: CompilationGadgetState): string {
    return `#!/bin/bash
# Wiring script for relationship: ${relationship.id}

set -euo pipefail

NETWORK_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")/../.." && pwd)"
FROM_DIR="\$NETWORK_DIR/${relationship.from}"
TO_DIR="\$NETWORK_DIR/${relationship.to}"

echo "Wiring ${relationship.from} -> ${relationship.to} (${relationship.protocol})"

# Create named pipes for communication
mkfifo "\$TO_DIR/receive_pipe" 2>/dev/null || true

echo "Wiring established for relationship: ${relationship.id}"
`;
  }

  private generateHelperFunctions(): string {
    return `
# Helper functions for gadget operations

# JSON utilities
json_get() {
    local json="\$1"
    local key="\$2"
    if command -v jq >/dev/null 2>&1; then
        echo "\$json" | jq -r ".\$key // empty"
    else
        # Fallback parsing
        echo "\$json" | grep -o "\\"$key\\":\\s*\\"[^\\"]*\\"" | cut -d'"' -f4
    fi
}

# Logging utilities
log_info() {
    echo "[$(date)] INFO: \$*" | tee -a "\$EFFECTS_LOG"
}

log_error() {
    echo "[$(date)] ERROR: \$*" | tee -a "\$EFFECTS_LOG" >&2
}

# State utilities
get_state() {
    cat "\$STATE_FILE" 2>/dev/null || echo '{}'
}

set_state() {
    echo "\$1" > "\$STATE_FILE"
    log_info "State updated"
}
`;
  }

  private createMaterializationRequests(artifacts: CodeArtifact[]): MaterializationRequest[] {
    const requests: MaterializationRequest[] = [];

    artifacts.forEach(artifact => {
      // Create directory
      const dir = path.dirname(artifact.path);
      requests.push({
        type: 'create_directory',
        path: dir
      });

      // Write file
      requests.push({
        type: 'write_file',
        path: artifact.path,
        content: artifact.content
      });

      // Set permissions
      if (artifact.executable) {
        requests.push({
          type: 'set_permissions',
          path: artifact.path,
          permissions: 0o755
        });
      }
    });

    return requests;
  }
}

/**
 * Create a filesystem compiler gadget
 */
export function createFilesystemCompiler(config: FilesystemConfig): FilesystemCompiler {
  return new FilesystemCompiler(config);
}