import { memo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Card } from '~/components/ui/card';
import { useNetworkState } from '~/propagation-react/contexts/NetworkState';
import { useSoundSystem } from '~/components/SoundSystem';
import { useSoundToast } from '~/hooks/useSoundToast';
import { Package, Trash2, Edit, Ungroup, Copy, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export const EnhancedGroupNode = memo(({ id, selected }: NodeProps) => {
  const { selectGroup, setCurrentGroup, state, removeGroup, inlineGroup } = useNetworkState();
  const { playSound } = useSoundSystem();
  const toast = useSoundToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  
  const group = state.groups[id];
  const name = group?.name || 'Group';
  const contactCount = group?.contactIds?.length || 0;
  const subgroupCount = group?.subgroupIds?.length || 0;
  const boundaryCount = group?.boundaryContactIds?.length || 0;
  
  // Check if group has any boundary contacts
  const hasInputs = group?.boundaryContactIds?.some(bid => 
    state.contacts[bid]?.boundaryDirection === 'input'
  ) || false;
  const hasOutputs = group?.boundaryContactIds?.some(bid => 
    state.contacts[bid]?.boundaryDirection === 'output'
  ) || false;
  
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
      {/* Input handles for boundary connections */}
      {hasInputs && (
        <Handle 
          type="target" 
          position={Position.Left}
          className="!w-4 !h-4 !rounded-sm !border-2 !border-green-500 !bg-green-500/20"
          style={{ left: '-8px' }}
        />
      )}
      
      {/* Output handles for boundary connections */}
      {hasOutputs && (
        <Handle 
          type="source" 
          position={Position.Right}
          className="!w-4 !h-4 !rounded-sm !border-2 !border-blue-500 !bg-blue-500/20"
          style={{ right: '-8px' }}
        />
      )}
      
      <div onClick={handleClick} onDoubleClick={handleDoubleClick} onContextMenu={handleContextMenu}>
        <Card 
          className={`
            min-w-[140px] min-h-[80px] transition-all shadow-md hover:shadow-lg relative
            bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20
            border-2 ${selected ? 'border-purple-500 ring-2 ring-purple-500/20' : 'border-purple-300 dark:border-purple-700'}
            cursor-pointer
          `}
        >
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Package className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <div className="font-semibold text-sm truncate flex-1">
                {name}
              </div>
            </div>
            
            <div className="space-y-1 text-xs text-muted-foreground">
              {contactCount > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <span>{contactCount} contact{contactCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {subgroupCount > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm bg-purple-400" />
                  <span>{subgroupCount} group{subgroupCount !== 1 ? 's' : ''}</span>
                </div>
              )}
              {boundaryCount > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full border-2 border-green-400" />
                  <span>{boundaryCount} boundar{boundaryCount !== 1 ? 'ies' : 'y'}</span>
                </div>
              )}
            </div>
            
            {/* Boundary indicators */}
            {(hasInputs || hasOutputs) && (
              <div className="absolute top-1 right-1 flex gap-1">
                {hasInputs && <ArrowDownLeft className="w-3 h-3 text-green-500" />}
                {hasOutputs && <ArrowUpRight className="w-3 h-3 text-blue-500" />}
              </div>
            )}
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

EnhancedGroupNode.displayName = 'EnhancedGroupNode';