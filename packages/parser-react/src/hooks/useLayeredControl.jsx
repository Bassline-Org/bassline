import {
    createContext,
    useContext,
    useSyncExternalStore,
    useRef,
} from "react";

// =============================================================================
// SINGLETON EMPTY VALUES
// =============================================================================

const EMPTY_ARRAY = [];
const EMPTY_OBJECT = Object.freeze({});

// =============================================================================
// CONTEXT & PROVIDER
// =============================================================================

const LayeredControlContext = createContext(null);

/**
 * Provider component to make LayeredControl available to child components
 * @param {Object} props
 * @param {LayeredControl} props.value - The LayeredControl instance
 * @param {React.ReactNode} props.children
 */
export function LayeredControlProvider({ value, children }) {
    return (
        <LayeredControlContext.Provider value={value}>
            {children}
        </LayeredControlContext.Provider>
    );
}

// =============================================================================
// CORE ACCESS HOOKS
// =============================================================================

/**
 * Get the LayeredControl instance from context
 * @returns {LayeredControl} The LayeredControl instance
 * @throws {Error} If used outside of LayeredControlProvider
 */
export function useLayeredControl() {
    const lc = useContext(LayeredControlContext);
    if (!lc) {
        throw new Error(
            "useLayeredControl must be used within LayeredControlProvider"
        );
    }
    return lc;
}

/**
 * Get a specific layer's Control instance
 * @param {string | null} name - The layer name (null returns null)
 * @returns {Control | null} The Control instance for this layer, or null if name is null
 * @throws {Error} If layer not found (when name is not null)
 */
export function useLayer(name) {
    const lc = useLayeredControl();

    // Handle null case (no active layer)
    if (name === null || name === undefined) {
        return null;
    }

    const layer = lc.getLayer(name);
    if (!layer) {
        throw new Error(`Layer not found: ${name}`);
    }
    return layer.control;
}

// =============================================================================
// REACTIVE LIST HOOKS
// =============================================================================

/**
 * Get list of all layer names (reactive)
 * @returns {string[]} Array of layer names
 */
export function useLayers() {
    const lc = useLayeredControl();
    const cacheRef = useRef({ key: "", value: EMPTY_ARRAY });

    return useSyncExternalStore(
        (callback) => {
            lc.addEventListener("layer-added", callback);
            lc.addEventListener("layer-removed", callback);
            lc.addEventListener("bus-added", callback);

            return () => {
                lc.removeEventListener("layer-added", callback);
                lc.removeEventListener("layer-removed", callback);
                lc.removeEventListener("bus-added", callback);
            };
        },
        () => {
            const keys = Object.keys(lc.layers);
            const cacheKey = keys.join(",");

            if (cacheRef.current.key !== cacheKey) {
                cacheRef.current.key = cacheKey;
                cacheRef.current.value = keys;
            }

            return cacheRef.current.value;
        }
    );
}

/**
 * Get current routing configuration (reactive)
 * @returns {{from: string, to: string}[]} Array of routing connections
 */
export function useRouting() {
    const lc = useLayeredControl();
    const cacheRef = useRef({ key: "", value: EMPTY_ARRAY });

    return useSyncExternalStore(
        (callback) => {
            lc.addEventListener("routing-changed", callback);
            return () => lc.removeEventListener("routing-changed", callback);
        },
        () => {
            const routes = [];
            for (const [name, layer] of Object.entries(lc.layers)) {
                if (layer.output) {
                    routes.push({ from: name, to: layer.output });
                }
            }

            const cacheKey = routes.map((r) => `${r.from}-${r.to}`).join("|");
            if (cacheRef.current.key !== cacheKey) {
                cacheRef.current.key = cacheKey;
                cacheRef.current.value = routes;
            }

            return cacheRef.current.value;
        }
    );
}

// =============================================================================
// LAYER-SPECIFIC HOOKS
// =============================================================================

/**
 * Get all quads for a specific layer (reactive)
 * @param {string} layerName - The layer name
 * @returns {Quad[]} Array of quads in this layer (direct reference)
 * @throws {Error} If layer not found
 */
export function useLayerQuads(layerName) {
    const lc = useLayeredControl();
    const cacheRef = useRef({ length: -1, value: EMPTY_ARRAY });

    return useSyncExternalStore(
        (callback) => {
            const layer = lc.getLayer(layerName);
            if (!layer?.control) {
                return () => {};
            }
            const cleanup = layer.control.listen(callback);
            return cleanup;
        },
        () => {
            const layer = lc.getLayer(layerName);
            if (!layer?.control) {
                return EMPTY_ARRAY;
            }

            const quads = layer.control.graph.quads ?? EMPTY_ARRAY;

            // Cache based on array length (simple but effective)
            if (cacheRef.current.length !== quads.length) {
                cacheRef.current.length = quads.length;
                cacheRef.current.value = quads;
            }

            return cacheRef.current.value;
        }
    );
}

/**
 * Get staging information for a specific layer (reactive)
 * @param {string} layerName - The layer name
 * @returns {{count: number, hasChanges: boolean}} Staging info
 */
export function useStaging(layerName) {
    const lc = useLayeredControl();
    const cacheRef = useRef({
        count: -1,
        value: { count: 0, hasChanges: false },
    });

    return useSyncExternalStore(
        (callback) => {
            // Staging changes when quads are added
            const layer = lc.getLayer(layerName);
            if (!layer?.control) return () => {};

            const cleanup = layer.control.listen(callback);

            // Also listen for commits (which clear staging)
            const commitHandler = (e) => {
                if (e.detail.name === layerName) callback();
            };
            lc.addEventListener("committed", commitHandler);

            return () => {
                cleanup();
                lc.removeEventListener("committed", commitHandler);
            };
        },
        () => {
            const layer = lc.getLayer(layerName);
            const count = layer?.staging?.size ?? 0;

            if (cacheRef.current.count !== count) {
                cacheRef.current.count = count;
                cacheRef.current.value = {
                    count,
                    hasChanges: count > 0,
                };
            }

            return cacheRef.current.value;
        }
    );
}

/**
 * Get commit history for a specific layer (reactive)
 * @param {string} layerName - The layer name
 * @param {number} maxCount - Maximum number of commits to return (default 20)
 * @returns {Array<{hash, parent, message, timestamp, quadCount}>} Commit history
 */
export function useCommits(layerName, maxCount = 20) {
    const lc = useLayeredControl();
    const cacheRef = useRef({ key: "", value: EMPTY_ARRAY });

    return useSyncExternalStore(
        (callback) => {
            const handler = (e) => {
                if (
                    e.detail.name === layerName ||
                    e.detail.layerName === layerName
                ) {
                    callback();
                }
            };

            lc.addEventListener("committed", handler);
            lc.addEventListener("restored", handler);
            lc.addEventListener("branch-switched", handler);

            return () => {
                lc.removeEventListener("committed", handler);
                lc.removeEventListener("restored", handler);
                lc.removeEventListener("branch-switched", handler);
            };
        },
        () => {
            const commits = lc.getCommitHistory(layerName, maxCount);
            const cacheKey = `${commits.length}:${commits[0]?.hash ?? "empty"}`;

            if (cacheRef.current.key !== cacheKey) {
                cacheRef.current.key = cacheKey;
                cacheRef.current.value = commits;
            }

            return cacheRef.current.value;
        }
    );
}

/**
 * Get branch information for a specific layer (reactive)
 * @param {string} layerName - The layer name
 * @returns {{branches: string[], current: string|null}} Branch info
 */
export function useBranches(layerName) {
    const lc = useLayeredControl();
    const cacheRef = useRef({ key: "", value: EMPTY_OBJECT });

    return useSyncExternalStore(
        (callback) => {
            const handler = (e) => {
                if (e.detail.layerName === layerName) callback();
            };

            lc.addEventListener("branch-created", handler);
            lc.addEventListener("branch-deleted", handler);
            lc.addEventListener("branch-switched", handler);
            lc.addEventListener("head-detached", handler);

            return () => {
                lc.removeEventListener("branch-created", handler);
                lc.removeEventListener("branch-deleted", handler);
                lc.removeEventListener("branch-switched", handler);
                lc.removeEventListener("head-detached", handler);
            };
        },
        () => {
            const branches = lc.listBranches(layerName);
            const current = lc.getCurrentBranch(layerName);
            const cacheKey = `${branches.join(",")}:${current ?? "null"}`;

            if (cacheRef.current.key !== cacheKey) {
                cacheRef.current.key = cacheKey;
                cacheRef.current.value = {
                    branches,
                    current,
                };
            }

            return cacheRef.current.value;
        }
    );
}
