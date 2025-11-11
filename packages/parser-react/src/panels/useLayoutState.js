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
 * useLayoutState hook
 *
 * @param {string} layoutName - Unique name for this layout (used as localStorage key)
 * @param {Object} options - Configuration options
 * @param {boolean} [options.persist=true] - Whether to persist to localStorage
 * @param {Array} [options.defaultLayout] - Custom default layout
 * @returns {Object} Layout state and methods
 */
export function useLayoutState(layoutName, options = {}) {
    const { persist = true, defaultLayout: customDefault } = options;

    const storageKey = `bassline-layout-${layoutName}`;

    // Load initial layout from localStorage or use default
    const [layout, setLayout] = useState(() => {
        if (!persist) {
            return customDefault || getDefaultLayout(layoutName);
        }

        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Validate layout items
                if (Array.isArray(parsed) && parsed.every((item) => item.i && item.type)) {
                    return parsed;
                }
            }
        } catch (err) {
            console.warn(`Failed to load layout from localStorage:`, err);
        }

        return customDefault || getDefaultLayout(layoutName);
    });

    // Save to localStorage whenever layout changes
    useEffect(() => {
        if (persist) {
            try {
                localStorage.setItem(storageKey, JSON.stringify(layout));
            } catch (err) {
                console.warn(`Failed to save layout to localStorage:`, err);
            }
        }
    }, [layout, persist, storageKey]);

    /**
     * Add a new panel to the layout
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

            setLayout((prev) => [...prev, newPanel]);
            return panelId;
        },
        [layout]
    );

    /**
     * Remove a panel from the layout
     * @param {string} panelId - ID of panel to remove
     */
    const removePanel = useCallback((panelId) => {
        setLayout((prev) => prev.filter((item) => item.i !== panelId));
    }, []);

    /**
     * Update layout (called by react-grid-layout)
     * @param {Array} newLayout - New layout configuration
     */
    const updateLayout = useCallback((newLayout) => {
        // Preserve panel types when updating positions
        setLayout((prev) => {
            return newLayout.map((item) => {
                const existing = prev.find((p) => p.i === item.i);
                return {
                    ...item,
                    type: existing?.type || item.type,
                };
            });
        });
    }, []);

    /**
     * Reset layout to default
     */
    const resetLayout = useCallback(() => {
        const defaultLayout = customDefault || getDefaultLayout(layoutName);
        setLayout(defaultLayout);

        if (persist) {
            try {
                localStorage.removeItem(storageKey);
            } catch (err) {
                console.warn(`Failed to clear layout from localStorage:`, err);
            }
        }
    }, [layoutName, customDefault, persist, storageKey]);

    /**
     * Load a specific layout configuration
     * @param {Array} newLayout - Layout configuration to load
     */
    const loadLayout = useCallback((newLayout) => {
        if (Array.isArray(newLayout)) {
            setLayout(newLayout);
        }
    }, []);

    return {
        layout,
        setLayout,
        addPanel,
        removePanel,
        updateLayout,
        resetLayout,
        loadLayout,
    };
}
