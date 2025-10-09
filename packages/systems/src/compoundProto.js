import { compound } from "./compound.js";

/**
 * Creates a new compound prototype from a template
 * @param {Object} template - The compound structure (gadgets, imports, interface)
 * @param {Object} options - Configuration
 * @param {string} options.name - Name of the new gadget type
 * @param {string} options.pkg - Package namespace
 * @param {Object} options.parameters - Parameter definitions with defaults
 * @returns {Object} A new proto extending compound
 */
export function createCompoundProto(template, { name, pkg, parameters = {}, metadata = {} }) {
    const compoundProto = Object.create(compound);

    Object.assign(compoundProto, {
        name,
        pkg,
        parameters,
        metadata, // Store package metadata (version, description, etc.)

        afterSpawn(state) {
            // Resolve parameter references in template
            const resolved = this.resolveParameters(template, state);

            // Merge resolved template with any additional state
            const merged = this.deepMerge(resolved, state);

            // Call parent afterSpawn with resolved spec
            compound.afterSpawn.call(this, merged);
        },

        resolveParameters(obj, state) {
            // Handle parameter references like $parameters.threshold
            if (typeof obj === "string" && obj.startsWith("$parameters.")) {
                const paramName = obj.slice(12); // Remove "$parameters."

                // Look in provided state first, then defaults
                if (state[paramName] !== undefined) {
                    return state[paramName];
                }
                if (this.parameters[paramName] !== undefined) {
                    return this.parameters[paramName];
                }

                throw new Error(
                    `Parameter ${paramName} not provided and has no default`,
                );
            }

            // Recursively resolve in objects
            if (typeof obj === "object" && obj !== null && !Array.isArray(obj)) {
                return Object.fromEntries(
                    Object.entries(obj).map(([k, v]) => [
                        k,
                        this.resolveParameters(v, state),
                    ]),
                );
            }

            // Recursively resolve in arrays
            if (Array.isArray(obj)) {
                return obj.map((v) => this.resolveParameters(v, state));
            }

            return obj;
        },

        deepMerge(template, overrides) {
            // Start with template
            const result = { ...template };

            // Merge gadget states
            if (overrides.gadgets && template.gadgets) {
                result.gadgets = { ...template.gadgets };
                for (const [name, override] of Object.entries(
                    overrides.gadgets,
                )) {
                    if (template.gadgets[name]) {
                        // Merge state for existing gadget
                        result.gadgets[name] = {
                            ...template.gadgets[name],
                            state: {
                                ...template.gadgets[name].state,
                                ...override.state,
                            },
                        };
                    } else {
                        // New gadget not in template
                        result.gadgets[name] = override;
                    }
                }
            }

            // Override imports if provided
            if (overrides.imports) {
                result.imports = { ...template.imports, ...overrides.imports };
            }

            // Override interface if provided
            if (overrides.interface) {
                result.interface = {
                    ...template.interface,
                    ...overrides.interface,
                };
            }

            return result;
        },
    });

    return compoundProto;
}
