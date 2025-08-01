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
              "w-12 h-12 shadow-sm rounded-sm border",
              "bg-card border-border hover:bg-accent/10",
              selected && "bg-accent/20 shadow-md ring-2 ring-accent",
              "transition-all duration-200",
              "flex items-center justify-center"
            )}
          >
            {/* Handles that work as both source and target */}
            <Handle
              type="source"
              position={Position.Left}
              id={`${contact.id}-left`}
              className="w-full h-full opacity-0"
              isConnectable={true}
            />
            <Handle
              type="target"
              position={Position.Left}
              id={`${contact.id}-left-target`}
              className="w-full h-full opacity-0"
              isConnectable={true}
            />
            <Handle
              type="source"
              position={Position.Right}
              id={`${contact.id}-right`}
              className="w-full h-full opacity-0"
              isConnectable={true}
            />
            <Handle
              type="target"
              position={Position.Right}
              id={`${contact.id}-right-target`}
              className="w-full h-full opacity-0"
              isConnectable={true}
            />
            
            {content !== null && content !== undefined ? (
              <div className="text-xs font-mono text-center pointer-events-none">
                {typeof content === 'object' ? '{}' : String(content).slice(0, 3)}
              </div>
            ) : (
              <div className="w-2 h-2 bg-muted rounded-sm pointer-events-none" />
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