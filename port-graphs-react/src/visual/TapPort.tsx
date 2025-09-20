/**
 * Visual port component for gadgets - represents input/output connection points
 */

import React from 'react';

export interface TapPortProps {
  type: 'input' | 'output';
  position: 'top' | 'bottom' | 'left' | 'right';
  connected?: boolean;
  active?: boolean;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onMouseUp?: (e: React.MouseEvent) => void;
  className?: string;
  label?: string;
}

export function TapPort({
  type,
  position,
  connected = false,
  active = false,
  onClick,
  onMouseDown,
  onMouseUp,
  className,
  label
}: TapPortProps) {
  // Build classes with simple string concatenation
  const positionClasses = {
    top: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
    bottom: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2',
    left: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2',
    right: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2'
  };

  const getTypeClasses = () => {
    if (active) return 'border-yellow-500 bg-yellow-200 scale-125';
    if (connected) {
      return type === 'input' ? 'border-blue-600 bg-blue-500' : 'border-green-600 bg-green-500';
    }
    return type === 'input' ? 'border-blue-500 bg-blue-100' : 'border-green-500 bg-green-100';
  };

  const baseClasses = [
    'absolute w-3 h-3 rounded-full border-2 transition-all duration-200',
    'hover:scale-125 cursor-pointer',
    positionClasses[position],
    getTypeClasses(),
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={baseClasses}
      onClick={onClick}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      title={label}
    >
      {/* Optional label */}
      {label && (
        <div className={[
          'absolute text-xs font-medium whitespace-nowrap pointer-events-none',
          position === 'top' ? 'top-full mt-1 left-1/2 -translate-x-1/2' : '',
          position === 'bottom' ? 'bottom-full mb-1 left-1/2 -translate-x-1/2' : '',
          position === 'left' ? 'right-full mr-1 top-1/2 -translate-y-1/2' : '',
          position === 'right' ? 'left-full ml-1 top-1/2 -translate-y-1/2' : '',
        ].filter(Boolean).join(' ')}>
          {label}
        </div>
      )}
    </div>
  );
}