import type { ReactNode, CSSProperties } from 'react';
import { PanelLayout } from '../panels/PanelLayout.jsx';
import { AddPanelMenu } from '../panels/AddPanelMenu.jsx';
import { useLayoutState } from '../panels/useLayoutState.js';

/**
 * Workspace - Generic container for panel layouts
 *
 * Supports two modes:
 * 1. Static mode: Render JSX children directly (backward compatible)
 * 2. Dynamic mode: Use PanelLayout with layoutName for dynamic panel composition
 *
 * @param {Object} props
 * @param {ReactNode} [props.children] - Panel components to render (static mode)
 * @param {string} [props.layoutName] - Layout name for dynamic mode
 * @param {Object} [props.layoutOptions] - Options for useLayoutState
 * @param {boolean} [props.showControls=true] - Show Add Panel button and controls
 * @param {CSSProperties} [props.style] - Optional inline styles
 * @param {string} [props.className] - Optional CSS classes
 *
 * @example Static mode (backward compatible):
 * ```tsx
 * <Workspace>
 *   <div className="flex gap-4">
 *     <LayerListPanel />
 *     <ReplPanel />
 *   </div>
 * </Workspace>
 * ```
 *
 * @example Dynamic mode:
 * ```tsx
 * <Workspace layoutName="my-workspace" showControls={true} />
 * ```
 */
export interface WorkspaceProps {
    children?: ReactNode;
    layoutName?: string;
    layoutOptions?: any;
    showControls?: boolean;
    style?: CSSProperties;
    className?: string;
}

export function Workspace({
    children,
    layoutName,
    layoutOptions,
    showControls = true,
    style,
    className = '',
}: WorkspaceProps) {
    // If layoutName is provided, use dynamic PanelLayout
    if (layoutName) {
        const { addPanel, resetLayout, layout } = useLayoutState(layoutName, layoutOptions);

        const currentPanelTypes = layout.map((item) => item.type);

        return (
            <div
                className={`min-h-screen bg-slate-50 ${className}`}
                style={style}
            >
                {/* Workspace Header with Controls */}
                {showControls && (
                    <div className="border-b border-slate-200 bg-white px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900">
                                    {layoutName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                                </h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    {layout.length} panel{layout.length !== 1 ? 's' : ''} active
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={resetLayout}
                                    className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 transition-colors"
                                >
                                    Reset Layout
                                </button>
                                <AddPanelMenu
                                    onAddPanel={addPanel}
                                    currentPanels={currentPanelTypes}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Dynamic Panel Layout */}
                <div className="h-[calc(100vh-5rem)]">
                    <PanelLayout
                        layoutName={layoutName}
                        options={layoutOptions}
                    />
                </div>
            </div>
        );
    }

    // Otherwise, use static children mode (backward compatible)
    return (
        <div
            className={`min-h-screen bg-slate-50 ${className}`}
            style={style}
        >
            {children}
        </div>
    );
}
