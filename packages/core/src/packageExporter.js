import fs from "fs/promises";

/**
 * Export a compound gadget spec as a package definition
 * @param {Object} compoundSpec - The compound spec to export
 * @param {Object} options - Export options
 * @param {string} options.name - Package name (required)
 * @param {string} options.gadgetName - Name for the gadget (required)
 * @param {string} options.version - Package version (default: "1.0.0")
 * @param {string} options.description - Package description (optional)
 * @param {string} options.gadgetDescription - Gadget description (optional)
 * @param {Object} options.parameters - Parameter definitions with defaults (optional)
 * @returns {Object} Package definition object
 */
export function exportAsPackage(compoundSpec, options) {
    const {
        name,
        gadgetName,
        version = "1.0.0",
        description,
        gadgetDescription,
        parameters = {},
    } = options;

    if (!name) {
        throw new Error("Package name is required");
    }
    if (!gadgetName) {
        throw new Error("Gadget name is required");
    }

    // Extract template from compound spec
    const template = extractTemplate(compoundSpec);

    // Build package definition
    const packageDef = {
        name,
        version,
        ...(description && { description }),
        ...(template.imports && { imports: template.imports }),
        gadgets: {
            [gadgetName]: {
                ...(gadgetDescription && { description: gadgetDescription }),
                ...(Object.keys(parameters).length > 0 && { parameters }),
                template: {
                    gadgets: template.gadgets,
                    ...(template.interface && { interface: template.interface }),
                },
            },
        },
    };

    return packageDef;
}

/**
 * Extract template from compound spec, optionally parameterizing values
 * @param {Object} spec - Compound spec
 * @returns {Object} Template structure
 */
function extractTemplate(spec) {
    const { gadgets, imports, interface: iface } = spec.state || spec;

    const template = {
        ...(gadgets && { gadgets }),
        ...(imports && { imports }),
        ...(iface && { interface: iface }),
    };

    return template;
}

/**
 * Save a package definition to a JSON file
 * @param {Object} packageDef - Package definition object
 * @param {string} path - Path where to save the file
 * @returns {Promise<void>}
 */
export async function savePackage(packageDef, path) {
    try {
        const json = JSON.stringify(packageDef, null, 2);
        await fs.writeFile(path, json, "utf-8");
        console.log(`✅ Package saved to ${path}`);
    } catch (error) {
        throw new Error(`Failed to save package to ${path}: ${error.message}`);
    }
}

/**
 * Helper to parameterize values in a spec
 * Useful for converting concrete values to $parameters.name references
 * @param {Object} spec - Compound spec
 * @param {Object} paramMap - Map of paths to parameter names
 *   e.g., { "gadgets.threshold.state": "threshold" }
 * @returns {Object} Spec with parameterized values
 */
export function parameterizeSpec(spec, paramMap) {
    const result = JSON.parse(JSON.stringify(spec)); // Deep clone

    for (const [path, paramName] of Object.entries(paramMap)) {
        const parts = path.split(".");
        let obj = result;

        // Navigate to parent
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj[parts[i]];
            if (!obj) break;
        }

        // Set parameter reference
        if (obj) {
            obj[parts[parts.length - 1]] = `$parameters.${paramName}`;
        }
    }

    return result;
}
