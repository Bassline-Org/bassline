import { useEffect, useMemo, useRef, useState } from "react";
import { bl, fromSpec, installPackage } from "@bassline/core";
import cells from "@bassline/cells";
import { installSystems } from "@bassline/systems";
import systems from "@bassline/systems";
import { installReact } from "@bassline/react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Card } from "~/components/ui/card";

// Install packages
bl();
installSystems();
installReact();

installPackage(cells);
installPackage(systems);

export function meta() {
    return [
        { title: "Sex Editor" },
        {
            name: "description",
            content: "Visual editor for sex gadget networks",
        },
    ];
}

// Built-in examples
const EXAMPLES = {
    "Create Counter": `[
  ["spawn", "counter", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 0
  }]
]`,
    "Send to Gadget": `[
  ["send", "counter", 42]
]`,
    "Nested Workspace": `[
  ["spawn", "workspace", {
    "pkg": "@bassline/systems",
    "name": "sex",
    "state": []
  }]
]`,
    "With Values": `[
  ["val", "initial", 42],
  ["withVals", ["initial"], [
    "spawn", "counter", {
      "pkg": "@bassline/cells/numeric",
      "name": "max",
      "state": { "$val": "initial" }
    }
  ]]
]`,
    "Multiple Gadgets": `[
  ["spawn", "counter1", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 0
  }],
  ["spawn", "counter2", {
    "pkg": "@bassline/cells/numeric",
    "name": "max",
    "state": 10
  }],
  ["spawn", "display", {
    "pkg": "@bassline/cells/unsafe",
    "name": "last",
    "state": "hello"
  }]
]`,
};

function PackageBrowser({ onSpawn }: { onSpawn: (spec: any) => void }) {
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

function ExplorerTree({
    spawned,
    selected,
    onSelect,
    onContextMenu,
}: {
    spawned: Record<string, any>;
    selected: any;
    onSelect: (gadget: any) => void;
    onContextMenu?: (e: React.MouseEvent, name: string, gadget: any) => void;
}) {
    return (
        <div className="space-y-1">
            {Object.entries(spawned).map(([name, gadget]) => (
                <TreeNode
                    key={name}
                    name={name}
                    gadget={gadget}
                    selected={selected}
                    onSelect={onSelect}
                    {...(onContextMenu ? { onContextMenu } : {})}
                />
            ))}
        </div>
    );
}

function TreeNode({
    name,
    gadget,
    selected,
    onSelect,
    onContextMenu,
}: {
    name: string;
    gadget: any;
    selected: any;
    onSelect: (gadget: any) => void;
    onContextMenu?: (e: React.MouseEvent, name: string, gadget: any) => void;
}) {
    const state = gadget.useCurrent();
    const isSex = gadget.pkg === "@bassline/systems" && gadget.name === "sex";

    // Local gadget for expansion state
    const expanded = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: false,
            }),
        [],
    );
    const [isExpanded, setExpanded] = expanded.useState();

    useEffect(() => () => expanded.kill(), [expanded]);

    const isSelected = selected === gadget;
    const icon = getIcon(gadget);
    const preview = getPreview(state);

    return (
        <div>
            <div
                onClick={() => onSelect(gadget)}
                onContextMenu={(e) => {
                    e.preventDefault();
                    onContextMenu?.(e, name, gadget);
                }}
                className={`px-2 py-1 rounded cursor-pointer hover:bg-gray-100 flex items-center gap-2 ${
                    isSelected ? "bg-blue-100" : ""
                }`}
            >
                {isSex && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!isExpanded);
                        }}
                        className="w-4 text-xs"
                    >
                        {isExpanded ? "▼" : "▶"}
                    </button>
                )}
                <span className="text-sm">{icon}</span>
                <span className="font-mono text-sm font-semibold">{name}</span>
                <span className="text-xs text-gray-500">{preview}</span>
            </div>
            {isSex && isExpanded && (
                <div className="ml-6 mt-1">
                    <ExplorerTree
                        spawned={state}
                        selected={selected}
                        onSelect={onSelect}
                        {...(onContextMenu ? { onContextMenu } : {})}
                    />
                </div>
            )}
        </div>
    );
}

function getIcon(gadget: any): string {
    if (gadget.pkg === "@bassline/systems") return "📦";
    if (gadget.pkg === "@bassline/cells/numeric") return "🔢";
    if (gadget.pkg === "@bassline/cells/tables") return "📝";
    if (gadget.pkg === "@bassline/relations") return "🔗";
    return "◆";
}

function getPreview(state: any): string {
    if (state === null || state === undefined) return "null";
    if (typeof state === "object") {
        if (Object.keys(state).length === 0) return "{}";
        return `{${Object.keys(state).length}}`;
    }
    const str = String(state);
    return str.length > 20 ? str.slice(0, 20) + "..." : str;
}

function StateInspector({
    gadget,
}: {
    gadget: any;
}) {
    // Use regular React state for simple UI interactions
    const [inputValue, setInputValue] = useState("");

    // Always call hooks - use null gadget if not provided
    const emptyGadget = useMemo(() =>
        fromSpec({
            pkg: "@bassline/cells/unsafe",
            name: "last",
            state: null,
        }), []);
    const state = (gadget || emptyGadget).useCurrent();

    useEffect(() => () => {
        if (!gadget) emptyGadget.kill();
    }, [gadget, emptyGadget]);

    if (!gadget) {
        return (
            <div className="p-4 text-gray-500 text-sm">
                Select a gadget to inspect
            </div>
        );
    }

    const handleSend = () => {
        // Smart input parsing - infer types automatically
        const smartParse = (input: string) => {
            // Try JSON first
            try {
                return JSON.parse(input);
            } catch {}

            // Infer type
            if (input === "true") return true;
            if (input === "false") return false;
            if (!isNaN(Number(input)) && input.trim() !== "") {
                return Number(input);
            }

            // Default to string
            return input;
        };

        const value = smartParse(inputValue);
        gadget.receive(value);
        setInputValue("");
    };

    return (
        <div className="p-4 space-y-4">
            <div>
                <div className="text-xs text-gray-500 uppercase mb-1">
                    Package
                </div>
                <div className="font-mono text-sm">{gadget.pkg}</div>
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase mb-1">Name</div>
                <div className="font-mono text-sm">{gadget.name}</div>
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase mb-1">
                    State
                </div>
                <pre className="font-mono text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(state, null, 2)}
                </pre>
            </div>
            <div>
                <div className="text-xs text-gray-500 uppercase mb-1">
                    Quick Send
                </div>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        placeholder="JSON or value"
                        className="flex-1 px-2 py-1 text-sm border rounded"
                    />
                    <Button size="sm" onClick={handleSend}>
                        Send
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function SexEditor() {
    // Prevent double-prompt in React StrictMode
    const hasLoadedRef = useRef(false);

    // Root sex gadget holder - holds reference to the current sex gadget
    const rootSexCell = useMemo(() => {
        const initialSex = fromSpec({
            pkg: "@bassline/systems",
            name: "sex",
            state: [],
        });
        return fromSpec({
            pkg: "@bassline/cells/unsafe",
            name: "last",
            state: initialSex,
        });
    }, []);

    const [rootSex] = rootSexCell.useState();
    const workspace = rootSex.useCurrent();

    // Selection gadget
    const selectionCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: null,
            }),
        [],
    );
    const [selected, setSelected] = selectionCell.useState();

    // Use regular React state for simple UI
    const [actions, setActions] = useState("[]");
    const [activeTab, setActiveTab] = useState("actions");

    // Action history
    const historyCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: [] as Array<{ timestamp: number; actions: any }>,
            }),
        [],
    );
    const [history] = historyCell.useState();

    // Effects log
    const effectsLogCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: [] as Array<
                    { timestamp: number; gadgetName: string; effect: any }
                >,
            }),
        [],
    );
    const [effectsLog] = effectsLogCell.useState();

    // Tap all gadgets to log effects
    useEffect(() => {
        const cleanups: Array<() => void> = [];

        const tapGadget = (name: string, gadget: any) => {
            const cleanup = gadget.tap((effect: any) => {
                effectsLogCell.receive([
                    ...effectsLogCell.current(),
                    { timestamp: Date.now(), gadgetName: name, effect },
                ]);
            });
            cleanups.push(cleanup);
        };

        Object.entries(workspace).forEach(([name, gadget]) => {
            tapGadget(name, gadget);
        });

        return () => {
            cleanups.forEach((c) => c());
        };
    }, [workspace, effectsLogCell]);

    // Auto-save to localStorage (debounced)
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            try {
                const spec = rootSex.toSpec();
                localStorage.setItem("bassline-workspace", JSON.stringify(spec));
            } catch (e) {
                console.error("Failed to auto-save:", e);
            }
        }, 1000); // 1 second debounce

        return () => clearTimeout(timeoutId);
    }, [workspace, rootSex]);

    // Auto-load from localStorage on mount
    useEffect(() => {
        // Prevent double-run in React StrictMode
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        const saved = localStorage.getItem("bassline-workspace");
        if (saved) {
            try {
                const spec = JSON.parse(saved);
                if (spec.state && Array.isArray(spec.state) && spec.state.length > 0) {
                    // Use setTimeout to avoid blocking render
                    setTimeout(() => {
                        const shouldLoad = confirm(
                            "Found saved workspace. Load it?\n\n" +
                            "Click OK to restore, or Cancel to start fresh.",
                        );
                        if (shouldLoad) {
                            rootSex.receive(spec.state);
                        } else {
                            // Clear saved workspace if user declines
                            localStorage.removeItem("bassline-workspace");
                        }
                    }, 100);
                }
            } catch (e) {
                console.error("Failed to load saved workspace:", e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount - rootSex is stable

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+Enter or Ctrl+Enter: Execute
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleExecute();
            }
            // Cmd+S or Ctrl+S: Save
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [actions, rootSex]); // Re-create handler when these change

    // Kill gadgets on unmount
    useEffect(() => {
        return () => {
            selectionCell.kill();
            historyCell.kill();
            effectsLogCell.kill();
        };
    }, [
        selectionCell,
        historyCell,
        effectsLogCell,
    ]);

    const handleExecute = () => {
        try {
            const parsed = JSON.parse(actions);
            rootSex.receive(parsed);

            // Add to history
            historyCell.receive([
                ...(history || []),
                { timestamp: Date.now(), actions: parsed },
            ]);
        } catch (e) {
            alert(`Invalid JSON: ${e}`);
        }
    };

    const handleSave = () => {
        const spec = rootSex.toSpec();
        const json = JSON.stringify(spec, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "workspace.json";
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleLoad = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const text = await file.text();
            try {
                const spec = JSON.parse(text);
                if (!spec.state || !Array.isArray(spec.state)) {
                    alert("Invalid sex spec: state must be an action array");
                    return;
                }

                // Ask user how to load
                const mode = prompt(
                    "How do you want to load this workspace?\n\n" +
                        "1. Add to current (executes actions here)\n" +
                        "2. As nested workspace (name it)\n" +
                        "3. Replace current (clears first)\n\n" +
                        "Enter 1, 2, or 3:",
                    "1",
                );

                if (!mode) return; // Cancelled

                if (mode === "1") {
                    // Add to current workspace
                    rootSex.receive(spec.state);
                } else if (mode === "2") {
                    // Spawn as nested workspace
                    const name = prompt(
                        "Name for this workspace:",
                        "workspace",
                    );
                    if (!name) return;
                    rootSex.receive([["spawn", name, spec]]);
                } else if (mode === "3") {
                    // Replace current - use clear command
                    rootSex.receive([["clear"]]);
                    rootSex.receive(spec.state);
                } else {
                    alert("Invalid option. Choose 1, 2, or 3.");
                }
            } catch (e) {
                alert(`Failed to load: ${e}`);
            }
        };
        input.click();
    };

    const handleNewWorkspace = () => {
        const confirmed = confirm(
            "Clear current workspace and start fresh?\n\n" +
            "Current workspace will be lost (unless saved).",
        );
        if (confirmed) {
            rootSex.receive([["clear"]]);
            localStorage.removeItem("bassline-workspace");
        }
    };

    const handleSpawnFromBrowser = (spec: any) => {
        // Auto-generate name based on gadget type
        const baseName = spec.name;
        let counter = 1;
        let name = baseName;
        while (workspace[name]) {
            name = `${baseName}_${counter}`;
            counter++;
        }

        // Spawn the gadget
        rootSex.receive([["spawn", name, spec]]);
    };

    // Context menu state - use regular React state
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; name: string; gadget: any } | null>(null);

    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    const handleContextMenu = (e: React.MouseEvent, name: string, gadget: any) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, name, gadget });
    };

    const handleDelete = () => {
        if (!contextMenu) return;
        const confirmed = confirm(`Delete gadget "${contextMenu.name}"?`);
        if (confirmed) {
            rootSex.receive([["clear", contextMenu.name]]);
            setContextMenu(null);
        }
    };

    const handleRename = () => {
        if (!contextMenu) return;
        const newName = prompt(`Rename "${contextMenu.name}" to:`, contextMenu.name);
        if (newName && newName !== contextMenu.name) {
            rootSex.receive([["rename", contextMenu.name, newName]]);
            setContextMenu(null);
        }
    };

    const handleDuplicate = () => {
        if (!contextMenu) return;
        const spec = contextMenu.gadget.toSpec();
        const baseName = contextMenu.name;
        let counter = 1;
        let name = `${baseName}_copy`;
        while (workspace[name]) {
            name = `${baseName}_copy_${counter}`;
            counter++;
        }
        rootSex.receive([["spawn", name, spec]]);
        setContextMenu(null);
    };

    const handleExportAsPackage = () => {
        const pkgName = prompt(
            "Package name (e.g., @myapp/gadgets):",
            "@myapp/gadgets",
        );
        if (!pkgName) return;

        const gadgetName = prompt(
            "Gadget name:",
            "myGadget",
        );
        if (!gadgetName) return;

        // Create a snapshot of current workspace
        rootSex.receive([["snapshot", "export"]]);

        // Build package definition
        const packageDef = {
            name: pkgName,
            gadgets: {
                [gadgetName]: {
                    pkg: pkgName,
                    name: gadgetName,
                    // The state is the action array from snapshot
                    defaultState: rootSex.snapshots?.export || [],
                    // Metadata
                    meta: {
                        description: `Exported from sex editor at ${new Date().toISOString()}`,
                        exports: Object.keys(workspace),
                    },
                },
            },
        };

        // Download as JSON
        const json = JSON.stringify(packageDef, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${gadgetName}.package.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-screen flex flex-col">
            <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
                <h1 className="text-lg font-semibold">Sex Editor</h1>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleNewWorkspace}>
                        New
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSave}>
                        Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleLoad}>
                        Load
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportAsPackage}>
                        Export Package
                    </Button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-[250px_1fr_300px] overflow-hidden">
                {/* Left: Explorer */}
                <div className="border-r overflow-y-auto bg-gray-50">
                    <div className="p-4 space-y-6">
                        {/* Package Browser */}
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
                                Packages
                            </h2>
                            <PackageBrowser onSpawn={handleSpawnFromBrowser} />
                        </div>

                        {/* Workspace */}
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
                                Workspace ({Object.keys(workspace).length})
                            </h2>
                            {Object.keys(workspace).length === 0 ? (
                                <div className="text-xs text-gray-500 px-2">
                                    No gadgets spawned yet
                                </div>
                            ) : (
                                <ExplorerTree
                                    spawned={workspace}
                                    selected={selected}
                                    onSelect={setSelected}
                                    onContextMenu={handleContextMenu}
                                />
                            )}
                        </div>
                    </div>
                </div>

                {/* Center: Tabbed Interface */}
                <div className="flex flex-col overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b bg-gray-50">
                        <button
                            onClick={() => setActiveTab("actions")}
                            className={`px-4 py-2 text-sm font-medium ${
                                activeTab === "actions"
                                    ? "border-b-2 border-blue-500 text-blue-600"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            Actions
                        </button>
                        <button
                            onClick={() => setActiveTab("history")}
                            className={`px-4 py-2 text-sm font-medium ${
                                activeTab === "history"
                                    ? "border-b-2 border-blue-500 text-blue-600"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            History ({history?.length ?? 0})
                        </button>
                        <button
                            onClick={() => setActiveTab("effects")}
                            className={`px-4 py-2 text-sm font-medium ${
                                activeTab === "effects"
                                    ? "border-b-2 border-blue-500 text-blue-600"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            Effects ({effectsLog?.length ?? 0})
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-hidden">
                        {activeTab === "actions" && (
                            <div className="h-full flex flex-col p-4">
                                <div className="mb-2 flex gap-2 items-center justify-end">
                                    <select
                                        className="text-xs border rounded px-2 py-1"
                                        onChange={(e) => {
                                            const example = EXAMPLES[
                                                e.target
                                                    .value as keyof typeof EXAMPLES
                                            ];
                                            if (example) setActions(example);
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="">
                                            Load Example...
                                        </option>
                                        {Object.keys(EXAMPLES).map((key) => (
                                            <option key={key} value={key}>
                                                {key}
                                            </option>
                                        ))}
                                    </select>
                                    <Button onClick={handleExecute}>
                                        Execute
                                    </Button>
                                </div>
                                <Textarea
                                    value={actions || "[]"}
                                    onChange={(
                                        e: React.ChangeEvent<
                                            HTMLTextAreaElement
                                        >,
                                    ) => setActions(e.target.value)}
                                    className="flex-1 font-mono text-sm"
                                    placeholder="Enter actions as JSON array..."
                                />
                            </div>
                        )}

                        {activeTab === "history" && (
                            <div className="h-full overflow-y-auto p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-semibold text-gray-700">
                                        Execution History
                                    </h3>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => historyCell.receive([])}
                                    >
                                        Clear
                                    </Button>
                                </div>
                                {!history || history.length === 0
                                    ? (
                                        <div className="text-sm text-gray-500">
                                            No actions executed yet
                                        </div>
                                    )
                                    : (
                                        <div className="space-y-2">
                                            {[...history].reverse().map(
                                                (entry, idx) => {
                                                    const time = new Date(
                                                        entry.timestamp,
                                                    ).toLocaleTimeString();
                                                    const actionStr = JSON
                                                        .stringify(
                                                            entry.actions,
                                                            null,
                                                            2,
                                                        );
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="border rounded p-2 hover:bg-gray-50 cursor-pointer"
                                                            onClick={() =>
                                                                setActions(
                                                                    actionStr,
                                                                )}
                                                        >
                                                            <div className="text-xs text-gray-500 mb-1">
                                                                {time}
                                                            </div>
                                                            <pre className="text-xs font-mono overflow-auto">
                                                        {actionStr}
                                                            </pre>
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    )}
                            </div>
                        )}

                        {activeTab === "effects" && (
                            <div className="h-full overflow-y-auto p-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h3 className="text-sm font-semibold text-gray-700">
                                        Effects Log
                                    </h3>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() =>
                                            effectsLogCell.receive([])}
                                    >
                                        Clear
                                    </Button>
                                </div>
                                {!effectsLog || effectsLog.length === 0
                                    ? (
                                        <div className="text-sm text-gray-500">
                                            No effects emitted yet
                                        </div>
                                    )
                                    : (
                                        <div className="space-y-1">
                                            {[...effectsLog].reverse().map(
                                                (entry, idx) => {
                                                    const time = new Date(
                                                        entry.timestamp,
                                                    ).toLocaleTimeString();
                                                    const effectKeys = Object
                                                        .keys(entry.effect)
                                                        .join(", ");
                                                    return (
                                                        <div
                                                            key={idx}
                                                            className="text-xs font-mono border-b pb-1"
                                                        >
                                                            <span className="text-gray-500">
                                                                {time}
                                                            </span>
                                                            {" - "}
                                                            <span className="font-semibold text-blue-600">
                                                                {entry
                                                                    .gadgetName}
                                                            </span>
                                                            {" → "}
                                                            <span className="text-green-600">
                                                                {effectKeys}
                                                            </span>
                                                        </div>
                                                    );
                                                },
                                            )}
                                        </div>
                                    )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Inspector */}
                <div className="border-l overflow-y-auto bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-700 p-4 pb-0 uppercase">
                        Inspector
                    </h2>
                    <StateInspector gadget={selected} />
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    className="fixed bg-white border border-gray-300 rounded shadow-lg py-1 z-50"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={handleRename}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                    >
                        Rename
                    </button>
                    <button
                        onClick={handleDuplicate}
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 text-sm"
                    >
                        Duplicate
                    </button>
                    <hr className="my-1" />
                    <button
                        onClick={handleDelete}
                        className="w-full text-left px-4 py-2 hover:bg-red-50 text-sm text-red-600"
                    >
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
}
