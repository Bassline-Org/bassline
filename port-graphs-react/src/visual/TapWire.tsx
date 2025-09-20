/**
 * Visual wire component showing connections between gadgets
 */

import React from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface TapWireProps {
  start: Point;
  end: Point;
  active?: boolean;
  className?: string;
  strokeWidth?: number;
  animated?: boolean;
}

export function TapWire({
  start,
  end,
  active = false,
  className,
  strokeWidth = 2,
  animated = false
}: TapWireProps) {
  // Calculate control points for a smooth curved wire
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  // Control points for cubic bezier curve
  const cp1x = start.x + Math.abs(dx) * 0.5;
  const cp1y = start.y;
  const cp2x = end.x - Math.abs(dx) * 0.5;
  const cp2y = end.y;

  const pathData = `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`;

  return (
    <g className={className}>
      {/* Drop shadow for depth */}
      <path
        d={pathData}
        stroke="rgba(0,0,0,0.1)"
        strokeWidth={strokeWidth + 1}
        fill="none"
        transform="translate(1,1)"
      />

      {/* Main wire */}
      <path
        d={pathData}
        stroke={active ? '#f59e0b' : '#6b7280'}
        strokeWidth={strokeWidth}
        fill="none"
        className={`transition-all duration-200 ${active ? 'stroke-yellow-500' : 'stroke-gray-500'}`}
        strokeDasharray={animated ? '5,5' : undefined}
        style={{
          animation: animated ? 'dash 1s linear infinite' : undefined,
        }}
      />

      {/* Data flow indicator (small circle) */}
      {animated && (
        <circle
          r="3"
          fill={active ? '#f59e0b' : '#6b7280'}
          className="opacity-75"
        >
          <animateMotion
            dur="2s"
            repeatCount="indefinite"
            path={pathData}
          />
        </circle>
      )}

      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -10;
          }
        }
      `}</style>
    </g>
  );
}

export interface TapWireCanvasProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Canvas container for rendering tap wires
 */
export function TapWireCanvas({ children, className }: TapWireCanvasProps) {
  return (
    <svg
      className={`absolute inset-0 pointer-events-none w-full h-full ${className || ''}`}
      style={{ zIndex: 10 }}
    >
      {children}
    </svg>
  );
}