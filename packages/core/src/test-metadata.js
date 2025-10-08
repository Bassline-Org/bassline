import { bl, installPackage } from "./index.js";
import { loadPackageFromFile } from "./packageLoader.js";
import { createPackageResolver } from "./packageResolver.js";
bl();

import cells from "./patterns/cells/index.js";
import refs from "./patterns/refs/index.js";
import relations from "./patterns/relations/relationGadgets.js";
import systems from "./patterns/systems/index.js";

installPackage(cells);
installPackage(refs);
installPackage(relations);
installPackage(systems);

console.log("=== Package Metadata Test ===\n");

// Load the package we created earlier
await loadPackageFromFile("/tmp/acme-filters.json");

// Create an instance
const resolver = createPackageResolver();
resolver.import("acme", "@acme/filters");

const filter = bl().fromSpec(
    { type: "acme.valueFilter", state: { threshold: 100 } },
    resolver,
);

console.log("Created filter instance");
console.log("Getting metadata...");

const metadata = filter.getMetadata();
console.log("\nMetadata:", JSON.stringify(metadata, null, 2));

console.log("\n✅ Gadgets now carry their package provenance!");
console.log(`   Package: ${metadata.packageName}@${metadata.version}`);
console.log(`   Description: ${metadata.description}`);
