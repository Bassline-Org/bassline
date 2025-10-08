/**
 * Creates a scope - a namespace for gadgets with optional parent chaining
 * @param {Scope} parent - Optional parent scope for nested lookups
 * @returns {Scope} A scope object with get/set/has methods
 */
export function createScope(parent = null) {
    const local = new Map();

    return {
        // Resolver interface - check local first, then parent
        get(name) {
            const value = local.get(name);
            if (value !== undefined) return value;
            return parent?.get(name);
        },

        set(name, value) {
            local.set(name, value);
        },

        has(name) {
            return local.has(name) || parent?.has(name);
        },

        entries() {
            return local.entries();
        },

        values() {
            return local.values();
        },

        // Create a child scope with this as parent
        createChild() {
            return createScope(this);
        },
    };
}
