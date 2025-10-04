// components/Gadget.tsx
import { useGadget } from '@bassline/react';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from './ui/context-menu';

export function Gadget({ gadget, children, onInspect }) {
    const [value, send] = useGadget(gadget);

    return (
        <ContextMenu>
            <ContextMenuTrigger asChild>
                <div>
                    {children}
                </div>
            </ContextMenuTrigger>

            <ContextMenuContent>
                <ContextMenuItem onClick={() => onInspect?.(gadget)}>
                    🔍 Inspect
                </ContextMenuItem>
                <ContextMenuItem onClick={() => navigator.clipboard.writeText(JSON.stringify(value))}>
                    📋 Copy Value
                </ContextMenuItem>
            </ContextMenuContent>
        </ContextMenu>
    );
}