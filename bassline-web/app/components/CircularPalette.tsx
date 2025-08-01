import React, { useEffect, useRef } from 'react';
import { cn } from '~/lib/utils';
import type { GadgetTemplate } from '~/models/Gadget';

interface CircularPaletteProps {
  isOpen: boolean;
  position: { x: number; y: number };
  gadgets: GadgetTemplate[];
  onSelect: (gadget: GadgetTemplate) => void;
  onClose: () => void;
}

export const CircularPalette: React.FC<CircularPaletteProps> = ({
  isOpen,
  position,
  gadgets,
  onSelect,
  onClose
}) => {
  const paletteRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isOpen) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  const radius = 120;
  const angleStep = (2 * Math.PI) / gadgets.length;
  
  return (
    <div
      ref={paletteRef}
      className="absolute z-50"
      style={{
        left: position.x - radius,
        top: position.y - radius,
        width: radius * 2,
        height: radius * 2,
      }}
    >
      {/* Center point */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full" />
      
      {/* Gadget items arranged in a circle */}
      {gadgets.map((gadget, index) => {
        const angle = index * angleStep - Math.PI / 2; // Start from top
        const x = Math.cos(angle) * radius + radius;
        const y = Math.sin(angle) * radius + radius;
        
        return (
          <button
            key={gadget.id}
            className={cn(
              "absolute transform -translate-x-1/2 -translate-y-1/2",
              "w-16 h-16 rounded-full",
              "bg-card border-2 border-border",
              "hover:bg-accent hover:scale-110",
              "transition-all duration-200",
              "flex items-center justify-center",
              "text-2xl font-bold",
              "shadow-md hover:shadow-lg",
              "group"
            )}
            style={{
              left: x,
              top: y,
            }}
            onClick={() => {
              onSelect(gadget);
              onClose();
            }}
            title={gadget.name}
          >
            <span className="pointer-events-none">
              {gadget.icon || gadget.name.charAt(0)}
            </span>
            
            {/* Tooltip */}
            <div className={cn(
              "absolute bottom-full mb-2 px-2 py-1",
              "bg-popover border border-border rounded-md",
              "text-xs font-normal whitespace-nowrap",
              "opacity-0 group-hover:opacity-100",
              "transition-opacity duration-200",
              "pointer-events-none"
            )}>
              <div className="font-semibold">{gadget.name}</div>
              {gadget.description && (
                <div className="text-muted-foreground">{gadget.description}</div>
              )}
            </div>
          </button>
        );
      })}
      
      {/* Visual circle guide */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={radius * 2}
        height={radius * 2}
      >
        <circle
          cx={radius}
          cy={radius}
          r={radius - 40}
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 4"
          opacity="0.2"
        />
      </svg>
    </div>
  );
};