import { memo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Card } from '~/components/ui/card';
import { useNetworkState } from '~/propagation-react/contexts/NetworkState';
import { useSoundSystem } from '~/components/SoundSystem';
import { useSoundToast } from '~/hooks/useSoundToast';
import { Package, Trash2, Edit, Ungroup, Copy } from 'lucide-react';

interface GroupNodeData {
  name?: string;
  contactCount?: number;
}

export const SimpleGroupNode = memo(({ id, selected, data }: NodeProps<GroupNodeData>) => {
  const { selectGroup, setCurrentGroup, state, removeGroup, inlineGroup } = useNetworkState();
  const { playSound } = useSoundSystem();
  const toast = useSoundToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  const group = state.groups[id];
  const name = group?.name || 'Group';
  const contactCount = group?.contactIds?.length || 0;
  const subgroupCount = group?.subgroupIds?.length || 0;
  
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    if (event.button === 2) return; // Don't select on right click
    selectGroup(id, event.metaKey || event.ctrlKey);
    playSound('node/select');
  }, [id, selectGroup, playSound]);
  
  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setCurrentGroup(id);
    playSound('gadget/enter');
    toast.info(`Entering ${name}`);
  }, [id, setCurrentGroup, playSound, toast, name]);
  
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setMenuOpen(true);
  }, []);
  
  const handleDelete = useCallback(() => {
    removeGroup(id);
    playSound('gadget/delete');
    toast.success('Group deleted');
  }, [id, removeGroup, playSound, toast]);
  
  const handleInline = useCallback(() => {
    inlineGroup(id);
    playSound('gadget/delete');
    toast.success(`Inlined ${name} - contents moved to parent group`);
    setMenuOpen(false);
  }, [id, inlineGroup, playSound, toast, name]);
  
  return (
    <>
      {/* Visible handles for connections */}
      <Handle 
        type="target" 
        position={Position.Left}
        className="!w-4 !h-4 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
        style={{ 
          left: '-8px',
          background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
        }}
      />
      <Handle 
        type="source" 
        position={Position.Right}
        className="!w-4 !h-4 !rounded-sm !bg-gradient-to-br !from-background !to-muted !border !border-border !shadow-sm hover:!shadow-md !transition-all !z-10"
        style={{ 
          right: '-8px',
          background: 'linear-gradient(135deg, var(--node-group), color-mix(in oklch, var(--node-group), white 20%))'
        }}
      />
      
      <div onClick={handleClick} onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}>
        <Card 
          className={`
            w-[120px] h-[60px] transition-all shadow-sm hover:shadow-md relative nopan
            node-gradient-group node-border-group
            ${selected ? 'ring-2 node-ring-group' : ''}
            cursor-pointer
          `}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
            <Package className="w-5 h-5 mb-1 text-muted-foreground" />
            <div className="text-xs font-semibold text-center truncate w-full">
              {name}
            </div>
            <div className="text-[9px] text-muted-foreground">
              {contactCount} contact{contactCount !== 1 ? 's' : ''}
              {subgroupCount > 0 && `, ${subgroupCount} group${subgroupCount !== 1 ? 's' : ''}`}
            </div>
          </div>
        </Card>
      </div>
      
      {menuOpen && createPortal(
        <div
          className="fixed z-50"
          style={{ left: menuPosition.x, top: menuPosition.y }}
        >
          <div 
            className="fixed inset-0" 
            onClick={() => setMenuOpen(false)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpen(false);
            }}
          />
          <div className="relative bg-background border rounded-md shadow-lg p-1 min-w-[200px]">
            <button
              onClick={() => {
                setCurrentGroup(id);
                playSound('gadget/enter');
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <Package className="h-4 w-4" />
              Enter Group
            </button>
            <button
              onClick={() => {
                // Select the group for renaming
                selectGroup(id, false);
                toast.info('Edit name in properties panel');
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <Edit className="h-4 w-4" />
              Rename
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => {
                handleInline();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <Ungroup className="h-4 w-4" />
              Inline Group
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify({ groupId: id, name }));
                toast.success('Group copied');
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <Copy className="h-4 w-4" />
              Copy
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => {
                handleDelete();
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground rounded-sm"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

SimpleGroupNode.displayName = 'SimpleGroupNode';