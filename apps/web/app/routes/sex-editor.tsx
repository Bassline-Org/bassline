import { useEffect, useMemo } from "react";
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

function ExplorerTree({
    spawned,
    selected,
    onSelect,
}: {
    spawned: Record<string, any>;
    selected: any;
    onSelect: (gadget: any) => void;
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
}: {
    name: string;
    gadget: any;
    selected: any;
    onSelect: (gadget: any) => void;
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
    const inputGadget = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: "",
            }),
        [],
    );
    const [inputValue, setInputValue] = inputGadget.useState();

    // Always call hooks - use null gadget if not provided
    const emptyGadget = useMemo(() => fromSpec({
        pkg: "@bassline/cells/unsafe",
        name: "last",
        state: null
    }), []);
    const state = (gadget || emptyGadget).useCurrent();

    useEffect(() => () => {
        inputGadget.kill();
        if (!gadget) emptyGadget.kill();
    }, [inputGadget, gadget, emptyGadget]);

    if (!gadget) {
        return (
            <div className="p-4 text-gray-500 text-sm">
                Select a gadget to inspect
            </div>
        );
    }

    const handleSend = () => {
        try {
            const parsed = JSON.parse(inputValue);
            gadget.receive(parsed);
            setInputValue("");
        } catch (e) {
            // Try sending as raw string
            gadget.receive(inputValue);
            setInputValue("");
        }
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

    // Actions being composed
    const actionsCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: "[]",
            }),
        [],
    );
    const [actions, setActions] = actionsCell.useState();

    // Kill gadgets on unmount
    useEffect(() => {
        return () => {
            selectionCell.kill();
            actionsCell.kill();
        };
    }, [selectionCell, actionsCell]);

    const handleExecute = () => {
        try {
            const parsed = JSON.parse(actions);
            rootSex.receive(parsed);
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
                    "1"
                );

                if (!mode) return; // Cancelled

                if (mode === "1") {
                    // Add to current workspace
                    rootSex.receive(spec.state);
                } else if (mode === "2") {
                    // Spawn as nested workspace
                    const name = prompt("Name for this workspace:", "workspace");
                    if (!name) return;
                    rootSex.receive([["spawn", name, spec]]);
                } else if (mode === "3") {
                    // Replace current - kill all gadgets first
                    const current = rootSex.current();
                    Object.values(current).forEach((g: any) => g.kill?.());
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

    return (
        <div className="h-screen flex flex-col">
            <div className="bg-gray-900 text-white px-4 py-2 flex items-center justify-between">
                <h1 className="text-lg font-semibold">Sex Editor</h1>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleSave}>
                        Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleLoad}>
                        Load
                    </Button>
                </div>
            </div>

            <div className="flex-1 grid grid-cols-[250px_1fr_300px] overflow-hidden">
                {/* Left: Explorer */}
                <div className="border-r overflow-y-auto bg-gray-50">
                    <div className="p-4">
                        <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
                            Explorer
                        </h2>
                        <ExplorerTree
                            spawned={workspace}
                            selected={selected}
                            onSelect={setSelected}
                        />
                    </div>
                </div>

                {/* Center: Actions */}
                <div className="flex flex-col p-4 overflow-hidden">
                    <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-gray-700 uppercase">
                            Actions
                        </h2>
                        <div className="flex gap-2 items-center">
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
                                <option value="">Load Example...</option>
                                {Object.keys(EXAMPLES).map((key) => (
                                    <option key={key} value={key}>
                                        {key}
                                    </option>
                                ))}
                            </select>
                            <Button onClick={handleExecute}>Execute</Button>
                        </div>
                    </div>
                    <Textarea
                        value={actions || "[]"}
                        onChange={(e) => setActions(e.target.value)}
                        className="flex-1 font-mono text-sm"
                        placeholder="Enter actions as JSON array..."
                    />
                </div>

                {/* Right: Inspector */}
                <div className="border-l overflow-y-auto bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-700 p-4 pb-0 uppercase">
                        Inspector
                    </h2>
                    <StateInspector gadget={selected} />
                </div>
            </div>
        </div>
    );
}
