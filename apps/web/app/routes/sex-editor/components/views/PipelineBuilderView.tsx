import { useState, useMemo, useEffect, memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { pipeline } from "@bassline/builders";
import { Plus, X, Settings, TestTube } from "lucide-react";

interface Stage {
    id: string;
    spec: {
        pkg: string;
        name: string;
        state: any;
    };
    extract?: string;
    customName?: string;
}

// Parse actions array into stages for editing
function parseActionsToStages(actions: any[]): Stage[] {
    const stages: Stage[] = [];
    const spawns = actions.filter(a => a[0] === "spawn");

    spawns.forEach(([_, name, spec]) => {
        // Only include function gadgets, skip wires
        if (spec?.pkg?.startsWith("@bassline/fn/")) {
            stages.push({
                id: name,
                spec,
                extract: "computed",
                customName: name.startsWith("stage") ? undefined : name
            });
        }
    });

    return stages;
}

export const PipelineBuilderView = memo(({ data, selected }: NodeProps) => {
    const { name, gadget } = data;

    // Parse initial stages from gadget's state
    const initialStages = useMemo(() => {
        try {
            if (typeof gadget.stateSpec === "function") {
                const actions = gadget.stateSpec();
                return parseActionsToStages(actions);
            }
        } catch (e) {
            console.error("Failed to parse gadget state:", e);
        }
        return [];
    }, [gadget]);

    const [stages, setStages] = useState<Stage[]>(initialStages);
    const [showFunctionPicker, setShowFunctionPicker] = useState(false);
    const [editingStage, setEditingStage] = useState<string | null>(null);
    const [configState, setConfigState] = useState("");
    const [configExtract, setConfigExtract] = useState("");
    const [configName, setConfigName] = useState("");
    const [configError, setConfigError] = useState("");

    // Get available function gadgets
    const functionGadgets = useMemo(() => {
        const gadgets: Array<{ pkg: string; name: string; fullKey: string }> = [];
        const packages = (window as any).bassline?.packages;

        if (packages) {
            for (const [key, proto] of packages.entries()) {
                if (key.startsWith("@bassline/fn/")) {
                    const parts = key.split('/');
                    const fnName = parts.pop();
                    const pkg = parts.join('/');
                    if (fnName && pkg) {
                        gadgets.push({ pkg, name: fnName, fullKey: key });
                    }
                }
            }
        }

        return gadgets;
    }, []);

    // Update gadget when stages change
    useEffect(() => {
        const actions = pipeline(stages.map(stage => ({
            spec: stage.spec,
            extract: stage.extract,
            name: stage.customName,
        })));

        // Clear and rebuild gadget's internal state
        if (stages.length > 0) {
            gadget.receive([["clear"], ...actions]);
        }
    }, [stages, gadget]);

    const handleAddStage = (pkg: string, name: string) => {
        const newStage: Stage = {
            id: Math.random().toString(36).substring(7),
            spec: { pkg, name, state: {} },
            extract: "computed",
        };
        setStages([...stages, newStage]);
        setShowFunctionPicker(false);
    };

    const handleRemoveStage = (id: string) => {
        setStages(stages.filter(s => s.id !== id));
    };

    const handleOpenConfig = (stage: Stage) => {
        setEditingStage(stage.id);
        setConfigState(JSON.stringify(stage.spec.state, null, 2));
        setConfigExtract(stage.extract || "computed");
        setConfigName(stage.customName || "");
        setConfigError("");
    };

    const handleSaveConfig = () => {
        try {
            const parsedState = JSON.parse(configState);
            setStages(stages.map(s => {
                if (s.id === editingStage) {
                    const updated: Stage = {
                        ...s,
                        spec: { ...s.spec, state: parsedState },
                        extract: configExtract,
                    };
                    if (configName) {
                        updated.customName = configName;
                    }
                    return updated;
                }
                return s;
            }));
            setEditingStage(null);
            setConfigError("");
        } catch (e) {
            setConfigError("Invalid JSON: " + (e as Error).message);
        }
    };

    const handleCancelConfig = () => {
        setEditingStage(null);
        setConfigError("");
    };

    return (
        <div className={`bg-white border-2 rounded-lg shadow-lg min-w-[600px] min-h-[400px] ${
            selected ? "border-blue-500 ring-2 ring-blue-300" : "border-gray-300"
        }`}>
            <Handle type="target" position={Position.Top} className="!bg-blue-500" />
            <Handle type="source" position={Position.Bottom} className="!bg-blue-500" />

            {/* Header */}
            <div className="border-b p-3 bg-gray-50">
                <div className="font-bold text-sm">{name}</div>
                <div className="text-xs text-gray-500">Pipeline Builder</div>
            </div>

            {/* Stages */}
            <div className="p-4 max-h-[300px] overflow-y-auto">
                {stages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                        <p className="text-sm">No stages yet</p>
                        <p className="text-xs">Click "Add Stage" to start</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {stages.map((stage, index) => (
                            <div
                                key={stage.id}
                                className="flex items-center gap-2 bg-gray-50 rounded p-2 border text-xs"
                            >
                                <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                                    {index + 1}
                                </div>

                                <div className="flex-1">
                                    <div className="font-semibold text-xs">
                                        {stage.customName || stage.spec.name}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                        {stage.extract && <span>Extract: {stage.extract}</span>}
                                        {Object.keys(stage.spec.state).length > 0 && (
                                            <span className="ml-2">• {Object.keys(stage.spec.state).length} arg(s)</span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleOpenConfig(stage)}
                                    className="p-1 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
                                    title="Configure"
                                >
                                    <Settings className="w-3 h-3" />
                                </button>

                                <button
                                    onClick={() => handleRemoveStage(stage.id)}
                                    className="p-1 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="border-t p-2 bg-gray-50">
                <button
                    onClick={() => setShowFunctionPicker(true)}
                    className="w-full px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm"
                >
                    <Plus className="w-4 h-4" />
                    Add Stage
                </button>
            </div>

            {/* Config Modal */}
            {editingStage && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
                    <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-md">
                        <div className="border-b p-3">
                            <h3 className="font-bold text-sm">Configure Stage</h3>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs font-semibold mb-1">Arguments (JSON)</label>
                                <textarea
                                    value={configState}
                                    onChange={(e) => setConfigState(e.target.value)}
                                    className="w-full h-20 px-2 py-1 border rounded font-mono text-xs"
                                    placeholder='{ "b": 10 }'
                                />
                                {configError && <p className="text-red-600 text-xs mt-1">{configError}</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1">Extract Key</label>
                                <input
                                    type="text"
                                    value={configExtract}
                                    onChange={(e) => setConfigExtract(e.target.value)}
                                    className="w-full px-2 py-1 border rounded text-xs"
                                    placeholder="computed"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold mb-1">Custom Name</label>
                                <input
                                    type="text"
                                    value={configName}
                                    onChange={(e) => setConfigName(e.target.value)}
                                    className="w-full px-2 py-1 border rounded text-xs"
                                    placeholder="optional"
                                />
                            </div>
                        </div>
                        <div className="border-t p-3 flex gap-2 justify-end">
                            <button
                                onClick={handleCancelConfig}
                                className="px-3 py-1 border rounded hover:bg-gray-50 text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveConfig}
                                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Function Picker */}
            {showFunctionPicker && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 rounded-lg">
                    <div className="bg-white rounded-lg shadow-xl w-[90%] max-w-sm max-h-[80%] flex flex-col">
                        <div className="border-b p-3">
                            <h3 className="font-bold text-sm">Select Function</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2">
                            {functionGadgets.length === 0 ? (
                                <div className="p-4 text-center text-gray-400 text-xs">
                                    No functions found
                                </div>
                            ) : (
                                (() => {
                                    const grouped = functionGadgets.reduce((acc, gadget) => {
                                        const category = gadget.pkg.split('/').pop() || 'other';
                                        if (!acc[category]) acc[category] = [];
                                        acc[category].push(gadget);
                                        return acc;
                                    }, {} as Record<string, typeof functionGadgets>);

                                    return Object.entries(grouped).map(([category, gadgets]) => (
                                        <div key={category} className="mb-3">
                                            <div className="px-2 py-1 text-[10px] font-bold text-gray-500 uppercase">
                                                {category}
                                            </div>
                                            {gadgets.map(({ pkg, name, fullKey }) => (
                                                <button
                                                    key={fullKey}
                                                    onClick={() => handleAddStage(pkg, name)}
                                                    className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded transition-colors"
                                                >
                                                    <div className="font-semibold text-xs">{name}</div>
                                                    <div className="font-mono text-[10px] text-gray-500">{pkg}</div>
                                                </button>
                                            ))}
                                        </div>
                                    ));
                                })()
                            )}
                        </div>
                        <div className="border-t p-2">
                            <button
                                onClick={() => setShowFunctionPicker(false)}
                                className="w-full px-3 py-1 border rounded hover:bg-gray-50 text-sm"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});
