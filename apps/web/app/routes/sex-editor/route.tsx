import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bl, fromSpec, installPackage } from "@bassline/core";
import cells from "@bassline/cells";
import { installSystems } from "@bassline/systems";
import systems from "@bassline/systems";
import { installReact } from "@bassline/react";
import functions from "@bassline/functions";
import "@bassline/relations";

import { PackageBrowser } from "./components/PackageBrowser";
import { WorkspaceTree } from "./components/WorkspaceTree";
import { Inspector } from "./components/Inspector";
import { ActionEditor } from "./components/ActionEditor";
import { HistoryPanel } from "./components/HistoryPanel";
import { EffectsPanel } from "./components/EffectsPanel";
import { Toolbar } from "./components/Toolbar";
import { SnapshotsPanel } from "./components/SnapshotsPanel";

import type { GadgetSpec, ContextMenuState } from "./types";

// Install packages
bl();
installSystems();
installReact();
installPackage(cells);
installPackage(systems);
installPackage(functions);

export function meta() {
    return [
        { title: "Sex Editor" },
        {
            name: "description",
            content: "Visual editor for sex gadget networks",
        },
    ];
}

export default function SexEditor() {
    // Prevent double-prompt in React StrictMode
    const hasLoadedRef = useRef(false);

    // Root sex gadget
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

    // UI state (React state for ephemeral UI)
    const [actions, setActions] = useState("[]");
    const [activeTab, setActiveTab] = useState("actions");
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

    // History gadget
    const historyCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: [],
            }),
        [],
    );
    const [history] = historyCell.useState();

    // Effects log gadget
    const effectsLogCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: [],
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

    // Auto-save to localStorage
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            try {
                const spec = rootSex.toSpec();
                localStorage.setItem("bassline-workspace", JSON.stringify(spec));
            } catch (e) {
                console.error("Failed to auto-save:", e);
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [workspace, rootSex]);

    // Auto-load from localStorage on mount
    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        const saved = localStorage.getItem("bassline-workspace");
        if (saved) {
            try {
                const spec = JSON.parse(saved);
                if (spec.state && Array.isArray(spec.state) && spec.state.length > 0) {
                    setTimeout(() => {
                        const shouldLoad = confirm(
                            "Found saved workspace. Load it?\n\n" +
                            "Click OK to restore, or Cancel to start fresh.",
                        );
                        if (shouldLoad) {
                            rootSex.receive(spec.state);
                        } else {
                            localStorage.removeItem("bassline-workspace");
                        }
                    }, 100);
                }
            } catch (e) {
                console.error("Failed to load saved workspace:", e);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handlers (must be defined before useEffect that uses them)
    const handleExecute = useCallback(() => {
        try {
            const parsed = JSON.parse(actions);
            rootSex.receive(parsed);
            historyCell.receive([
                ...(history || []),
                { timestamp: Date.now(), actions: parsed },
            ]);
        } catch (e) {
            alert(`Invalid JSON: ${e}`);
        }
    }, [actions, rootSex, historyCell, history]);

    const handleSave = useCallback(() => {
        const spec = rootSex.toSpec();
        const json = JSON.stringify(spec, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "workspace.json";
        a.click();
        URL.revokeObjectURL(url);
    }, [rootSex]);

    const handleSnapshot = useCallback(() => {
        const label = prompt("Snapshot label:", `snap-${Date.now()}`);
        if (label) {
            rootSex.receive([["snapshot", label]]);
            setActiveTab("snapshots"); // Switch to snapshots tab
        }
    }, [rootSex]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + Enter = Execute
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleExecute();
            }
            // Cmd/Ctrl + S = Save
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            }
            // Cmd/Ctrl + Shift + S = Snapshot
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "S") {
                e.preventDefault();
                handleSnapshot();
            }
            // Cmd/Ctrl + Shift + R = Show snapshots
            if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
                e.preventDefault();
                setActiveTab("snapshots");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleExecute, handleSave, handleSnapshot]);

    // Context menu close on click
    useEffect(() => {
        const handleClickOutside = () => setContextMenu(null);
        document.addEventListener("click", handleClickOutside);
        return () => document.removeEventListener("click", handleClickOutside);
    }, []);

    // Cleanup gadgets
    useEffect(() => {
        return () => {
            selectionCell.kill();
            historyCell.kill();
            effectsLogCell.kill();
        };
    }, [selectionCell, historyCell, effectsLogCell]);

    // Other handlers (non-useCallback)
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

                const mode = prompt(
                    "How do you want to load this workspace?\n\n" +
                        "1. Add to current (executes actions here)\n" +
                        "2. As nested workspace (name it)\n" +
                        "3. Replace current (clears first)\n\n" +
                        "Enter 1, 2, or 3:",
                    "1",
                );

                if (!mode) return;

                if (mode === "1") {
                    rootSex.receive(spec.state);
                } else if (mode === "2") {
                    const name = prompt("Name for this workspace:", "workspace");
                    if (!name) return;
                    rootSex.receive([["spawn", name, spec]]);
                } else if (mode === "3") {
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

    const handleSpawnFromBrowser = (spec: GadgetSpec) => {
        const baseName = spec.name;
        let counter = 1;
        let name = baseName;
        while (workspace[name]) {
            name = `${baseName}_${counter}`;
            counter++;
        }
        rootSex.receive([["spawn", name, spec]]);
    };

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

        const gadgetName = prompt("Gadget name:", "myGadget");
        if (!gadgetName) return;

        rootSex.receive([["snapshot", "export"]]);

        const packageDef = {
            name: pkgName,
            gadgets: {
                [gadgetName]: {
                    pkg: pkgName,
                    name: gadgetName,
                    defaultState: rootSex.snapshots?.export || [],
                    meta: {
                        description: `Exported from sex editor at ${new Date().toISOString()}`,
                        exports: Object.keys(workspace),
                    },
                },
            },
        };

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
            <Toolbar
                onNew={handleNewWorkspace}
                onSave={handleSave}
                onLoad={handleLoad}
                onExport={handleExportAsPackage}
                onSnapshot={handleSnapshot}
            />

            <div className="flex-1 grid grid-cols-[250px_1fr_300px] overflow-hidden">
                {/* Left: Explorer */}
                <div className="border-r overflow-y-auto bg-gray-50">
                    <div className="p-4 space-y-6">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
                                Packages
                            </h2>
                            <PackageBrowser onSpawn={handleSpawnFromBrowser} />
                        </div>

                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
                                Workspace ({Object.keys(workspace).length})
                            </h2>
                            {Object.keys(workspace).length === 0 ? (
                                <div className="text-xs text-gray-500 px-2">
                                    No gadgets spawned yet
                                </div>
                            ) : (
                                <WorkspaceTree
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
                        <button
                            onClick={() => setActiveTab("snapshots")}
                            className={`px-4 py-2 text-sm font-medium ${
                                activeTab === "snapshots"
                                    ? "border-b-2 border-blue-500 text-blue-600"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            Snapshots ({Object.keys(rootSex.snapshots || {}).length})
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {activeTab === "actions" && (
                            <ActionEditor
                                actions={actions}
                                onActionsChange={setActions}
                                onExecute={handleExecute}
                            />
                        )}

                        {activeTab === "history" && (
                            <HistoryPanel
                                history={history}
                                onClear={() => historyCell.receive([])}
                                onSelectEntry={setActions}
                            />
                        )}

                        {activeTab === "effects" && (
                            <EffectsPanel
                                effectsLog={effectsLog}
                                onClear={() => effectsLogCell.receive([])}
                            />
                        )}

                        {activeTab === "snapshots" && (
                            <SnapshotsPanel
                                snapshots={rootSex.snapshots || {}}
                                onRestore={(label) => rootSex.receive([["restore", label]])}
                                onDelete={(label) => {
                                    delete rootSex.snapshots[label];
                                    rootSex.emit({ snapshotDeleted: label });
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Right: Inspector */}
                <div className="border-l overflow-y-auto bg-gray-50">
                    <h2 className="text-sm font-semibold text-gray-700 p-4 pb-0 uppercase">
                        Inspector
                    </h2>
                    <Inspector gadget={selected} />
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
