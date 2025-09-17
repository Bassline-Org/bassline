/**
 * Filesystem Compiler Target (Functional Implementation)
 *
 * Compiles choreography roles into filesystem-based gadgets with shell scripts
 */

import { createGadget } from '../../core';
import { changed, noop } from '../../effects';
import {
  CompilationEffect,
  CompilationGadgetState,
  RoleNode,
  RelationshipNode
} from '../types';
import { createEmptyAST, createEmptyMetrics, CompilationEffects } from '../base';
import * as path from 'path';

interface FilesystemCompilerConfig {
  outputPath: string;
  scriptLanguage: 'bash' | 'python' | 'node';
  permissions: string;
}

interface FilesystemCompilerState extends CompilationGadgetState {
  config: FilesystemCompilerConfig;
  generatedArtifacts: Map<string, string[]>;
}

// Helper functions for filesystem compilation
function generateRoleArtifacts(role: RoleNode, config: FilesystemCompilerConfig): string[] {
  const artifacts: string[] = [];

  // Generate main gadget script
  artifacts.push(generateGadgetScript(role, config));

  // Generate interface scripts
  artifacts.push(generateReceiveScript(role, config));
  artifacts.push(generateEmitScript(role, config));
  artifacts.push(generateCurrentScript(role, config));
  artifacts.push(generateUpdateScript(role, config));

  // Generate configuration files
  artifacts.push(generateStateFile(role));
  artifacts.push(generateConfigFile(role));

  return artifacts;
}

function generateGadgetScript(role: RoleNode, config: FilesystemCompilerConfig): string {
  const script = `#!/bin/bash
# Generated gadget script for role: ${role.name}
# Type: ${role.roleType}
# Capabilities: ${role.capabilities.join(', ')}

ROLE_NAME="${role.name}"
ROLE_TYPE="${role.roleType}"
SCRIPT_DIR="$(cd "$(dirname "$\{BASH_SOURCE[0]}")" && pwd)"
STATE_FILE="$SCRIPT_DIR/state.json"
CONFIG_FILE="$SCRIPT_DIR/config.json"

# Load current state
load_state() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    else
        echo '{"role": "'$ROLE_NAME'", "type": "'$ROLE_TYPE'", "status": "ready"}'
    fi
}

# Save state
save_state() {
    echo "$1" > "$STATE_FILE"
}

# Main execution loop
main() {
    case "$1" in
        "receive")
            shift
            ./receive "$@"
            ;;
        "emit")
            shift
            ./emit "$@"
            ;;
        "current")
            ./current
            ;;
        "update")
            shift
            ./update "$@"
            ;;
        "start")
            echo "Starting $ROLE_NAME gadget..."
            # Implementation depends on role capabilities
${role.capabilities.map(cap => `            # Capability: ${cap}`).join('\n')}
            ;;
        "stop")
            echo "Stopping $ROLE_NAME gadget..."
            ;;
        *)
            echo "Usage: $0 {receive|emit|current|update|start|stop}"
            exit 1
            ;;
    esac
}

main "$@"`;

  return script;
}

function generateReceiveScript(role: RoleNode, config: FilesystemCompilerConfig): string {
  const script = `#!/bin/bash
# Receive script for role: ${role.name}

SCRIPT_DIR="$(cd "$(dirname "$\{BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gadget.sh"

MESSAGE="$1"
MESSAGE_TYPE="$2"

# Load current state
CURRENT_STATE=$(load_state)

# Handle different message types based on role capabilities
case "$MESSAGE_TYPE" in
${role.capabilities.map(cap => `    "${cap}")
        # Handle ${cap} messages
        echo "Processing $MESSAGE_TYPE: $MESSAGE"
        # Update state based on capability
        NEW_STATE=$(echo "$CURRENT_STATE" | jq '. + {"last_'${cap}'": "'$MESSAGE'", "timestamp": "'$(date -Iseconds)'"}')
        save_state "$NEW_STATE"
        ;;`).join('\n')}
    *)
        echo "Unknown message type: $MESSAGE_TYPE"
        exit 1
        ;;
esac

# Emit response if needed
if [ ! -z "$NEW_STATE" ]; then
    echo "$NEW_STATE" | ./emit
fi`;

  return script;
}

function generateEmitScript(role: RoleNode, config: FilesystemCompilerConfig): string {
  const script = `#!/bin/bash
# Emit script for role: ${role.name}

SCRIPT_DIR="$(cd "$(dirname "$\{BASH_SOURCE[0]}")" && pwd)"

# Read from stdin or use provided message
if [ -p /dev/stdin ]; then
    MESSAGE=$(cat)
else
    MESSAGE="$1"
fi

# Add metadata to message
METADATA='{
    "source": "'${role.name}'",
    "type": "'${role.roleType}'",
    "timestamp": "'$(date -Iseconds)'"
}'

# Combine message with metadata
FULL_MESSAGE=$(echo "$MESSAGE" | jq '. + '"$METADATA"')

# Emit to stdout (can be piped to other gadgets)
echo "$FULL_MESSAGE"

# Log to file if configured
LOG_FILE="$SCRIPT_DIR/../effects.log"
echo "$(date -Iseconds) [${role.name}] $FULL_MESSAGE" >> "$LOG_FILE"`;

  return script;
}

function generateCurrentScript(role: RoleNode, config: FilesystemCompilerConfig): string {
  const script = `#!/bin/bash
# Current state script for role: ${role.name}

SCRIPT_DIR="$(cd "$(dirname "$\{BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gadget.sh"

# Return current state
load_state`;

  return script;
}

function generateUpdateScript(role: RoleNode, config: FilesystemCompilerConfig): string {
  const script = `#!/bin/bash
# Update state script for role: ${role.name}

SCRIPT_DIR="$(cd "$(dirname "$\{BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gadget.sh"

NEW_STATE="$1"

if [ -z "$NEW_STATE" ]; then
    echo "Error: New state required"
    exit 1
fi

# Validate JSON
if ! echo "$NEW_STATE" | jq empty 2>/dev/null; then
    echo "Error: Invalid JSON state"
    exit 1
fi

# Save new state
save_state "$NEW_STATE"
echo "State updated successfully"`;

  return script;
}

function generateStateFile(role: RoleNode): string {
  const initialState = {
    role: role.name,
    type: role.roleType,
    capabilities: role.capabilities,
    status: 'ready',
    version: role.version,
    created: new Date().toISOString()
  };

  return JSON.stringify(initialState, null, 2);
}

function generateConfigFile(role: RoleNode): string {
  const config = {
    name: role.name,
    type: role.roleType,
    capabilities: role.capabilities,
    deployment: role.deployment || { target: 'filesystem' },
    generated: new Date().toISOString(),
    generator: 'bassline-choreography-compiler'
  };

  return JSON.stringify(config, null, 2);
}

function generateRelationshipArtifacts(rel: RelationshipNode, config: FilesystemCompilerConfig): string[] {
  const artifacts: string[] = [];

  // Generate wiring script
  artifacts.push(generateWiringScript(rel, config));

  // Generate relationship config
  artifacts.push(generateRelationshipConfig(rel));

  return artifacts;
}

function generateWiringScript(rel: RelationshipNode, config: FilesystemCompilerConfig): string {
  const script = `#!/bin/bash
# Wiring script for relationship: ${rel.from} -> ${rel.to}
# Protocol: ${rel.protocol}

FROM_GADGET="../${rel.from}"
TO_GADGET="../${rel.to}"
PROTOCOL="${rel.protocol}"

# Check if gadgets exist
if [ ! -d "$FROM_GADGET" ]; then
    echo "Error: Source gadget $FROM_GADGET not found"
    exit 1
fi

if [ ! -d "$TO_GADGET" ]; then
    echo "Error: Target gadget $TO_GADGET not found"
    exit 1
fi

# Set up the connection
echo "Connecting $FROM_GADGET to $TO_GADGET via $PROTOCOL"

# Create named pipe for communication if needed
PIPE_NAME="/tmp/${rel.from}_to_${rel.to}_$PROTOCOL"
if [ ! -p "$PIPE_NAME" ]; then
    mkfifo "$PIPE_NAME"
fi

# Start monitoring loop
monitor_connection() {
    while true; do
        # Read from source gadget
        if [ -p "$FROM_GADGET/output" ]; then
            MESSAGE=$(cat "$FROM_GADGET/output")
            if [ ! -z "$MESSAGE" ]; then
                # Forward to target gadget
                echo "$MESSAGE" | "$TO_GADGET/receive" "$PROTOCOL"
            fi
        fi
        sleep 0.1
    done
}

case "$1" in
    "start")
        echo "Starting relationship monitoring..."
        monitor_connection &
        echo $! > "/tmp/wire_${rel.from}_${rel.to}.pid"
        ;;
    "stop")
        if [ -f "/tmp/wire_${rel.from}_${rel.to}.pid" ]; then
            kill $(cat "/tmp/wire_${rel.from}_${rel.to}.pid")
            rm "/tmp/wire_${rel.from}_${rel.to}.pid"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop}"
        exit 1
        ;;
esac`;

  return script;
}

function generateRelationshipConfig(rel: RelationshipNode): string {
  const config = {
    id: rel.id,
    from: rel.from,
    to: rel.to,
    protocol: rel.protocol,
    transport: rel.transport || 'pipe',
    direction: rel.direction,
    generated: new Date().toISOString()
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Create a filesystem compiler gadget using createGadget
 */
export function createFilesystemCompiler(config: { outputPath: string; scriptLanguage?: 'bash' | 'python' | 'node' } = { outputPath: './output' }) {
  const compilerConfig: FilesystemCompilerConfig = {
    outputPath: config.outputPath,
    scriptLanguage: config.scriptLanguage || 'bash',
    permissions: '755'
  };

  const initialState: FilesystemCompilerState = {
    ast: createEmptyAST(),
    metrics: createEmptyMetrics(),
    cache: new Map(),
    config: compilerConfig,
    generatedArtifacts: new Map()
  };

  return createGadget<FilesystemCompilerState, CompilationEffect>(
    (state, incoming) => {
      // Handle validation results for code generation
      if ('validationResult' in incoming && incoming.validationResult.valid) {
        return { action: 'generate_code', context: incoming.validationResult };
      }

      // Handle AST updates to build our local AST
      if ('astUpdate' in incoming) {
        return { action: 'update_ast', context: incoming.astUpdate };
      }

      return null;
    },
    {
      'generate_code': (gadget: any, validationResult: any) => {
        const state = gadget.current() as FilesystemCompilerState;
        const { nodeId } = validationResult;

        // Get the node from our local AST
        const node = state.ast.roles.get(nodeId) || state.ast.relationships.get(nodeId);
        if (!node) {
          console.log(`[Compiler] Node ${nodeId} not found in AST`);
          return noop();
        }

        console.log(`[Compiler] Generating code for ${nodeId} (${node.type})`)

        // Generate artifacts based on node type
        let artifacts: string[] = [];
        if (node.type === 'role') {
          artifacts = generateRoleArtifacts(node as RoleNode, state.config);
        } else if (node.type === 'relationship') {
          artifacts = generateRelationshipArtifacts(node as RelationshipNode, state.config);
        }

        // Update state with generated artifacts
        const newGeneratedArtifacts = new Map(state.generatedArtifacts);
        newGeneratedArtifacts.set(nodeId, artifacts);

        // Update metrics
        const newMetrics = { ...state.metrics };
        newMetrics.generatedArtifacts += artifacts.length;

        const newState = {
          ...state,
          generatedArtifacts: newGeneratedArtifacts,
          metrics: newMetrics
        };

        gadget.update(newState);

        // Emit code generation result
        gadget.emit(CompilationEffects.codeGeneration('filesystem', artifacts.map(artifact => ({
          type: node.type,
          nodeId,
          content: artifact,
          language: state.config.scriptLanguage
        }))));

        // Emit materialization requests
        const materializationRequests = artifacts.map((artifact, index) => {
          const extension = state.config.scriptLanguage === 'bash' ? '.sh' :
                          state.config.scriptLanguage === 'python' ? '.py' : '.js';

          const fileName = index === 0 ? 'gadget' + extension :
                          index === 1 ? 'receive' + extension :
                          index === 2 ? 'emit' + extension :
                          index === 3 ? 'current' + extension :
                          index === 4 ? 'update' + extension :
                          index === 5 ? 'state.json' :
                          'config.json';

          return {
            path: path.join(state.config.outputPath, nodeId, fileName),
            content: artifact,
            permissions: fileName.endsWith('.json') ? '644' : state.config.permissions,
            type: 'file'
          };
        });

        gadget.emit(CompilationEffects.materialization(materializationRequests));

        return changed({
          generated: true,
          nodeId,
          artifactCount: artifacts.length,
          target: 'filesystem'
        });
      },

      'update_ast': (gadget: any, { nodeId, update }: { nodeId: string; update: any }) => {
        const state = gadget.current() as FilesystemCompilerState;

        // Update our local AST
        const newAST = { ...state.ast };
        if (update.type === 'role') {
          newAST.roles.set(nodeId, update);
        } else if (update.type === 'relationship') {
          newAST.relationships.set(nodeId, update);
        }
        newAST.version++;

        const newState = {
          ...state,
          ast: newAST
        };

        gadget.update(newState);
        return noop();
      }
    }
  )(initialState);
}