import { bl } from "@bassline/core";
import type { GadgetSpec } from "../types";

interface PackageBrowserProps {
    onSpawn: (spec: GadgetSpec) => void;
}

export function PackageBrowser({ onSpawn }: PackageBrowserProps) {
    const { packages } = bl();

    // packages is a scope object with keys like "@bassline/cells/numeric/max"
    const packageList: Array<{ pkg: string; name: string; proto: any }> = [];

    // Iterate over all properties (excluding __promises and prototype methods)
    for (const key in packages) {
        if (key === '__promises' || !packages.hasOwnProperty(key)) continue;

        const proto = packages[key];
        // key format: "@bassline/cells/numeric/max"
        const lastSlash = key.lastIndexOf('/');
        const name = key.substring(lastSlash + 1);
        const pkg = key.substring(0, lastSlash);

        packageList.push({ pkg, name, proto });
    }

    return (
        <div className="space-y-1">
            <div className="text-xs text-gray-500 uppercase mb-2 px-2">
                Available Gadgets ({packageList.length})
            </div>
            {packageList.length === 0 ? (
                <div className="text-xs text-gray-500 px-2">
                    No packages installed
                </div>
            ) : (
                packageList.map(({ pkg, name, proto }) => {
                    const icon = getIconForPackage(pkg);
                    return (
                        <button
                            key={`${pkg}/${name}`}
                            onClick={() => onSpawn({ pkg, name, state: proto.defaultState || null })}
                            className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 flex items-center gap-2 text-sm"
                        >
                            <span>{icon}</span>
                            <span className="font-mono text-xs text-gray-700">{name}</span>
                        </button>
                    );
                })
            )}
        </div>
    );
}

function getIconForPackage(pkg: string): string {
    if (pkg.includes("systems")) return "📦";
    if (pkg.includes("numeric")) return "🔢";
    if (pkg.includes("tables")) return "📝";
    if (pkg.includes("set")) return "🎯";
    if (pkg.includes("relations")) return "🔗";
    if (pkg.includes("unsafe")) return "⚠️";
    return "◆";
}
