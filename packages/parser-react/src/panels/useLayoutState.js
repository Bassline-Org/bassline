/**
 * useLayoutState - Hook for persisting panel layout configurations
 *
 * Stores panel layouts in localStorage and provides methods for
 * managing panel positions, sizes, and configurations.
 */

import { useState, useCallback, useEffect } from "react";
import { getPanelById } from "./PanelRegistry.js";

/**
 * Get default layout configurations for common workspace types
 * @param {string} layoutName - Name of the layout
 * @returns {Array} Default layout configuration
 */
function getDefaultLayout(layoutName) {
    const defaults = {
        layers: [
            { i: "panel-1", type: "layer-list", x: 0, y: 0, w: 3, h: 12 },
            { i: "panel-2", type: "repl", x: 3, y: 0, w: 9, h: 12 },
        ],
        plugboard: [
            { i: "panel-1", type: "layer-list", x: 0, y: 0, w: 3, h: 12 },
            { i: "panel-2", type: "plugboard", x: 3, y: 0, w: 6, h: 6 },
            { i: "panel-3", type: "repl", x: 3, y: 6, w: 6, h: 6 },
        ],
        staging: [
            { i: "panel-1", type: "layer-list", x: 0, y: 0, w: 3, h: 12 },
            { i: "panel-2", type: "staging-commit", x: 3, y: 0, w: 9, h: 12 },
        ],
        full: [
            { i: "panel-1", type: "layer-list", x: 0, y: 0, w: 3, h: 12 },
            { i: "panel-2", type: "plugboard", x: 3, y: 0, w: 6, h: 6 },
            { i: "panel-3", type: "repl", x: 3, y: 6, w: 6, h: 6 },
            { i: "panel-4", type: "staging-commit", x: 9, y: 0, w: 3, h: 12 },
        ],
    };

    return defaults[layoutName] || [];
}

/**
 * Generate unique panel ID
 * @param {Array} layout - Current layout
 * @returns {string} Unique panel ID
 */
function generatePanelId(layout) {
    const ids = layout.map((item) => item.i);
    let counter = 1;
    while (ids.includes(`panel-${counter}`)) {
        counter++;
    }
    return `panel-${counter}`;
}

/**
 * useLayoutState hook - Supports multiple named views per workspace
 *
 * Storage structure:
 * {
 *   currentView: "default",
 *   views: {
 *     "default": [...layout],
 *     "debugging": [...layout],
 *     "presentation": [...layout]
 *   }
 * }
 *
 * @param {string} layoutName - Unique name for this workspace (used as localStorage key)
 * @param {Object} options - Configuration options
 * @param {boolean} [options.persist=true] - Whether to persist to localStorage
 * @param {Array} [options.defaultLayout] - Custom default layout
 * @returns {Object} Layout state and methods
 */
export function useLayoutState(layoutName, options = {}) {
    const { persist = true, defaultLayout: customDefault } = options;

    const storageKey = `bassline-layout-views-${layoutName}`;

    // Load all views and current view from localStorage
    const [views, setViews] = useState(() => {
        const defaultViewLayout = customDefault || getDefaultLayout(layoutName);

        if (!persist) {
            return { default: defaultViewLayout };
        }

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                // Validate structure
                if (data.views && typeof data.views === "object") {
                    return data.views;
                }
            }
        } catch (err) {
            console.warn(`Failed to load views from localStorage:`, err);
        }

        return { default: defaultViewLayout };
    });

    const [currentViewName, setCurrentViewName] = useState(() => {
        if (!persist) return "default";

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const data = JSON.parse(saved);
                if (data.currentView && views[data.currentView]) {
                    return data.currentView;
                }
            }
        } catch (err) {
            console.warn(`Failed to load current view from localStorage:`, err);
        }

        return "default";
    });

    // Get current layout from current view
    const layout = views[currentViewName] || views.default || [];

    // Save all views and current view whenever they change
    useEffect(() => {
        if (persist) {
            try {
                localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        currentView: currentViewName,
                        views,
                    })
                );
            } catch (err) {
                console.warn(`Failed to save views to localStorage:`, err);
            }
        }
    }, [views, currentViewName, persist, storageKey]);

    /**
     * Add a new panel to the current view's layout
     * @param {string} panelType - Type of panel to add (must exist in registry)
     * @returns {string|null} ID of added panel or null if failed
     */
    const addPanel = useCallback(
        (panelType) => {
            const panelDef = getPanelById(panelType);
            if (!panelDef) {
                console.warn(`Panel type "${panelType}" not found in registry`);
                return null;
            }

            const panelId = generatePanelId(layout);

            // Find next available position
            const maxY = layout.reduce((max, item) => Math.max(max, item.y + item.h), 0);

            const newPanel = {
                i: panelId,
                type: panelType,
                x: 0,
                y: maxY,
                w: panelDef.defaultSize.w,
                h: panelDef.defaultSize.h,
                minW: panelDef.defaultSize.minW,
                minH: panelDef.defaultSize.minH,
            };

            setViews((prevViews) => ({
                ...prevViews,
                [currentViewName]: [...(prevViews[currentViewName] || []), newPanel],
            }));

            return panelId;
        },
        [layout, currentViewName]
    );

    /**
     * Remove a panel from the current view's layout
     * @param {string} panelId - ID of panel to remove
     */
    const removePanel = useCallback(
        (panelId) => {
            setViews((prevViews) => ({
                ...prevViews,
                [currentViewName]: (prevViews[currentViewName] || []).filter(
                    (item) => item.i !== panelId
                ),
            }));
        },
        [currentViewName]
    );

    /**
     * Update layout (called by react-grid-layout)
     * Updates the current view's layout
     * @param {Array} newLayout - New layout configuration
     */
    const updateLayout = useCallback(
        (newLayout) => {
            // Preserve panel types when updating positions
            setViews((prevViews) => {
                const currentLayout = prevViews[currentViewName] || [];
                const updatedLayout = newLayout.map((item) => {
                    const existing = currentLayout.find((p) => p.i === item.i);
                    return {
                        ...item,
                        type: existing?.type || item.type,
                    };
                });

                return {
                    ...prevViews,
                    [currentViewName]: updatedLayout,
                };
            });
        },
        [currentViewName]
    );

    /**
     * Reset current view's layout to default
     */
    const resetLayout = useCallback(() => {
        const defaultLayout = customDefault || getDefaultLayout(layoutName);
        setViews((prevViews) => ({
            ...prevViews,
            [currentViewName]: defaultLayout,
        }));
    }, [layoutName, customDefault, currentViewName]);

    /**
     * Load a specific layout configuration into current view
     * @param {Array} newLayout - Layout configuration to load
     */
    const loadLayout = useCallback(
        (newLayout) => {
            if (Array.isArray(newLayout)) {
                setViews((prevViews) => ({
                    ...prevViews,
                    [currentViewName]: newLayout,
                }));
            }
        },
        [currentViewName]
    );

    /**
     * Save current layout as a new named view
     * @param {string} viewName - Name for the new view
     */
    const saveView = useCallback(
        (viewName) => {
            if (!viewName || !viewName.trim()) {
                console.warn("View name cannot be empty");
                return;
            }

            const trimmedName = viewName.trim();
            setViews((prevViews) => ({
                ...prevViews,
                [trimmedName]: layout,
            }));
        },
        [layout]
    );

    /**
     * Load a specific view by name
     * @param {string} viewName - Name of view to load
     */
    const loadView = useCallback(
        (viewName) => {
            if (views[viewName]) {
                setCurrentViewName(viewName);
            } else {
                console.warn(`View "${viewName}" not found`);
            }
        },
        [views]
    );

    /**
     * Delete a view by name (cannot delete default view)
     * @param {string} viewName - Name of view to delete
     */
    const deleteView = useCallback(
        (viewName) => {
            if (viewName === "default") {
                console.warn("Cannot delete default view");
                return;
            }

            setViews((prevViews) => {
                const newViews = { ...prevViews };
                delete newViews[viewName];
                return newViews;
            });

            // If we deleted the current view, switch to default
            if (currentViewName === viewName) {
                setCurrentViewName("default");
            }
        },
        [currentViewName]
    );

    /**
     * Get list of all view names
     * @returns {string[]} Array of view names
     */
    const getViewNames = useCallback(() => {
        return Object.keys(views);
    }, [views]);

    return {
        // Current layout
        layout,

        // Layout manipulation methods
        addPanel,
        removePanel,
        updateLayout,
        resetLayout,
        loadLayout,

        // View management
        currentViewName,
        views,
        saveView,
        loadView,
        deleteView,
        getViewNames,
    };
}
