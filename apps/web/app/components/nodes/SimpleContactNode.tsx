import { memo, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import type { NodeProps } from '@xyflow/react';
import { ContactNodeView } from './ContactNodeView';
import { useContactState } from '~/propagation-react/hooks/useContactState';
import { useNetworkState } from '~/propagation-react/contexts/NetworkState';
import { useSoundSystem } from '~/components/SoundSystem';
import { useSoundToast } from '~/hooks/useSoundToast';
import { Contradiction } from '~/propagation-core/types';
import { Copy, Trash2, Package, ArrowRightLeft, Group } from 'lucide-react';
import { useValenceMode } from '~/propagation-react/hooks/useValenceMode';

export const SimpleContactNode = memo(({ id, selected }: NodeProps) => {
  const { content, blendMode, isBoundary, lastContradiction, setBlendMode, setBoundary } = useContactState(id);
  const { selectContact, removeContact } = useNetworkState();
  const { playSound } = useSoundSystem();
  const toast = useSoundToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const { handleContactClick, isValenceMode, isValenceSource, isValenceTarget } = useValenceMode();
  
  const handleClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    // Don't handle clicks if it's a right click
    if (event.button === 2) return;
    
    // Handle valence mode clicks
    if (handleContactClick(id)) {
      return;
    }
    
    // Normal selection
    selectContact(id, event.metaKey || event.ctrlKey);
    playSound('node/select');
  }, [id, selectContact, playSound, handleContactClick]);
  
  const handleDelete = useCallback(() => {
    removeContact(id);
    playSound('node/delete');
    toast.success('Contact deleted');
  }, [id, removeContact, playSound, toast]);
  
  const handleToggleBlendMode = useCallback(() => {
    const newMode = blendMode === 'accept-last' ? 'merge' : 'accept-last';
    setBlendMode(newMode);
    playSound('ui/toggle');
    toast.success(`Blend mode: ${newMode === 'accept-last' ? 'Accept Last' : 'Merge'}`);
  }, [blendMode, setBlendMode, playSound, toast]);
  
  const handleToggleBoundary = useCallback(() => {
    setBoundary(!isBoundary, 'input');
    playSound('ui/boundary-create');
    toast.success(isBoundary ? 'Contact is no longer a boundary' : 'Contact is now a boundary');
  }, [isBoundary, setBoundary, playSound, toast]);
  
  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setMenuOpen(true);
  }, []);
  
  return (
    <>
      <div onClick={handleClick} onContextMenu={handleContextMenu} style={{ cursor: 'pointer' }}>
        <ContactNodeView
          content={content}
          blendMode={blendMode}
          isBoundary={isBoundary}
          lastContradiction={lastContradiction ? new Contradiction(lastContradiction.reason) : null}
          selected={selected}
          highlighted={false}
          dimmed={false}
          valenceCompatible={isValenceTarget(id)}
          valenceSource={isValenceSource(id)}
        />
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
                handleToggleBlendMode();
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Toggle Blend Mode
            </button>
            <button
              onClick={() => {
                handleToggleBoundary();
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <Package className="h-4 w-4" />
              {isBoundary ? 'Remove Boundary' : 'Make Boundary'}
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => {
                navigator.clipboard.writeText(content || '');
                toast.success('Content copied');
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <Copy className="h-4 w-4" />
              Copy Content
            </button>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => {
                // Extract to group will be handled by selection and keyboard shortcut
                selectContact(id, false);
                toast.info('Press G to create a group from selection');
                setMenuOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm"
            >
              <Group className="h-4 w-4" />
              Extract to Group
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

SimpleContactNode.displayName = 'SimpleContactNode';