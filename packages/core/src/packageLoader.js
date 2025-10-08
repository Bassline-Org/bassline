import { createCompoundProto } from "./compoundProto.js";
import { installPackage, bl } from "./index.js";
import fs from "fs/promises";

/**
 * Package Definition Schema:
 * {
 *   name: "@my/package",
 *   version: "1.0.0",
 *   description: "My custom gadgets",
 *   imports: {
 *     cells: "@bassline/cells/numeric",
 *     wire: "@bassline/relations"
 *   },
 *   gadgets: {
 *     myGadget: {
 *       description: "A custom gadget",
 *       parameters: { threshold: 10 },
 *       template: { gadgets: {...}, imports: {...}, interface: {...} }
 *     }
 *   }
 * }
 */

/**
 * Load a package definition and install it
 * @param {Object} packageDef - Package definition object
 * @returns {Object} The installed package context
 */
export function loadPackage(packageDef) {
    const { name, version, description, imports = {}, gadgets = {} } =
        packageDef;

    if (!name) {
        throw new Error("Package definition must have a name");
    }

    console.log(`Loading package ${name}${version ? `@${version}` : ""}...`);
    if (description) {
        console.log(`  ${description}`);
    }

    const packageContext = { gadgets: {} };

    // Create proto for each gadget definition
    for (const [gadgetName, gadgetDef] of Object.entries(gadgets)) {
        const { description: gadgetDesc, parameters = {}, template } =
            gadgetDef;

        if (!template) {
            throw new Error(
                `Gadget ${gadgetName} in package ${name} has no template`,
            );
        }

        // Merge package-level imports with gadget template imports
        const mergedTemplate = {
            ...template,
            imports: {
                ...imports,
                ...template.imports,
            },
        };

        // Create the proto
        const proto = createCompoundProto(mergedTemplate, {
            name: gadgetName,
            pkg: name,
            parameters,
        });

        // Add description metadata if provided
        if (gadgetDesc) {
            proto.description = gadgetDesc;
        }

        packageContext.gadgets[gadgetName] = proto;

        console.log(`  - ${gadgetName}${gadgetDesc ? `: ${gadgetDesc}` : ""}`);
    }

    // Install the package
    installPackage({
        name,
        gadgets: packageContext.gadgets,
    });

    console.log(`✅ Package ${name} loaded successfully!\n`);

    return packageContext;
}

/**
 * Load a package from a JSON file
 * @param {string} path - Path to package JSON file
 * @returns {Promise<Object>} The installed package context
 */
export async function loadPackageFromFile(path) {
    try {
        const content = await fs.readFile(path, "utf-8");
        const packageDef = JSON.parse(content);
        return loadPackage(packageDef);
    } catch (error) {
        throw new Error(`Failed to load package from ${path}: ${error.message}`);
    }
}

/**
 * Load multiple packages from JSON files
 * @param {string[]} paths - Paths to package JSON files
 * @returns {Promise<Object[]>} Array of installed package contexts
 */
export async function loadPackagesFromFiles(paths) {
    const results = [];
    for (const path of paths) {
        try {
            const pkg = await loadPackageFromFile(path);
            results.push(pkg);
        } catch (error) {
            console.error(error.message);
            throw error;
        }
    }
    return results;
}
