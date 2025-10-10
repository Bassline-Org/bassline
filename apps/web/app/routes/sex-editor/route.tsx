import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bl, fromSpec, installPackage } from "@bassline/core";
import cells from "@bassline/cells";
import { installSystems } from "@bassline/systems";
import systems from "@bassline/systems";
import { installReact } from "@bassline/react";
import functions from "@bassline/functions";
import "@bassline/relations";
import "@bassline/views"; // Install view extension
import { registerView } from "@bassline/views";

import { PackageBrowser } from "./components/PackageBrowser";
import { WorkspaceTree } from "./components/WorkspaceTree";
import { Inspector } from "./components/Inspector";
import { ActionEditor } from "./components/ActionEditor";
import { HistoryPanel } from "./components/HistoryPanel";
import { EffectsPanel } from "./components/EffectsPanel";
import { Toolbar } from "./components/Toolbar";
import { SnapshotsPanel } from "./components/SnapshotsPanel";
import { CanvasView, type CanvasViewHandle } from "./components/CanvasView";
import { Breadcrumb } from "./components/Breadcrumb";
import { CommandPalette } from "./components/CommandPalette";

// Import view components for registration
import { BigNumberView } from "./components/views/BigNumberView";
import { LineChartView } from "./components/views/LineChartView";
import { TableView } from "./components/views/TableView";
import { GaugeView } from "./components/views/GaugeView";

import type { ContextMenuState, GadgetSpec } from "./types";

// Install packages
bl();
installSystems();
installReact();
installPackage(cells);
installPackage(systems);
installPackage(functions);

// Register view components
registerView("bigNumber", BigNumberView, { description: "Large KPI display for numeric values" });
registerView("lineChart", LineChartView, { description: "Time series line chart" });
registerView("table", TableView, { description: "Data table for arrays and objects" });
registerView("gauge", GaugeView, { description: "Circular gauge for numeric values" });

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
    const canvasRef = useRef<CanvasViewHandle>(null);

    // Multi-workspace tabs
    interface Workspace {
        id: string;
        name: string;
        sexCell: any;
    }

    const [workspaces, setWorkspaces] = useState<Workspace[]>(() => {
        const initialSex = fromSpec({
            pkg: "@bassline/systems",
            name: "sex",
            state: [],
        });
        const sexCell = fromSpec({
            pkg: "@bassline/cells/unsafe",
            name: "last",
            state: initialSex,
        });
        return [{
            id: "default",
            name: "Workspace 1",
            sexCell,
        }];
    });

    const [activeWorkspaceId, setActiveWorkspaceId] = useState("default");
    const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId)!;
    const [rootSex] = activeWorkspace.sexCell.useState();

    // Tab management handlers
    const handleNewTab = useCallback(() => {
        const id = `workspace-${Date.now()}`;
        const initialSex = fromSpec({
            pkg: "@bassline/systems",
            name: "sex",
            state: [],
        });
        const sexCell = fromSpec({
            pkg: "@bassline/cells/unsafe",
            name: "last",
            state: initialSex,
        });
        const newWorkspace: Workspace = {
            id,
            name: `Workspace ${workspaces.length + 1}`,
            sexCell,
        };
        setWorkspaces([...workspaces, newWorkspace]);
        setActiveWorkspaceId(id);
    }, [workspaces]);

    const handleCloseTab = useCallback((tabId: string) => {
        if (workspaces.length === 1) {
            alert("Cannot close the last workspace");
            return;
        }
        const confirmed = confirm(
            "Close this workspace? Unsaved changes will be lost.",
        );
        if (!confirmed) return;

        const newWorkspaces = workspaces.filter((w) => w.id !== tabId);
        setWorkspaces(newWorkspaces);

        // Switch to another tab if closing active tab
        if (tabId === activeWorkspaceId) {
            setActiveWorkspaceId(newWorkspaces[0]!.id);
        }
    }, [workspaces, activeWorkspaceId]);

    const handleRenameTab = useCallback((tabId: string) => {
        const workspace = workspaces.find((w) => w.id === tabId);
        if (!workspace) return;

        const newName = prompt("Rename workspace:", workspace.name);
        if (!newName || newName === workspace.name) return;

        setWorkspaces(
            workspaces.map((w) => w.id === tabId ? { ...w, name: newName } : w),
        );
    }, [workspaces]);

    // Navigation stack - track path through nested workspaces
    const navigationStackCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: [{ sex: rootSex, name: "root" }],
            }),
        [rootSex],
    );
    const [navigationStack] = navigationStackCell.useState();

    // Current workspace is the last item in navigation stack
    const currentFrame = navigationStack?.[navigationStack.length - 1] ||
        { sex: rootSex, name: "root" };
    const currentSex = currentFrame.sex;
    const workspace = currentSex.useCurrent();

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
    const [activeTab, setActiveTab] = useState("canvas");
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(
        null,
    );
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [showInspector, setShowInspector] = useState(true);

    // Undo/Redo state
    const undoStackCell = useMemo(
        () =>
            fromSpec({
                pkg: "@bassline/cells/unsafe",
                name: "last",
                state: [],
            }),
        [],
    );
    const [undoStack] = undoStackCell.useState();
    const [undoIndex, setUndoIndex] = useState(-1);

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
                // Safety check - effectsLogCell might be killed during cleanup
                try {
                    const currentLog = effectsLogCell.current();
                    if (Array.isArray(currentLog)) {
                        effectsLogCell.receive([
                            ...currentLog,
                            { timestamp: Date.now(), gadgetName: name, effect },
                        ]);
                    }
                } catch (e) {
                    // Ignore errors during cleanup
                    console.warn(
                        "[EffectsLog] Failed to log effect during cleanup:",
                        e,
                    );
                }
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

    // Capture undo snapshots when workspace changes
    useEffect(() => {
        // Debounce snapshot capture
        const timeoutId = setTimeout(() => {
            try {
                if (!undoStack || !Array.isArray(undoStack)) {
                    return; // Skip if undoStack not initialized
                }

                const spec = currentSex.stateSpec();
                const specJson = JSON.stringify(spec);

                // Only capture if state actually changed
                const lastSnapshot = undoStack[undoIndex];
                const lastJson = lastSnapshot
                    ? JSON.stringify(lastSnapshot)
                    : null;

                if (specJson !== lastJson) {
                    // Truncate future history when making new changes after undo
                    const newStack = undoStack.slice(0, undoIndex + 1);
                    newStack.push(spec);

                    // Limit stack size to 50 snapshots
                    if (newStack.length > 50) {
                        newStack.shift();
                    } else {
                        setUndoIndex(newStack.length - 1);
                    }

                    undoStackCell.receive(newStack);
                }
            } catch (e) {
                console.error("Failed to capture snapshot:", e);
            }
        }, 500); // 500ms debounce

        return () => clearTimeout(timeoutId);
    }, [workspace, currentSex, undoStack, undoIndex, undoStackCell]);

    // Auto-save workspaces to localStorage
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            try {
                const workspacesData = workspaces.map((ws) => ({
                    id: ws.id,
                    name: ws.name,
                    spec: ws.sexCell.current().toSpec(),
                }));
                localStorage.setItem(
                    "bassline-workspaces",
                    JSON.stringify({
                        workspaces: workspacesData,
                        activeWorkspaceId,
                    }),
                );
            } catch (e) {
                console.error("Failed to auto-save:", e);
            }
        }, 1000);

        return () => clearTimeout(timeoutId);
    }, [workspaces, activeWorkspaceId]);

    // Auto-load from localStorage on mount
    useEffect(() => {
        if (hasLoadedRef.current) return;
        hasLoadedRef.current = true;

        const saved = localStorage.getItem("bassline-workspaces");
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.workspaces && data.workspaces.length > 0) {
                    setTimeout(() => {
                        const shouldLoad = confirm(
                            "Found saved workspaces. Load them?\n\n" +
                                "Click OK to restore, or Cancel to start fresh.",
                        );
                        if (shouldLoad) {
                            const restoredWorkspaces = data.workspaces.map(
                                (wsData: any) => {
                                    const sex = fromSpec(wsData.spec);
                                    const sexCell = fromSpec({
                                        pkg: "@bassline/cells/unsafe",
                                        name: "last",
                                        state: sex,
                                    });
                                    return {
                                        id: wsData.id,
                                        name: wsData.name,
                                        sexCell,
                                    };
                                },
                            );
                            setWorkspaces(restoredWorkspaces);
                            setActiveWorkspaceId(
                                data.activeWorkspaceId ||
                                    restoredWorkspaces[0].id,
                            );
                        } else {
                            localStorage.removeItem("bassline-workspaces");
                        }
                    }, 100);
                }
            } catch (e) {
                console.error("Failed to load saved workspaces:", e);
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

    // Undo/Redo handlers
    const handleUndo = useCallback(() => {
        if (undoIndex > 0) {
            const prevSpec = undoStack[undoIndex - 1];
            currentSex.receive(prevSpec);
            setUndoIndex(undoIndex - 1);
        }
    }, [undoIndex, undoStack, currentSex]);

    const handleRedo = useCallback(() => {
        if (undoIndex < undoStack.length - 1) {
            const nextSpec = undoStack[undoIndex + 1];
            currentSex.receive(nextSpec);
            setUndoIndex(undoIndex + 1);
        }
    }, [undoIndex, undoStack, currentSex]);

    // Copy/Paste handlers
    const handleCopy = useCallback(() => {
        const selectedNodes = canvasRef.current?.getSelectedNodes() || [];
        const specs = selectedNodes
            .filter((n) => !n.data?.["isWire"])
            .map((n) => {
                const gadget = n.data?.["gadget"] as any;
                return gadget?.toSpec();
            })
            .filter(Boolean);

        if (specs.length > 0) {
            navigator.clipboard.writeText(JSON.stringify(specs, null, 2));
        }
    }, [canvasRef]);

    const handlePaste = useCallback(async () => {
        try {
            const text = await navigator.clipboard.readText();
            const specs = JSON.parse(text);

            // Handle both single spec and array of specs
            const specsArray = Array.isArray(specs) ? specs : [specs];

            const actions: any[] = [];
            specsArray.forEach((spec: any) => {
                if (spec && spec.pkg && spec.name) {
                    const baseName = spec.name;
                    let name = baseName;
                    let counter = 1;
                    while (workspace[name]) {
                        name = `${baseName}_${counter++}`;
                    }
                    actions.push(["spawn", name, spec]);
                }
            });
            if (actions.length > 0) {
                currentSex.receive(actions);
            }
        } catch (e) {
            console.error("Paste failed:", e);
        }
    }, [workspace, currentSex]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't intercept when typing in inputs/textareas
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement
            ) {
                // Allow Escape to blur inputs
                if (e.key === "Escape") {
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            // Cmd/Ctrl + T = New Tab
            if ((e.metaKey || e.ctrlKey) && e.key === "t") {
                e.preventDefault();
                handleNewTab();
            } // Cmd/Ctrl + W = Close Tab
            else if ((e.metaKey || e.ctrlKey) && e.key === "w") {
                e.preventDefault();
                handleCloseTab(activeWorkspaceId);
            } // Cmd/Ctrl + 1-9 = Switch to tab
            else if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
                e.preventDefault();
                const index = parseInt(e.key) - 1;
                if (index < workspaces.length) {
                    setActiveWorkspaceId(workspaces[index]!.id);
                }
            } // Cmd/Ctrl + Z = Undo
            else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "z") {
                e.preventDefault();
                handleUndo();
            } // Cmd/Ctrl + Shift + Z = Redo
            else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "z") {
                e.preventDefault();
                handleRedo();
            } // Cmd/Ctrl + C = Copy
            else if ((e.metaKey || e.ctrlKey) && e.key === "c") {
                e.preventDefault();
                handleCopy();
            } // Cmd/Ctrl + V = Paste
            else if ((e.metaKey || e.ctrlKey) && e.key === "v") {
                e.preventDefault();
                handlePaste();
            } // Cmd/Ctrl + K = Command Palette
            else if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setIsPaletteOpen(true);
            } // Cmd/Ctrl + D = Duplicate selected node
            else if ((e.metaKey || e.ctrlKey) && e.key === "d") {
                e.preventDefault();
                const selectedNodes = canvasRef.current?.getSelectedNodes() ||
                    [];
                const actions: any[] = [];
                selectedNodes.forEach((node) => {
                    if (!node.data?.["isWire"]) {
                        const gadget = node.data?.["gadget"] as any;
                        const spec = gadget.toSpec();
                        const baseName = node.data?.["name"] as string;
                        let counter = 1;
                        let name = `${baseName}_copy`;
                        while (workspace[name]) {
                            name = `${baseName}_copy_${counter}`;
                            counter++;
                        }
                        actions.push(["spawn", name, spec]);
                    }
                });
                if (actions.length > 0) {
                    currentSex.receive(actions);
                }
            } // Cmd/Ctrl + L = Auto-layout
            else if ((e.metaKey || e.ctrlKey) && e.key === "l") {
                e.preventDefault();
                canvasRef.current?.autoLayout();
            } // Cmd/Ctrl + / = Toggle inspector
            else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
                e.preventDefault();
                setShowInspector((prev) => !prev);
            } // Escape = Deselect all
            else if (e.key === "Escape") {
                e.preventDefault();
                canvasRef.current?.deselectAll();
                setIsPaletteOpen(false);
            } // Cmd/Ctrl + Enter = Execute
            else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                handleExecute();
            } // Cmd/Ctrl + S = Save
            else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                handleSave();
            } // Cmd/Ctrl + Shift + S = Snapshot
            else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "S") {
                e.preventDefault();
                handleSnapshot();
            } // Cmd/Ctrl + Shift + R = Show snapshots
            else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "R") {
                e.preventDefault();
                setActiveTab("snapshots");
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        handleExecute,
        handleSave,
        handleSnapshot,
        handleUndo,
        handleRedo,
        handleCopy,
        handlePaste,
        handleNewTab,
        handleCloseTab,
        workspace,
        currentSex,
        canvasRef,
        workspaces,
        activeWorkspaceId,
    ]);

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
            navigationStackCell.kill();
            undoStackCell.kill();
        };
    }, [
        selectionCell,
        historyCell,
        effectsLogCell,
        navigationStackCell,
        undoStackCell,
    ]);

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
                    const name = prompt(
                        "Name for this workspace:",
                        "workspace",
                    );
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
            localStorage.removeItem("bassline-workspaces");
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
        currentSex.receive([["spawn", name, spec]]);
    };

    const handleSpawnFromPalette = (pkg: string, name: string) => {
        const spec: GadgetSpec = { pkg, name, state: null };
        const baseName = name;
        let counter = 1;
        let gadgetName = baseName;
        while (workspace[gadgetName]) {
            gadgetName = `${baseName}_${counter}`;
            counter++;
        }
        currentSex.receive([["spawn", gadgetName, spec]]);
    };

    const handleNavigateInto = (name: string, gadget: any) => {
        // Only navigate into sex gadgets
        if (gadget.pkg === "@bassline/systems" && gadget.name === "sex") {
            const currentStack = navigationStack ||
                [{ sex: rootSex, name: "root" }];
            navigationStackCell.receive([
                ...currentStack,
                { sex: gadget, name, parentSex: currentSex },
            ]);
        }
    };

    const handleNavigateToLevel = (index: number) => {
        // Navigate back to a specific level in the stack
        const currentStack = navigationStack ||
            [{ sex: rootSex, name: "root" }];
        if (index >= 0 && index < currentStack.length) {
            navigationStackCell.receive(currentStack.slice(0, index + 1));
        }
    };

    const handleContextMenu = (
        e: React.MouseEvent,
        name: string,
        gadget: any,
    ) => {
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
        const newName = prompt(
            `Rename "${contextMenu.name}" to:`,
            contextMenu.name,
        );
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
        // Get workspace name from active tab
        const currentWorkspace = workspaces.find((w) =>
            w.id === activeWorkspaceId
        );
        const defaultPkgName = `@my/${
            currentWorkspace?.name.toLowerCase().replace(/\s+/g, "-") ||
            "workspace"
        }`;

        const pkgName = prompt(
            "Package name (e.g., @myapp/patterns):",
            defaultPkgName,
        );
        if (!pkgName) return;

        const gadgetName = prompt(
            "Gadget name:",
            currentWorkspace?.name.toLowerCase().replace(/\s+/g, "-") ||
                "myWorkspace",
        );
        if (!gadgetName) return;

        // Use stateSpec (action array) as the true state representation
        const stateSpec = rootSex.stateSpec();

        if (stateSpec.length === 0) {
            alert("Workspace is empty! Add some gadgets first.");
            return;
        }

        // Create gadget prototype object
        const gadgetProto = {
            pkg: pkgName,
            name: gadgetName,
            // The gadget extends sex
            extends: "@bassline/systems/sex",
            // Default state is the action array
            defaultState: stateSpec,
            meta: {
                description: `Exported from Sex Editor on ${
                    new Date().toISOString()
                }`,
                created: new Date().toISOString(),
                workspace: currentWorkspace?.name || "Unknown",
                gadgets: Object.keys(workspace),
                gadgetCount: Object.keys(workspace).length,
            },
        };

        const packageDef = {
            name: pkgName,
            version: "1.0.0",
            description: `Package containing ${gadgetName} gadget`,
            gadgets: {
                [gadgetName]: gadgetProto,
            },
        };

        const json = JSON.stringify(packageDef, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${
            pkgName.replace("@", "").replace("/", "-")
        }-${gadgetName}.package.json`;
        a.click();
        URL.revokeObjectURL(url);

        // Show success message
        setTimeout(() => {
            alert(
                `✅ Package exported!\n\n` +
                    `Package: ${pkgName}\n` +
                    `Gadget: ${gadgetName}\n` +
                    `Contains: ${Object.keys(workspace).length} gadgets\n\n` +
                    `You can now import this package to spawn this workspace anywhere!`,
            );
        }, 100);
    };

    const handleImportPackage = () => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json";
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const text = await file.text();
            try {
                const packageDef = JSON.parse(text);

                // Validate package structure
                if (
                    !packageDef.gadgets ||
                    typeof packageDef.gadgets !== "object"
                ) {
                    alert("Invalid package: missing 'gadgets' field");
                    return;
                }

                // Get first gadget from package
                const gadgetEntries = Object.entries(packageDef.gadgets);
                if (gadgetEntries.length === 0) {
                    alert("Package contains no gadgets!");
                    return;
                }

                const [gadgetName, gadgetProto] = gadgetEntries[0] as [
                    string,
                    any,
                ];

                if (
                    !gadgetProto.defaultState ||
                    !Array.isArray(gadgetProto.defaultState)
                ) {
                    alert(
                        `Invalid gadget '${gadgetName}': missing or invalid defaultState`,
                    );
                    return;
                }

                const gadgetCount = gadgetProto.meta?.gadgetCount ||
                    gadgetProto.defaultState.length;
                const gadgetList = gadgetProto.meta?.gadgets?.join(", ") ||
                    "unknown";

                const confirmed = confirm(
                    `Import package: ${packageDef.name}\n\n` +
                        `Gadget: ${gadgetName}\n` +
                        `Contains: ${gadgetCount} gadgets (${gadgetList})\n` +
                        `Created: ${
                            gadgetProto.meta?.created || "unknown"
                        }\n\n` +
                        `This will install the gadget and spawn it in the current workspace.\n\n` +
                        `Continue?`,
                );

                if (!confirmed) return;

                // Create proper gadget prototypes from package definition
                const processedGadgets: Record<string, any> = {};

                for (const [name, gadgetDefRaw] of gadgetEntries) {
                    const gadgetDef = gadgetDefRaw as any;

                    // Get the base proto (sex in this case)
                    const basePkg = gadgetDef.extends || "@bassline/core";
                    const baseProto = basePkg === "@bassline/systems/sex"
                        ? bl().packages.get("@bassline/systems/sex")
                        : bl().gadgetProto;

                    if (!baseProto) {
                        throw new Error(`Base prototype ${basePkg} not found`);
                    }

                    // Create new prototype extending base
                    const newProto = Object.create(baseProto);
                    const defaultState = gadgetDef.defaultState;

                    Object.assign(newProto, {
                        pkg: gadgetDef.pkg,
                        name: gadgetDef.name,
                        // Override afterSpawn to use defaultState
                        afterSpawn(initial: any) {
                            const state = initial !== undefined
                                ? initial
                                : defaultState;
                            // Call parent's update and receive (inherited from baseProto)
                            baseProto.update.call(this, {});
                            baseProto.receive.call(this, state);
                        },
                    });

                    processedGadgets[name] = newProto;
                }

                // Install the processed package
                installPackage({
                    name: packageDef.name,
                    gadgets: processedGadgets,
                });

                // Spawn the gadget in current workspace
                const baseName = gadgetName;
                let name = baseName;
                let counter = 1;
                while (workspace[name]) {
                    name = `${baseName}_${counter++}`;
                }

                // Spawn using the installed gadget
                currentSex.receive([[
                    "spawn",
                    name,
                    {
                        pkg: gadgetProto.pkg,
                        name: gadgetProto.name,
                        state: gadgetProto.defaultState,
                    },
                ]]);

                alert(
                    `✅ Package imported and spawned!\n\n` +
                        `Instance name: ${name}\n` +
                        `Double-click to explore the ${gadgetCount} gadgets inside.`,
                );
            } catch (e) {
                alert(`Failed to import package: ${e}`);
            }
        };
        input.click();
    };

    return (
        <div className="h-screen flex flex-col">
            <Toolbar
                onNew={handleNewWorkspace}
                onSave={handleSave}
                onLoad={handleLoad}
                onExport={handleExportAsPackage}
                onImport={handleImportPackage}
                onSnapshot={handleSnapshot}
            />

            {/* Workspace Tabs */}
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 border-b overflow-x-auto">
                {workspaces.map((ws, index) => (
                    <div
                        key={ws.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-t text-sm ${
                            ws.id === activeWorkspaceId
                                ? "bg-white border-t border-x text-gray-900 font-medium"
                                : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        }`}
                    >
                        <button
                            onClick={() => setActiveWorkspaceId(ws.id)}
                            className="flex-1"
                        >
                            {ws.name}
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRenameTab(ws.id);
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 px-1"
                            title="Rename workspace"
                        >
                            ✏️
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleCloseTab(ws.id);
                            }}
                            className="text-xs text-gray-500 hover:text-red-600 px-1"
                            title="Close workspace"
                        >
                            ✕
                        </button>
                        {index < 9 && (
                            <span className="text-xs text-gray-400 ml-1">
                                ⌘{index + 1}
                            </span>
                        )}
                    </div>
                ))}
                <button
                    onClick={handleNewTab}
                    className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-200 rounded"
                    title="New workspace (⌘T)"
                >
                    + New
                </button>
            </div>

            <div
                className={`flex-1 grid overflow-hidden ${
                    showInspector
                        ? "grid-cols-[250px_1fr_300px]"
                        : "grid-cols-[250px_1fr]"
                }`}
            >
                {/* Left: Explorer */}
                <div className="border-r overflow-y-auto bg-gray-50">
                    <div className="p-4 space-y-6">
                        <div>
                            <h2 className="text-sm font-semibold text-gray-700 mb-2 uppercase">
                                Packages
                            </h2>
                            <PackageBrowser onSpawn={handleSpawnFromBrowser} />
                        </div>

                        {/* Workspace tree removed - canvas is the primary workspace view */}
                    </div>
                </div>

                {/* Center: Tabbed Interface */}
                <div className="flex flex-col overflow-hidden">
                    <div className="flex border-b bg-gray-50">
                        <button
                            onClick={() => setActiveTab("canvas")}
                            className={`px-4 py-2 text-sm font-medium ${
                                activeTab === "canvas"
                                    ? "border-b-2 border-blue-500 text-blue-600"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            Canvas
                        </button>
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
                            Snapshots ({Object.keys(rootSex.snapshots || {})
                                .length})
                        </button>
                    </div>

                    <div className="flex-1 overflow-hidden">
                        {activeTab === "canvas" && (
                            <div className="h-full flex flex-col">
                                <Breadcrumb
                                    navigationStack={navigationStack ||
                                        [{ sex: rootSex, name: "root" }]}
                                    onNavigateToLevel={handleNavigateToLevel}
                                />
                                <div className="flex-1">
                                    <CanvasView
                                        workspace={workspace}
                                        currentSex={currentSex}
                                        selectionCell={selectionCell}
                                        onNavigateInto={handleNavigateInto}
                                        canvasRef={canvasRef}
                                    />
                                </div>
                            </div>
                        )}

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
                                onRestore={(label) =>
                                    rootSex.receive([["restore", label]])}
                                onDelete={(label) => {
                                    delete rootSex.snapshots[label];
                                    rootSex.emit({ snapshotDeleted: label });
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* Right: Inspector */}
                {showInspector && (
                    <div className="border-l overflow-y-auto bg-gray-50">
                        <h2 className="text-sm font-semibold text-gray-700 p-4 pb-0 uppercase">
                            Inspector
                        </h2>
                        <Inspector gadget={selected} workspace={workspace} />
                    </div>
                )}
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

            {/* Command Palette */}
            <CommandPalette
                isOpen={isPaletteOpen}
                onClose={() => setIsPaletteOpen(false)}
                onSpawn={handleSpawnFromPalette}
                packages={bl().packages}
            />
        </div>
    );
}
