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
    console.log(`Installing...`);
    let lastPkg;
    for (const value of Object.values(gadgets)) {
        const pkg = value.pkg;
        const name = value.name;
        if (pkg !== lastPkg) {
            console.log(`Installing ${pkg}:`);
            lastPkg = pkg;
        }
        console.log(`  ${name}`);
        ensurePath(pkg);
        const context = bl().packages[pkg];
        context[name] = value;
    }
    console.log("Done!");
}

function ensurePath(path) {
    if (bl().packages[path] === undefined) {
        bl().packages[path] = {};
    }
}

export function fromSpec(spec) {
    if (Array.isArray(spec)) {
        return spec.map((s) => fromSpec(s));
    }
    const { pkg, name, state, id } = spec;
    if (!name) {
        throw new Error(`Name is required for spec: ${spec}`);
    }
    if (!pkg) {
        throw new Error(`Pkg is required for spec: ${spec}`);
    }
    const pkgContext = bl().packages[pkg];
    if (!pkgContext) {
        throw new Error(`Package ${pkg} not found! Did you install it?`);
    }
    const proto = pkgContext[name];
    if (!proto) {
        throw new Error(
            `Gadget ${name} not found in package ${pkg}! Did you install it?`,
        );
    }
    const g = proto.spawn(state);
    if (id && globalThis.bassline.registry !== undefined) {
        g._setId(id);
    }
    return g;
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
