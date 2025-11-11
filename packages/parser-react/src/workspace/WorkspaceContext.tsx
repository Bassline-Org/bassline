import { createContext, useContext, useState, type ReactNode } from 'react';
import type { LayeredControl } from '@bassline/parser/control';
import { LayeredControlProvider } from '@bassline/parser-react/hooks';

/**
 * Workspace Context - Shared state for workspace views
 *
 * Provides:
 * - Active layer state (which layer is currently selected/focused)
 * - Setter for active layer
 *
 * Note: LayeredControl instance is provided by LayeredControlProvider (wrapped inside)
 *
 * This enables panels to:
 * - Access the same LC instance via useLayeredControl()
 * - React to active layer changes via useWorkspace()
 * - Update active layer (e.g., clicking in LayerListPanel)
 */
export interface WorkspaceContextValue {
    activeLayer: string | null;
    setActiveLayer: (name: string | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export interface WorkspaceProviderProps {
    lc: LayeredControl;
    children: ReactNode;
    initialActiveLayer?: string | null;
}

/**
 * WorkspaceProvider - Context provider for workspace views
 *
 * Wraps workspace layouts with both LayeredControlProvider and workspace state.
 * This provides:
 * - LayeredControl instance (via LayeredControlProvider)
 * - Active layer state (via WorkspaceContext)
 *
 * @example
 * ```tsx
 * const lc = new LayeredControl();
 *
 * <WorkspaceProvider lc={lc}>
 *   <Workspace>
 *     <LayerListPanel />
 *     <ReplPanel />
 *   </Workspace>
 * </WorkspaceProvider>
 * ```
 */
export function WorkspaceProvider({
    lc,
    children,
    initialActiveLayer = null
}: WorkspaceProviderProps) {
    const [activeLayer, setActiveLayer] = useState<string | null>(initialActiveLayer);

    return (
        <LayeredControlProvider value={lc}>
            <WorkspaceContext.Provider value={{ activeLayer, setActiveLayer }}>
                {children}
            </WorkspaceContext.Provider>
        </LayeredControlProvider>
    );
}

/**
 * useWorkspace - Hook to access workspace context
 *
 * Must be used within a WorkspaceProvider.
 *
 * Note: To access the LayeredControl instance, use `useLayeredControl()` hook instead.
 *
 * @returns WorkspaceContextValue with activeLayer and setActiveLayer
 * @throws Error if used outside WorkspaceProvider
 *
 * @example
 * ```tsx
 * import { useWorkspace } from '@bassline/parser-react';
 * import { useLayeredControl } from '@bassline/parser-react/hooks';
 *
 * function MyPanel() {
 *   const lc = useLayeredControl();              // Get LC instance
 *   const { activeLayer, setActiveLayer } = useWorkspace();  // Get workspace state
 *
 *   return (
 *     <div>
 *       <p>Active: {activeLayer || 'None'}</p>
 *       <button onClick={() => setActiveLayer('main')}>
 *         Select main
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useWorkspace(): WorkspaceContextValue {
    const context = useContext(WorkspaceContext);
    if (!context) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
