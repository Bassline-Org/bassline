import { bl } from "./index.js";

/**
 * Creates a package resolver for type-to-proto resolution
 * @param {Object} parent - Optional parent resolver for inheritance
 * @returns {Object} Resolver with import() and resolve() methods
 */
export function createPackageResolver(parent = null) {
    const imports = {};

    return {
        /**
         * Register a package alias
         * @param {string} alias - Short alias (e.g., "cells")
         * @param {string} fullPath - Full package path (e.g., "@bassline/cells/numeric")
         */
        import(alias, fullPath) {
            imports[alias] = fullPath;
        },

        /**
         * Resolve a type reference to { pkg, name }
         * @param {string} typeRef - Type reference to resolve
         * @returns {{ pkg: string, name: string }} Resolved package and name
         *
         * Supports three formats:
         * - "max" -> searches in imports
         * - "cells.max" -> alias.name
         * - "@bassline/cells/numeric.max" -> full.package.path.name
         */
        resolve(typeRef) {
            // Handle dotted names (alias.name or full.pkg.path.name)
            if (typeRef.includes(".")) {
                const parts = typeRef.split(".");
                const name = parts.pop();
                const pkgOrAlias = parts.join(".");

                // Check if it's an alias in our imports
                const pkg = imports[pkgOrAlias] || pkgOrAlias;
                return { pkg, name };
            }

            // Bare name - search in imports
            for (const [alias, fullPkg] of Object.entries(imports)) {
                const pkgContext = bl().packages[fullPkg];
                if (pkgContext && pkgContext[typeRef]) {
                    return { pkg: fullPkg, name: typeRef };
                }
            }

            // Try parent resolver
            if (parent) {
                return parent.resolve(typeRef);
            }

            throw new Error(`Type not found: ${typeRef}`);
        },

        /**
         * Get all imports
         * @returns {Object} Current imports map
         */
        getImports() {
            return { ...imports };
        },
    };
}

/**
 * Global default package resolver
 * Can be used to register commonly-used imports
 */
export const defaultPackageResolver = createPackageResolver();
