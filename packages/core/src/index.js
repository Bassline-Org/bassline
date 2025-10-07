export * from "./gadget.js";
import { installBassline } from "./gadget.js";

export function bl() {
    if (globalThis.bassline === undefined) {
        installBassline();
    }
    return globalThis.bassline;
}

/**
 * Installs a package into the running system
 * Packges are objects with an optional gadgets property
 * The gadgets property is an object with the gadget constructors to install
 * Each constructor must have a pkg property on it's prototype
 * @param {*} gadgetPackage - The package to install
 * @example
 * import { installPackage } from "@bassline/core";
 *
 * const myCell = Object.create(bl().gadgetProto);
 * Object.assign(myCell, {
 *     pkg: "my.package",
 *     name: "myCell",
 *     step(c, i) { ... }
 * });
 *
 * installPackage({
 *     gadgets: {
 *         myCell
 *     },
 * });
 */
export function installPackage(gadgetPackage) {
    const { gadgets } = gadgetPackage;
    for (const value of Object.values(gadgets)) {
        const pkg = value.pkg;
        const name = value.name;
        console.log(`Installing: ${pkg}.${name}`);
        ensurePath(pkg);
        const context = bl().gadgets[pkg];
        context[name] = value;
        console.log(`Installed: ${pkg}.${name}`);
    }
}

function ensurePath(path) {
    if (bl().gadgets[path] === undefined) {
        bl().gadgets[path] = {};
    }
}

export function fromSpec(spec) {
    const { pkg, name, state } = spec;
    if (!name) {
        throw new Error(`Name is required for spec: ${spec}`);
    }
    if (!pkg) {
        throw new Error(`Pkg is required for spec: ${spec}`);
    }
    const pkgContext = bl().gadgets[pkg];
    if (!pkgContext) {
        throw new Error(`Package ${pkg} not found! Did you install it?`);
    }
    const proto = pkgContext[name];
    if (!proto) {
        throw new Error(
            `Gadget ${name} not found in package ${pkg}! Did you install it?`,
        );
    }
    return proto.spawn(state);
}

Object.assign(bl().gadgetProto, {
    toSpec() {
        return {
            pkg: this.pkg,
            name: this.name,
            state: this.current(),
        };
    },
});

globalThis.bl = bl;
globalThis.bassline.installPackage = installPackage;
globalThis.bassline.fromSpec = fromSpec;
