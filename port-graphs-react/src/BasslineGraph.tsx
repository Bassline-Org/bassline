/**
 * BasslineGraph - Visual representation of bassline topology
 *
 * Shows gadgets as nodes and connections as edges
 */

import React from 'react';
import { useGadget } from './useGadget';
import type { Gadget, FactoryBasslineSpec } from 'port-graphs';

interface BasslineGraphProps {
  bassline: Gadget<FactoryBasslineSpec> & { tap: any };
  width?: number;
  height?: number;
  nodeRadius?: number;
}

interface NodePosition {
  x: number;
  y: number;
}

// Simple force-directed layout
function computeLayout(
  instances: Record<string, any>,
  connections: Record<string, any>,
  width: number,
  height: number
): Record<string, NodePosition> {
  const names = Object.keys(instances);
  const positions: Record<string, NodePosition> = {};

  // Initial random positions
  names.forEach((name, i) => {
    const angle = (i / names.length) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.3;
    positions[name] = {
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius
    };
  });

  return positions;
}

export function BasslineGraph({
  bassline,
  width = 800,
  height = 600,
  nodeRadius = 30
}: BasslineGraphProps) {
  const [state, send] = useGadget(bassline);

  // Compute node positions
  const positions = computeLayout(state.instances, state.connections, width, height);

  return (
    <svg width={width} height={height} style={{ border: '1px solid #ccc' }}>
      {/* Draw connections first (underneath nodes) */}
      {Object.entries(state.connections).map(([id, conn]) => {
        const from = positions[conn.data.from];
        const to = positions[conn.data.to];

        if (!from || !to) return null;

        return (
          <g key={id}>
            {/* Connection line */}
            <line
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke="#666"
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />

            {/* Connection label */}
            <text
              x={(from.x + to.x) / 2}
              y={(from.y + to.y) / 2 - 5}
              textAnchor="middle"
              fontSize={12}
              fill="#666"
            >
              {conn.data.pattern || 'extract'}
            </text>

            {/* Delete button */}
            <circle
              cx={(from.x + to.x) / 2}
              cy={(from.y + to.y) / 2}
              r={8}
              fill="red"
              opacity={0}
              cursor="pointer"
              onClick={() => send({ disconnect: id })}
            >
              <title>Delete connection</title>
              <animate
                attributeName="opacity"
                values="0;0.8"
                dur="0.2s"
                begin="mouseover"
                fill="freeze"
              />
              <animate
                attributeName="opacity"
                values="0.8;0"
                dur="0.2s"
                begin="mouseout"
                fill="freeze"
              />
            </circle>
          </g>
        );
      })}

      {/* Draw nodes */}
      {Object.entries(state.instances).map(([name, gadget]) => {
        const pos = positions[name];
        if (!pos) return null;

        return (
          <g key={name} transform={`translate(${pos.x},${pos.y})`}>
            {/* Node circle */}
            <circle
              r={nodeRadius}
              fill="#4299e1"
              stroke="#2b6cb0"
              strokeWidth={2}
              cursor="move"
            />

            {/* Node label */}
            <text
              textAnchor="middle"
              dy={5}
              fill="white"
              fontSize={14}
              fontWeight="bold"
              pointerEvents="none"
            >
              {name}
            </text>

            {/* Node value */}
            <text
              textAnchor="middle"
              dy={nodeRadius + 15}
              fill="#333"
              fontSize={12}
            >
              {JSON.stringify(gadget.current()).slice(0, 20)}
            </text>

            {/* Delete button */}
            <circle
              cx={nodeRadius * 0.7}
              cy={-nodeRadius * 0.7}
              r={8}
              fill="red"
              opacity={0.8}
              cursor="pointer"
              onClick={() => send({ destroy: name })}
            >
              <title>Delete {name}</title>
            </circle>
            <text
              x={nodeRadius * 0.7}
              y={-nodeRadius * 0.7 + 4}
              textAnchor="middle"
              fill="white"
              fontSize={10}
              fontWeight="bold"
              pointerEvents="none"
            >
              ×
            </text>
          </g>
        );
      })}

      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="10"
          refY="5"
          orient="auto"
        >
          <path d="M 0 0 L 10 5 L 0 10 Z" fill="#666" />
        </marker>
      </defs>
    </svg>
  );
}