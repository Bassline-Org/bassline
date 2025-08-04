/**
 * GroupNodeView - Pure presentation component for group/gadget nodes
 * No interaction logic, just visual rendering
 */

import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card, CardHeader, CardContent } from '~/components/ui/card';
import { Package, Lock } from 'lucide-react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '~/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '~/components/ui/tooltip';
import { getGadgetIcon } from '~/components/gadgets/gadget-icons';
import type { Contact } from '~/propagation-core';

const groupNodeVariants = cva(
  "transition-all shadow-md hover:shadow-lg nopan",
  {
    variants: {
      nodeType: {
        group: "node-gradient-group node-border-group min-w-[200px]",
        primitive: "node-gradient-primitive node-border-primitive w-fit"
      },
      selected: {
        true: "ring-2",
        false: ""
      },
      interactive: {
        true: "cursor-pointer",
        false: "cursor-default"
      },
      valenceCompatible: {
        true: "ring-2 ring-green-500 ring-opacity-50 animate-pulse",
        false: ""
      },
      valenceSource: {
        true: "ring-2 ring-blue-500 ring-opacity-75",
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
        nodeType: "group",
        selected: true,
        className: "node-ring-group"
      },
      {
        nodeType: "primitive",
        selected: true,
        className: "node-ring-primitive"
      }
    ],
    defaultVariants: {
      nodeType: "group",
      selected: false,
      interactive: true,
      valenceCompatible: false,
      valenceSource: false,
      highlighted: false,
      dimmed: false
    }
  }
);

export interface GroupNodeViewProps extends VariantProps<typeof groupNodeVariants> {
  name: string;
  inputContacts: Contact[];
  outputContacts: Contact[];
  isPrimitive?: boolean;
  className?: string;
}

export const GroupNodeView = memo(({
  name,
  inputContacts,
  outputContacts,
  isPrimitive = false,
  selected = false,
  interactive = !isPrimitive,
  valenceCompatible = false,
  valenceSource = false,
  highlighted = false,
  dimmed = false,
  className,
}: GroupNodeViewProps) => {
  const maxContacts = Math.max(inputContacts.length, outputContacts.length, 1);
  const nodeType = isPrimitive ? 'primitive' : 'group';
  
  // Get icon for primitive gadgets
  const PrimitiveIcon = isPrimitive ? getGadgetIcon(name) : null;
  
  return (
    <TooltipProvider>
      <Card 
        className={cn(
          groupNodeVariants({ 
            nodeType, 
            selected, 
            interactive,
            valenceCompatible: valenceCompatible && !valenceSource,
            valenceSource,
            highlighted,
            dimmed
          }), 
          isPrimitive && "p-[5px]",
          className
        )}
      >
        {isPrimitive ? (
          // Primitive gadgets - just show icon
          <CardContent className="p-0 pb-0 flex items-center justify-center w-[40px] h-[40px]">
            {PrimitiveIcon && <PrimitiveIcon className="w-6 h-6 text-[var(--node-primitive)]" />}
          </CardContent>
        ) : (
          // Regular gadgets - show header with name
          <CardHeader className="p-3 pb-2 border-b border-opacity-20">
            <div className="flex items-center gap-2">
              {!isPrimitive ? (
                <Package className={cn("w-4 h-4", "[&]:text-[var(--node-group)]")} />
              ) : (
                <Lock className={cn("w-4 h-4", "[&]:text-[var(--node-group)]")} />
              )}
              <div className="font-semibold text-sm select-none">{name}</div>
            </div>
          </CardHeader>
        )}
        {!isPrimitive && (
          <CardContent className="p-0">
            <div className="flex" style={{ minHeight: `${maxContacts * 28}px` }}>
              {/* Input contacts (left side) */}
              <div className="flex-1 flex flex-col border-r border-current border-opacity-20">
                {inputContacts.map((contact, index) => (
                  <div key={contact.id} className="relative flex items-center h-7">
                    <Handle
                      type="target"
                      position={Position.Left}
                      id={contact.id}
                      className="!w-6 !h-6 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                      style={{ 
                        left: '-12px',
                        background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
                      }}
                    />
                    <div className="pl-3 pr-2 w-full">
                      <span className="text-xs font-medium opacity-80 select-none">{contact.name || `in${index + 1}`}</span>
                    </div>
                  </div>
                ))}
                {inputContacts.length === 0 && (
                  <div className="flex-1 flex items-center justify-center min-h-[40px]">
                    <span className="text-xs italic opacity-50 select-none">no inputs</span>
                  </div>
                )}
              </div>
              
              {/* Output contacts (right side) */}
              <div className="flex-1 flex flex-col">
                {outputContacts.map((contact, index) => (
                  <div key={contact.id} className="relative flex items-center justify-end h-7">
                    <div className="pl-2 pr-3 w-full text-right">
                      <span className="text-xs font-medium opacity-80 select-none">{contact.name || `out${index + 1}`}</span>
                    </div>
                    <Handle
                      type="source"
                      position={Position.Right}
                      id={contact.id}
                      className="!w-6 !h-6 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                      style={{ 
                        right: '-12px',
                        background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
                      }}
                    />
                  </div>
                ))}
                {outputContacts.length === 0 && (
                  <div className="flex-1 flex items-center justify-center min-h-[40px]">
                    <span className="text-xs italic opacity-50 select-none">no outputs</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        )}
        
        {/* Primitive gadget handles with tooltips */}
        {isPrimitive && (
          <>
            {/* Input handles */}
            {inputContacts.map((contact, index) => (
              <Tooltip key={contact.id}>
                <TooltipTrigger asChild>
                  <Handle
                    type="target"
                    position={Position.Left}
                    id={contact.id}
                    className="!w-5 !h-5 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                    style={{ 
                      left: '-10px',
                      top: `${15 + index * 20}px`,
                      background: 'linear-gradient(135deg, var(--node-primitive), color-mix(in oklch, var(--node-primitive), white 20%))'
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p className="text-xs">{contact.name || `in${index + 1}`}</p>
                </TooltipContent>
              </Tooltip>
            ))}
            
            {/* Output handles */}
            {outputContacts.map((contact, index) => (
              <Tooltip key={contact.id}>
                <TooltipTrigger asChild>
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={contact.id}
                    className="!w-5 !h-5 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all"
                    style={{ 
                      right: '-10px',
                      top: `${15 + index * 20}px`,
                      background: 'linear-gradient(135deg, var(--node-primitive), color-mix(in oklch, var(--node-primitive), white 20%))'
                    }}
                  />
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p className="text-xs">{contact.name || `out${index + 1}`}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </>
        )}
      </Card>
    </TooltipProvider>
  );
});

GroupNodeView.displayName = 'GroupNodeView';