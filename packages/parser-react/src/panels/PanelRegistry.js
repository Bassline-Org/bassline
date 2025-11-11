/**
 * PanelRegistry - Maps panel types to components and metadata
 *
 * Provides a centralized registry of all available panels for
 * dynamic panel composition in workspaces.
 */

import { LayerListPanel } from "../components/LayerListPanel.jsx";
import { ReplPanel } from "../components/ReplPanel.jsx";
import { PlugboardPanel } from "../components/PlugboardPanel.jsx";
import { StagingCommitPanel } from "../components/StagingCommitPanel.jsx";

/**
 * Panel registry mapping panel IDs to components and metadata
 *
 * @typedef {Object} PanelDefinition
 * @property {string} id - Unique panel identifier
 * @property {string} name - Display name
 * @property {React.Component} component - Panel component
 * @property {string} icon - Emoji or icon character
 * @property {string} description - Short description
 * @property {Object} defaultSize - Default grid dimensions
 * @property {number} defaultSize.w - Width in grid units (out of 12)
 * @property {number} defaultSize.h - Height in grid units
 * @property {number} [defaultSize.minW] - Minimum width
 * @property {number} [defaultSize.minH] - Minimum height
 * @property {string[]} [tags] - Categorization tags
 */

export const PANEL_REGISTRY = {
    "layer-list": {
        id: "layer-list",
        name: "Layer List",
        component: LayerListPanel,
        icon: "📋",
        description: "Manage layers with add/remove and status display",
        defaultSize: {
            w: 3, // 25% width (3/12)
            h: 12, // Full height
            minW: 2,
            minH: 6,
        },
        tags: ["core", "layers"],
    },
    repl: {
        id: "repl",
        name: "REPL",
        component: ReplPanel,
        icon: "💬",
        description: "Interactive command execution on active layer",
        defaultSize: {
            w: 6, // 50% width (6/12)
            h: 6, // Half height
            minW: 3,
            minH: 4,
        },
        tags: ["core", "interactive"],
    },
    plugboard: {
        id: "plugboard",
        name: "Plugboard",
        component: PlugboardPanel,
        icon: "🔌",
        description: "Visual routing diagram with drag-and-drop connections",
        defaultSize: {
            w: 6, // 50% width (6/12)
            h: 6, // Half height
            minW: 4,
            minH: 5,
        },
        tags: ["visualization", "routing"],
    },
    "staging-commit": {
        id: "staging-commit",
        name: "Staging & Commits",
        component: StagingCommitPanel,
        icon: "📦",
        description: "Git-style version control with staging and branches",
        defaultSize: {
            w: 3, // 25% width (3/12)
            h: 12, // Full height
            minW: 3,
            minH: 8,
        },
        tags: ["core", "version-control"],
    },
};

/**
 * Get panel definition by ID
 * @param {string} id - Panel ID
 * @returns {PanelDefinition|null} Panel definition or null if not found
 */
export function getPanelById(id) {
    return PANEL_REGISTRY[id] || null;
}

/**
 * Get all available panel definitions
 * @returns {PanelDefinition[]} Array of all panel definitions
 */
export function getAllPanels() {
    return Object.values(PANEL_REGISTRY);
}

/**
 * Get panels filtered by tag
 * @param {string} tag - Tag to filter by
 * @returns {PanelDefinition[]} Array of matching panel definitions
 */
export function getPanelsByTag(tag) {
    return getAllPanels().filter((panel) => panel.tags?.includes(tag));
}

/**
 * Validate panel configuration
 * @param {Object} panelConfig - Panel configuration to validate
 * @returns {boolean} True if valid
 */
export function isValidPanelConfig(panelConfig) {
    if (!panelConfig || typeof panelConfig !== "object") return false;
    if (!panelConfig.type || !PANEL_REGISTRY[panelConfig.type]) return false;
    if (!panelConfig.i || typeof panelConfig.i !== "string") return false;
    return true;
}
