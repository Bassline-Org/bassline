/**
 * Panels module - Dynamic panel composition system
 *
 * Exports:
 * - PanelRegistry: Panel definitions and registry
 * - PanelLayout: Dynamic grid layout component
 * - AddPanelMenu: Panel addition UI
 * - useLayoutState: Layout persistence hook
 */

export { PanelLayout } from "./PanelLayout.jsx";
export { AddPanelMenu } from "./AddPanelMenu.jsx";
export { useLayoutState } from "./useLayoutState.js";
export {
    PANEL_REGISTRY,
    getPanelById,
    getAllPanels,
    getPanelsByTag,
    isValidPanelConfig,
} from "./PanelRegistry.js";
