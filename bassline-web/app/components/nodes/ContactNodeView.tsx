/**
 * ContactNodeView - Pure presentation component for contact nodes
 * No interaction logic, just visual rendering
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card } from '~/components/ui/card';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';
import { formatContentForDisplay, formatContentForTooltip } from '~/utils/content-display';
import type { Contradiction } from '~/propagation-core';

const nodeVariants = cva(
  "w-[60px] h-[40px] transition-all shadow-sm hover:shadow-md relative nopan",
  {
    variants: {
      nodeType: {
        contact: "node-gradient-contact node-border-contact",
        boundary: "node-gradient-boundary node-border-boundary"
      },
      selected: {
        true: "ring-2",
        false: ""
      },
      highlighted: {
        true: "ring-4 ring-blue-500 shadow-lg",
        false: ""
      },
      dimmed: {
        true: "opacity-30",
        false: ""
      }
    },
    compoundVariants: [
      {
        nodeType: "contact",
        selected: true,
        className: "node-ring-contact"
      },
      {
        nodeType: "boundary",
        selected: true,
        className: "node-ring-boundary"
      }
    ],
    defaultVariants: {
      nodeType: "contact",
      selected: false,
      highlighted: false,
      dimmed: false
    }
  }
);

export interface ContactNodeViewProps extends VariantProps<typeof nodeVariants> {
  content?: any;
  blendMode?: 'accept-last' | 'merge';
  isBoundary?: boolean;
  lastContradiction?: Contradiction | null;
  className?: string;
  valenceCompatible?: boolean;
  valenceSource?: boolean;
}

export const ContactNodeView = memo(({
  content,
  blendMode = 'accept-last',
  isBoundary = false,
  lastContradiction,
  selected = false,
  highlighted = false,
  dimmed = false,
  className,
  valenceCompatible = false,
  valenceSource = false,
}: ContactNodeViewProps) => {
  const nodeType = isBoundary ? 'boundary' : 'contact';
  
  return (
    <Card 
      className={cn(
        nodeVariants({ nodeType, selected, highlighted, dimmed }),
        lastContradiction && "ring-2 ring-red-500",
        valenceCompatible && "ring-2 ring-green-500 animate-pulse cursor-pointer",
        valenceSource && "ring-2 ring-blue-500",
        className
      )}
    >
      {/* Left and right visual borders */}
      <div className="absolute left-0 top-0 bottom-0 w-2 bg-muted/10" />
      <div className="absolute right-0 top-0 bottom-0 w-2 bg-muted/10" />
      
      {/* Visible handles like group nodes */}
      <Handle 
        type="target" 
        position={Position.Left}
        className="!w-4 !h-4 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
        style={{ 
          left: '-8px',
          background: isBoundary 
            ? 'linear-gradient(135deg, var(--node-boundary), color-mix(in oklch, var(--node-boundary), white 20%))' 
            : 'linear-gradient(135deg, var(--node-contact), color-mix(in oklch, var(--node-contact), white 20%))'
        }}
      />
      <Handle 
        type="source" 
        position={Position.Right}
        className="!w-4 !h-4 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
        style={{ 
          right: '-8px',
          background: isBoundary 
            ? 'linear-gradient(135deg, var(--node-boundary), color-mix(in oklch, var(--node-boundary), white 20%))' 
            : 'linear-gradient(135deg, var(--node-contact), color-mix(in oklch, var(--node-contact), white 20%))'
        }}
      />
      
      {/* Content */}
      <div className="absolute inset-0 flex items-center justify-center px-[10px]">
        {/* Blend mode indicator */}
        {blendMode === 'merge' && (
          <div className="absolute top-0.5 right-1.5 z-10">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 ring-1 ring-green-400/50" />
          </div>
        )}
        
        {/* Main content area */}
        <div 
          className={cn(
            "text-[9px] leading-[1.1] font-mono text-center break-all select-none overflow-hidden",
            "max-h-[32px] line-clamp-3",
            lastContradiction ? 'text-red-500 font-bold' : content === undefined ? 'text-muted-foreground' : 'text-foreground'
          )}
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            wordBreak: 'break-word'
          }}
          title={lastContradiction?.reason || (content !== undefined ? formatContentForTooltip(content) : undefined)}
        >
          {lastContradiction ? '⚠' : content !== undefined ? formatContentForDisplay(content) : '∅'}
        </div>
      </div>
    </Card>
  );
});

ContactNodeView.displayName = 'ContactNodeView';