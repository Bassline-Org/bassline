#!/usr/bin/env tsx
/**
 * Claude Code MCP Integration Example
 *
 * Demonstrates how Claude can interact with compilation networks through
 * the MCP gadget using universal filesystem-like tools
 */

import { ChoreographyShell } from '../../src/mcp/shell';
import { createMCPServer } from '../../src/mcp/server';
import * as path from 'path';

console.log('=== Claude Code MCP Integration Demo ===\\n');

console.log('1. CREATING CHOREOGRAPHY SHELL ENVIRONMENT');

// Create the shell that provides filesystem-like access to compilation networks
const shell = new ChoreographyShell({
  workingDirectory: path.join(process.cwd(), 'mcp-workspace'),
  networks: new Map(), // Start with no networks
  enableWatching: true
});

console.log('  ✓ Created choreography shell');
console.log(`  ✓ Working directory: ${shell.pwd()}`);

console.log('\\n2. CREATING MCP SERVER WITH GADGET');

// Create MCP server that wraps the MCP gadget
const mcpServer = createMCPServer(shell, { toolPrefix: 'choreo' });

console.log('  ✓ Created MCP server with gadget protocol');
console.log('  ✓ Available tools:');

// Show available tools that Claude can use
const toolDescriptions = mcpServer.getToolsDescription();
const toolNames = toolDescriptions.split('\\n\\n').map(desc => desc.split(':')[0]);
toolNames.forEach(name => console.log(`    - ${name}`));

console.log('\\n3. SIMULATING CLAUDE CODE INTERACTIONS');

async function simulateClaudeSession() {
  console.log('  Simulating Claude using MCP tools...');

  // 1. List available networks (should be empty initially)
  console.log('\\n  [Claude]: choreo_exec ls');
  let result = await mcpServer.handleToolCall('choreo_exec', { command: 'ls' });
  console.log(`  Output: ${result.output || '(empty - no networks yet)'}`);

  // 2. Create a new network
  console.log('\\n  [Claude]: choreo_exec create-network payment-system');
  result = await mcpServer.handleToolCall('choreo_exec', {
    command: 'create-network',
    args: ['payment-system']
  });
  console.log(`  Output: ${result.output}`);

  // 3. Enter the network
  console.log('\\n  [Claude]: choreo_exec cd payment-system');
  result = await mcpServer.handleToolCall('choreo_exec', {
    command: 'cd',
    args: ['payment-system']
  });
  console.log(`  Output: ${result.output}`);

  // 4. List gadgets in the network
  console.log('\\n  [Claude]: choreo_exec ls');
  result = await mcpServer.handleToolCall('choreo_exec', { command: 'ls' });
  console.log(`  Output: ${result.output || '(no gadgets yet - network needs compilation)'}`);

  // 5. Compile a choreography
  console.log('\\n  [Claude]: choreo_compile (with inline choreography)');
  const choreography = `
name: payment-system
version: 1.0.0

roles:
  gateway:
    type: coordinator
    capabilities:
      - receive_requests
      - route_payments
      - handle_responses

  processor:
    type: worker
    capabilities:
      - validate_payment
      - process_transaction
      - generate_receipt

  validator:
    type: validator
    capabilities:
      - check_balance
      - verify_card
      - fraud_detection

  logger:
    type: observer
    capabilities:
      - log_transactions
      - audit_trail

relationships:
  gateway -> processor: payment_request
  gateway -> validator: validation_request
  processor -> gateway: payment_result
  validator -> gateway: validation_result
  processor -> logger: transaction_log
  validator -> logger: audit_log
`;

  result = await mcpServer.handleToolCall('choreo_compile', {
    source: choreography,
    targets: ['filesystem', 'container']
  });

  if (result.success) {
    console.log(`  ✓ Compilation successful!`);
    console.log(`  ✓ ${result.data?.metrics.totalNodes || 0} nodes processed`);
    console.log(`  ✓ ${result.data?.metrics.generatedArtifacts || 0} artifacts generated`);
  } else {
    console.log(`  ✗ Compilation failed: ${result.error}`);
  }

  // 6. List gadgets now that compilation is complete
  console.log('\\n  [Claude]: choreo_exec ls --long');
  result = await mcpServer.handleToolCall('choreo_exec', {
    command: 'ls',
    flags: { long: true }
  });
  console.log(`  Output:\\n${result.output.split('\\n').map(line => `    ${line}`).join('\\n')}`);

  // 7. Read a gadget's state
  console.log('\\n  [Claude]: choreo_read parser/state.json');
  result = await mcpServer.handleToolCall('choreo_read', {
    path: 'parser/state.json'
  });
  if (result.success && result.data) {
    console.log('  Parser state:');
    console.log(`    AST Version: ${result.data.astVersion || 0}`);
    console.log(`    Parsed Nodes: ${result.data.parsedNodes || 0}`);
  }

  // 8. Query compilation metrics
  console.log('\\n  [Claude]: choreo_query /metrics');
  result = await mcpServer.handleToolCall('choreo_query', {
    path: '/metrics'
  });
  if (result.success && result.data) {
    console.log('  Compilation metrics:');
    Object.entries(result.data).forEach(([key, value]) => {
      console.log(`    ${key}: ${value}`);
    });
  }

  // 9. Get recent effects stream
  console.log('\\n  [Claude]: choreo_query /effects/5');
  result = await mcpServer.handleToolCall('choreo_query', {
    path: '/effects/5'
  });
  if (result.success && Array.isArray(result.data)) {
    console.log(`  Recent effects (${result.data.length}):`)
    result.data.slice(0, 3).forEach((effect: any, i) => {
      const source = effect._source || 'unknown';
      const type = Object.keys(effect)[0];
      console.log(`    ${i + 1}. [${source}] ${type}`);
    });
  }

  // 10. Navigate filesystem semantically
  console.log('\\n  [Claude]: choreo_exec cd parser');
  result = await mcpServer.handleToolCall('choreo_exec', {
    command: 'cd',
    args: ['parser']
  });
  console.log(`  Output: ${result.output}`);

  console.log('\\n  [Claude]: choreo_exec ls');
  result = await mcpServer.handleToolCall('choreo_exec', { command: 'ls' });
  console.log(`  Parser gadget files:\\n${result.output.split('\\n').map(line => `    ${line}`).join('\\n')}`);

  // 11. Read gadget interface
  console.log('\\n  [Claude]: choreo_read receive');
  result = await mcpServer.handleToolCall('choreo_read', { path: 'receive' });
  console.log(`  Receive interface:\\n${result.output.split('\\n').map(line => `    ${line}`).join('\\n')}`);
}

// Run the simulation
simulateClaudeSession().then(() => {
  console.log('\\n=== MCP Integration Capabilities ===');
  console.log('✓ Universal tools instead of many narrow tools');
  console.log('✓ Filesystem-like navigation of compilation networks');
  console.log('✓ Real-time access to gadget states and compilation progress');
  console.log('✓ Interactive choreography compilation and artifact generation');
  console.log('✓ Cross-target compilation (filesystem + containers)');
  console.log('✓ Query interface for deep network introspection');
  console.log('✓ Session management with directory context');
  console.log('✓ MCP integration follows gadget protocol');

  console.log('\\n=== What This Enables for Claude ===');
  console.log('• Natural filesystem operations on abstract compilation networks');
  console.log('• Real-time monitoring and debugging of choreography compilation');
  console.log('• Interactive development and testing of choreographies');
  console.log('• Multi-target deployment with single choreography source');
  console.log('• Progressive compilation insights through effects streaming');
  console.log('• Semantic navigation of gadget internals');

  console.log('\\n=== Example Claude Workflow ===');
  console.log('1. ls                                    # See available networks');
  console.log('2. create-network microservice-cluster   # Create compilation network');
  console.log('3. cd microservice-cluster               # Enter network');
  console.log('4. compile choreography.yaml             # Compile choreography');
  console.log('5. ls --long                             # See generated gadgets');
  console.log('6. cd parser && cat state.json           # Inspect parser state');
  console.log('7. cd .. && query /effects/10            # See recent compilation activity');
  console.log('8. compile updated.yaml --targets container # Recompile for containers');

  process.exit(0);
}).catch(error => {
  console.error('MCP demo failed:', error);
  process.exit(1);
});