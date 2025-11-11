/**
 * PanelLayout - Dynamic panel composition using react-grid-layout
 *
 * Renders panels in a draggable, resizable grid layout with persistence.
 * Integrates with useLayoutState for configuration management.
 */

import { useCallback } from "react";
import { Responsive, WidthProvider } from "react-grid-layout";
import { getPanelById } from "./PanelRegistry.js";
import { useLayoutState } from "./useLayoutState.js";
import "react-grid-layout/css/styles.css";

const ResponsiveGridLayout = WidthProvider(Responsive);

/**
 * PanelWrapper - Wraps a panel with close button and error boundary
 */
function PanelWrapper({ panelId, panelType, onRemove, children }) {
    return (
        <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            {/* Panel header with close button */}
            <div className="flex-none flex items-center justify-between px-3 py-2 border-b border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                    <span className="text-lg">{getPanelById(panelType)?.icon}</span>
                    <span className="text-sm font-medium text-slate-700">
                        {getPanelById(panelType)?.name}
                    </span>
                </div>
                <button
                    onClick={() => onRemove(panelId)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                    title="Remove panel"
                >
                    ✕
                </button>
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">{children}</div>
        </div>
    );
}

/**
 * PanelLayout component
 *
 * @param {Object} props
 * @param {string} props.layoutName - Unique name for this layout
 * @param {Object} [props.options] - Options passed to useLayoutState
 * @param {Function} [props.onLayoutChange] - Callback when layout changes
 * @param {React.ReactNode} [props.header] - Optional header content (AddPanelMenu, etc.)
 * @returns {JSX.Element}
 */
export function PanelLayout({ layoutName, options, onLayoutChange, header }) {
    const { layout, updateLayout, removePanel } = useLayoutState(layoutName, options);

    const handleLayoutChange = useCallback(
        (newLayout) => {
            updateLayout(newLayout);
            onLayoutChange?.(newLayout);
        },
        [updateLayout, onLayoutChange]
    );

    // Convert layout config to react-grid-layout format
    const gridLayout = layout.map((item) => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
        minW: item.minW,
        minH: item.minH,
    }));

    return (
        <div className="h-full flex flex-col">
            {/* Optional header for controls */}
            {header && <div className="flex-none">{header}</div>}

            {/* Grid layout */}
            <div className="flex-1 overflow-auto">
                <ResponsiveGridLayout
                    className="layout"
                    layouts={{ lg: gridLayout }}
                    breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                    cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                    rowHeight={30}
                    onLayoutChange={handleLayoutChange}
                    isDraggable={true}
                    isResizable={true}
                    compactType="vertical"
                    preventCollision={false}
                >
                    {layout.map((item) => {
                        const panelDef = getPanelById(item.type);

                        if (!panelDef) {
                            return (
                                <div key={item.i} className="bg-red-50 p-4 rounded">
                                    <p className="text-red-600">
                                        Panel type "{item.type}" not found
                                    </p>
                                </div>
                            );
                        }

                        const PanelComponent = panelDef.component;

                        return (
                            <div key={item.i}>
                                <PanelWrapper
                                    panelId={item.i}
                                    panelType={item.type}
                                    onRemove={removePanel}
                                >
                                    <PanelComponent />
                                </PanelWrapper>
                            </div>
                        );
                    })}
                </ResponsiveGridLayout>
            </div>
        </div>
    );
}
