import type { ReactNode, CSSProperties } from 'react';

/**
 * Workspace - Generic container for panel layouts
 *
 * Simple container that provides basic styling and structure for workspace views.
 * In Stage 4-8, layouts are hardcoded as JSX children.
 * In Stage 9+, this will be enhanced with dynamic layout capabilities.
 *
 * @param {Object} props
 * @param {ReactNode} props.children - Panel components to render
 * @param {CSSProperties} [props.style] - Optional inline styles
 * @param {string} [props.className] - Optional CSS classes
 *
 * @example
 * ```tsx
 * <WorkspaceProvider lc={lc}>
 *   <Workspace>
 *     <div className="flex gap-4">
 *       <div className="w-[30%]">
 *         <LayerListPanel />
 *       </div>
 *       <div className="w-[70%]">
 *         <ReplPanel />
 *       </div>
 *     </div>
 *   </Workspace>
 * </WorkspaceProvider>
 * ```
 */
export interface WorkspaceProps {
    children: ReactNode;
    style?: CSSProperties;
    className?: string;
}

export function Workspace({ children, style, className = '' }: WorkspaceProps) {
    return (
        <div
            className={`min-h-screen bg-slate-50 ${className}`}
            style={style}
        >
            {children}
        </div>
    );
}
