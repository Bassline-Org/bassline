import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { Contact } from '~/models/types';
import { cn } from '~/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '~/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog';
import { Label } from '~/components/ui/label';
import { Input } from '~/components/ui/input';
import { Button } from '~/components/ui/button';
import { usePropagation } from '~/contexts/PropagationContext';
import { Trash2, Edit } from 'lucide-react';

export interface ContactNodeData {
  contact: Contact;
  selected?: boolean;
}

export const ContactNode = memo(({ data, selected }: NodeProps<ContactNodeData>) => {
  const { contact } = data;
  const content = contact.content?.value;
  const { updateContactContent, deleteContact } = usePropagation();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editValue, setEditValue] = useState(content || '');

  React.useEffect(() => {
    setEditValue(content || '');
  }, [content]);

  const handleSetContent = () => {
    updateContactContent(contact.id, editValue);
    setIsEditDialogOpen(false);
  };

  const handleDelete = () => {
    deleteContact(contact.id);
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            className={cn(
              "w-16 h-16 shadow-lg rounded-lg border-2",
              "bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900",
              "border-gray-300 dark:border-gray-600",
              "hover:shadow-xl hover:scale-105",
              selected && "ring-2 ring-blue-500 ring-offset-2 border-blue-500",
              "transition-all duration-200 cursor-grab active:cursor-grabbing",
              "flex items-center justify-center relative"
            )}
          >
            {/* Left side handles */}
            <Handle
              id={`${contact.id}-left-source`}
              type="source"
              position={Position.Left}
              className="!w-2 !h-2 !bg-blue-500 !-left-1"
              style={{ top: '35%' }}
              isConnectable={true}
            />
            <Handle
              id={`${contact.id}-left-target`}
              type="target"
              position={Position.Left}
              className="!w-2 !h-2 !bg-red-500 !-left-1"
              style={{ top: '65%' }}
              isConnectable={true}
            />
            {/* Right side handles */}
            <Handle
              id={`${contact.id}-right-source`}
              type="source"
              position={Position.Right}
              className="!w-2 !h-2 !bg-blue-500 !-right-1"
              style={{ top: '35%' }}
              isConnectable={true}
            />
            <Handle
              id={`${contact.id}-right-target`}
              type="target"
              position={Position.Right}
              className="!w-2 !h-2 !bg-red-500 !-right-1"
              style={{ top: '65%' }}
              isConnectable={true}
            />
            
            {content !== null && content !== undefined ? (
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 text-center pointer-events-none px-1">
                {typeof content === 'object' ? 
                  <span className="text-xs">{ JSON.stringify(content).slice(0, 10) }...</span> : 
                  String(content).slice(0, 5)
                }
              </div>
            ) : (
              <div className="w-3 h-3 bg-gray-300 dark:bg-gray-600 rounded-full pointer-events-none animate-pulse" />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48 bg-popover border-2 border-border rounded-md shadow-lg">
          <ContextMenuItem
            onClick={() => setIsEditDialogOpen(true)}
            className="flex items-center gap-2 hover:bg-accent/20 rounded-sm"
          >
            <Edit className="w-4 h-4" />
            Set Content
          </ContextMenuItem>
          <ContextMenuSeparator className="bg-border" />
          <ContextMenuItem
            onClick={handleDelete}
            className="flex items-center gap-2 hover:bg-destructive/20 text-destructive rounded-sm"
          >
            <Trash2 className="w-4 h-4" />
            Delete Contact
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-card border-2 border-border rounded-md shadow-xl">
          <DialogHeader>
            <DialogTitle className="font-bold">Set Contact Content</DialogTitle>
            <DialogDescription>
              Enter a value for this contact. It will be propagated through connected wires.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="content" className="font-semibold text-foreground">
                Content Value
              </Label>
              <Input
                id="content"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="border-2 border-input rounded-md focus:ring-2 focus:ring-ring"
                placeholder="Enter a value..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="border-2 border-border rounded-md hover:bg-accent/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetContent}
              className="bg-primary border-2 border-primary rounded-md hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              Set Value
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

ContactNode.displayName = 'ContactNode';