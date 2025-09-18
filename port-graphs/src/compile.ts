/**
 * Minimal choreography compiler
 *
 * Just functions - no unnecessary complexity
 */

import * as fs from 'fs';
import * as path from 'path';

// Types are simple
type Node = {
  id: string;
  type: 'role' | 'relationship';
  [key: string]: any;
};

/**
 * Parse choreography text into nodes
 */
export function parse(text: string): Node[] {
  const lines = text.split('\n');
  const nodes: Node[] = [];

  let section = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed === 'roles:') { section = 'roles'; continue; }
    if (trimmed === 'relationships:') { section = 'rels'; continue; }

    if (section === 'roles' && !trimmed.endsWith(':')) {
      const [name, roleType] = trimmed.split(':').map(s => s.trim());
      nodes.push({ id: name, type: 'role', roleType: roleType || '' });
    }

    if (section === 'rels' && trimmed.includes('->')) {
      const [rel, protocol] = trimmed.split(':').map(s => s.trim());
      if (rel) {
        const [from, to] = rel.split('->').map(s => s.trim());
        nodes.push({
          id: `${from}-${to}`,
          type: 'relationship',
          from, to, protocol
        });
      }
    }
  }

  return nodes;
}

/**
 * Generate simple bash scripts
 */
export function generateBash(node: Node): string {
  if (node.type === 'role') {
    return `#!/bin/bash
# ${node.id} gadget (${node.roleType})

# Gadget protocol
receive() { echo "[${node.id}] Received: $1"; }
emit() { echo "[${node.id}] Emitting: $1"; }
current() { echo "[${node.id}] State: ready"; }

case "$1" in
  receive) receive "$2" ;;
  emit) emit "$2" ;;
  current) current ;;
  *) echo "Usage: $0 {receive|emit|current}" ;;
esac`;
  }

  // Relationship wiring
  return `#!/bin/bash
# Wire ${node.from} -> ${node.to} via ${node.protocol}
echo "Connecting ${node.from} to ${node.to} using ${node.protocol}"`;
}

/**
 * Complete compilation - parse, generate, write
 */
export function compile(text: string, outputDir = './generated'): number {
  const nodes = parse(text);

  // Generate and write files
  let count = 0;
  for (const node of nodes) {
    const dir = path.join(outputDir, node.id);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const script = generateBash(node);
    const scriptPath = path.join(dir, 'gadget.sh');
    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');
    count++;
  }

  return count;
}