/// @bassline/views - Semantic View Extension
/// Extends gadgetProto to support multiple visual representations
/// Views are just metadata - same gadget, different rendering

import { bl } from "@bassline/core";

const { gadgetProto } = bl();

// Check if already installed
if (gadgetProto.setView) {
    console.log("✅ @bassline/views already installed");
} else {
    console.log("📦 Installing @bassline/views...");

    // Global view registry - Map<viewName, { Component, options }>
    const viewRegistry = new Map();

    // Default view (always available)
    viewRegistry.set("default", {
        Component: null, // null means use GadgetNode's default rendering
        options: {
            description: "Default JSON box view",
        },
    });

    // Extend all gadgets with view capabilities
    Object.assign(gadgetProto, {
        /**
         * Get current view name for this gadget instance
         * @returns {string} View name (defaults to "default")
         */
        getView() {
            return this._viewName || "default";
        },

        /**
         * Set view for this gadget instance
         * @param {string} viewName - Name of registered view
         */
        setView(viewName) {
            if (!viewRegistry.has(viewName)) {
                console.warn(`Unknown view: ${viewName}, using default`);
                this._viewName = "default";
            } else {
                this._viewName = viewName;
            }
            // Emit effect so UI can react
            this.emit({ viewChanged: { from: this._viewName, to: viewName } });
        },

        /**
         * Get view component for current view
         * @returns {React.Component|null} View component or null for default
         */
        getViewComponent() {
            const viewName = this.getView();
            const view = viewRegistry.get(viewName);
            return view?.Component || null;
        },

        /**
         * Get all available view names
         * @returns {string[]} Array of view names
         */
        getAvailableViews() {
            return Array.from(viewRegistry.keys());
        },

        /**
         * Get suggested views based on current state shape
         * @returns {string[]} Array of suggested view names
         */
        getSuggestedViews() {
            const state = this.current();
            const suggestions = ["default"];

            // Numeric data → bigNumber, gauge
            if (typeof state === "number") {
                if (viewRegistry.has("bigNumber")) {
                    suggestions.push("bigNumber");
                }
                if (viewRegistry.has("gauge")) suggestions.push("gauge");
            }

            // Array data → table, lineChart
            if (Array.isArray(state)) {
                if (viewRegistry.has("table")) suggestions.push("table");
                // Array of objects with numeric values → chart
                if (state.length > 0 && typeof state[0] === "object") {
                    if (viewRegistry.has("lineChart")) {
                        suggestions.push("lineChart");
                    }
                    if (viewRegistry.has("barChart")) {
                        suggestions.push("barChart");
                    }
                }
            }

            // Object with many keys → table
            if (
                typeof state === "object" &&
                state !== null &&
                !Array.isArray(state)
            ) {
                const keys = Object.keys(state);
                if (keys.length > 3 && viewRegistry.has("table")) {
                    suggestions.push("table");
                }
            }

            return suggestions;
        },
    });

    // Export registry for view registration
    gadgetProto.viewRegistry = viewRegistry;

    // Extend toSpec to include view metadata
    const originalToSpec = gadgetProto.toSpec;
    Object.assign(gadgetProto, {
        toSpec() {
            const spec = originalToSpec.call(this);
            // Include view name if it's not default
            if (this._viewName && this._viewName !== "default") {
                spec.view = this._viewName;
            }
            return spec;
        }
    });

    // Extend afterSpawn to restore view from spec
    const originalAfterSpawn = gadgetProto.afterSpawn;
    Object.assign(gadgetProto, {
        afterSpawn(initial) {
            // Call original afterSpawn
            if (originalAfterSpawn) {
                originalAfterSpawn.call(this, initial);
            }

            // Check if spec includes view metadata
            // In fromSpec, initial might be the whole spec object
            if (initial && typeof initial === "object" && initial.view) {
                this.setView(initial.view);
            }
        }
    });

    console.log("✅ @bassline/views installed");
}

/**
 * Register a view component
 * @param {string} name - View name (e.g., "bigNumber", "lineChart")
 * @param {React.Component} Component - React component to render
 * @param {Object} options - Optional metadata (description, etc.)
 */
export function registerView(name, Component, options = {}) {
    gadgetProto.viewRegistry.set(name, { Component, options });
    console.log(`📊 Registered view: ${name}`);
}

// Export registry for consumers
export const viewRegistry = gadgetProto.viewRegistry;
