/**
 * Contact Protocol
 *
 * Provides identity and capability advertisement for Bassline runtimes
 */

// Generate unique runtime IDs
let runtimeIdCounter = 0;
function generateRuntimeId() {
    return `runtime-${Date.now()}-${runtimeIdCounter++}`;
}

/**
 * Detect runtime capabilities
 * @returns {Array<string>} List of capabilities
 */
export function detectCapabilities() {
    const capabilities = [];

    // Check if we're in browser or Node
    if (typeof window !== "undefined") {
        capabilities.push("browser");
        capabilities.push("view");
        capabilities.push("storage"); // localStorage
    }

    if (
        typeof process !== "undefined" && process.versions &&
        process.versions.node
    ) {
        capabilities.push("node");
        capabilities.push("file-system");
    }

    // Network capabilities
    if (typeof fetch !== "undefined") {
        capabilities.push("fetch");
    }

    // WebSocket support
    if (typeof WebSocket !== "undefined") {
        capabilities.push("websocket-client");
    }

    return capabilities;
}

/**
 * Create a contact (identity card for runtime)
 * @param {string} name - Human-readable name for this runtime
 * @param {Array<string>} endpoints - Connection endpoints (e.g., ["ws://localhost:8080"])
 * @param {Object} options - Additional options
 * @returns {Object} Contact object
 */
export function createContact(name, endpoints = [], options = {}) {
    const contact = {
        id: options.id || generateRuntimeId(),
        name: name || "Bassline Runtime",
        endpoints: endpoints || [],
        capabilities: options.capabilities || detectCapabilities(),
        timestamp: Date.now(),
        metadata: options.metadata || {},
    };

    return contact;
}

/**
 * Serialize contact to JSON
 * @param {Object} contact - Contact object
 * @returns {string} JSON string
 */
export function serializeContact(contact) {
    return JSON.stringify(contact, null, 2);
}

/**
 * Deserialize contact from JSON
 * @param {string} json - JSON string
 * @returns {Object} Contact object
 */
export function deserializeContact(json) {
    try {
        const contact = JSON.parse(json);

        // Validate required fields
        if (!contact.id || !contact.name) {
            throw new Error(
                "Invalid contact: missing required fields (id, name)",
            );
        }

        // Ensure arrays exist
        contact.endpoints = contact.endpoints || [];
        contact.capabilities = contact.capabilities || [];
        contact.metadata = contact.metadata || {};

        return contact;
    } catch (error) {
        throw new Error(`Failed to deserialize contact: ${error.message}`);
    }
}

/**
 * Validate a contact object
 * @param {Object} contact - Contact to validate
 * @returns {boolean} True if valid
 */
export function validateContact(contact) {
    if (!contact || typeof contact !== "object") {
        return false;
    }

    // Required fields
    if (!contact.id || typeof contact.id !== "string") {
        return false;
    }
    if (!contact.name || typeof contact.name !== "string") {
        return false;
    }

    // Endpoints must be an array
    if (!Array.isArray(contact.endpoints)) {
        return false;
    }

    // Capabilities must be an array
    if (!Array.isArray(contact.capabilities)) {
        return false;
    }

    return true;
}

/**
 * Check if contact has a specific capability
 * @param {Object} contact - Contact object
 * @param {string} capability - Capability to check
 * @returns {boolean} True if contact has capability
 */
export function hasCapability(contact, capability) {
    return contact.capabilities && contact.capabilities.includes(capability);
}

/**
 * Get a human-readable description of a contact
 * @param {Object} contact - Contact object
 * @returns {string} Description
 */
export function describeContact(contact) {
    const parts = [];
    parts.push(`Name: ${contact.name}`);
    parts.push(`ID: ${contact.id}`);

    if (contact.endpoints.length > 0) {
        parts.push(`Endpoints: ${contact.endpoints.join(", ")}`);
    } else {
        parts.push("Endpoints: none");
    }

    if (contact.capabilities.length > 0) {
        parts.push(`Capabilities: ${contact.capabilities.join(", ")}`);
    } else {
        parts.push("Capabilities: none");
    }

    return parts.join("\n");
}
