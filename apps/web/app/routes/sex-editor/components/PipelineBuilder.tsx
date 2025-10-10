import { useState, useMemo } from "react";
import { pipeline } from "@bassline/builders";
import { Play, Plus, X, Settings, TestTube } from "lucide-react";

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

interface PipelineBuilderProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (actions: any[]) => void;
    packages: any;
}

const FUNCTION_PACKAGES = [
    "@bassline/fn/math",
    "@bassline/fn/logic",
    "@bassline/fn/array",
    "@bassline/fn/core",
    "@bassline/fn/http",
];

export function PipelineBuilder({ isOpen, onClose, onComplete, packages }: PipelineBuilderProps) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [showFunctionPicker, setShowFunctionPicker] = useState(false);
    const [editingStage, setEditingStage] = useState<string | null>(null);
    const [configState, setConfigState] = useState("");
    const [configExtract, setConfigExtract] = useState("");
    const [configName, setConfigName] = useState("");
    const [configError, setConfigError] = useState("");
    const [testInput, setTestInput] = useState("");
    const [testResults, setTestResults] = useState<Array<{ stage: string; value: any }> | null>(null);
    const [testError, setTestError] = useState("");
    const [functionSearch, setFunctionSearch] = useState("");

    // Extract function gadgets from packages
    const functionGadgets = useMemo(() => {
        const gadgets: Array<{ pkg: string; name: string; fullKey: string }> = [];
        if (packages) {
            Object.entries(packages).forEach(([key, proto]) => {
                if (key.startsWith('__') || typeof proto === 'function') {
                    return;
                }
                const parts = key.split('/');
                const name = parts.pop();
                const pkg = parts.join('/');

                if (name && pkg && FUNCTION_PACKAGES.includes(pkg)) {
                    gadgets.push({ pkg, name, fullKey: key });
                }
            });
        }
        return gadgets;
    }, [packages]);

    const handleAddStage = (pkg: string, name: string) => {
        const newStage: Stage = {
            id: Math.random().toString(36).substring(7),
            spec: { pkg, name, state: {} },
            extract: "computed", // Functions emit 'computed', not 'result'
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

    const handleTest = async () => {
        if (stages.length === 0) return;

        setTestError("");
        setTestResults(null);

        try {
            // Parse test input
            let input;
            try {
                input = JSON.parse(testInput);
            } catch {
                // If not JSON, treat as raw value
                input = testInput;
            }

            const results: Array<{ stage: string; value: any }> = [];
            let currentValue = input;

            // Execute each stage
            for (let i = 0; i < stages.length; i++) {
                const stage = stages[i];
                if (!stage) continue;

                const stageName = stage.customName || stage.spec.name;

                // Create temporary gadget for this stage
                const { fromSpec } = await import("@bassline/core") as any;
                const tempGadget = fromSpec(stage.spec);

                // Send input and wait for computed effect
                await new Promise<void>((resolve) => {
                    const cleanup = tempGadget.tap((effects: any) => {
                        if (effects.computed !== undefined) {
                            currentValue = effects.computed;
                            results.push({ stage: stageName, value: currentValue });
                            cleanup();
                            resolve();
                        } else if (effects.failed !== undefined) {
                            cleanup();
                            throw new Error(`Stage ${i + 1} failed: ${effects.failed.error?.message || 'Unknown error'}`);
                        }
                    });

                    tempGadget.receive(currentValue);

                    // Timeout after 1 second
                    setTimeout(() => {
                        cleanup();
                        throw new Error(`Stage ${i + 1} (${stageName}) timed out`);
                    }, 1000);
                });
            }

            setTestResults(results);
        } catch (e) {
            setTestError((e as Error).message);
        }
    };

    const handleBuild = async () => {
        const actions = pipeline(stages.map(stage => ({
            spec: stage.spec,
            extract: stage.extract,
            name: stage.customName,
        })));

        // Add all pipeline actions directly to workspace with unique name prefix
        // This makes stages and wires appear on the canvas
        const prefix = `p${Date.now()}_`;
        const uniqueActions = actions.map(([cmd, name, ...rest]) => {
            if (cmd === "wire") {
                // Wire: ["wire", wireName, sourceName, targetName, options]
                const [sourceName, targetName, options] = rest;
                return ["wire", prefix + name, prefix + sourceName, prefix + targetName, options];
            } else {
                // Spawn and other commands
                return [cmd, prefix + name, ...rest];
            }
        });

        onComplete(uniqueActions);

        onClose();
        setStages([]);
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-40"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col pointer-events-auto">
                    {/* Header */}
                    <div className="border-b p-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold">Pipeline Builder</h2>
                            <p className="text-sm text-gray-500">Build sequential function pipelines</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Pipeline Stages */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {stages.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                <p className="text-lg mb-4">No stages yet</p>
                                <p className="text-sm">Click "Add Stage" to start building your pipeline</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {stages.map((stage, index) => (
                                    <div
                                        key={stage.id}
                                        className="flex items-center gap-3 bg-gray-50 rounded-lg p-4 border-2 border-gray-200"
                                    >
                                        {/* Stage Number */}
                                        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">
                                            {index + 1}
                                        </div>

                                        {/* Stage Info */}
                                        <div className="flex-1">
                                            <div className="font-semibold text-sm">
                                                {stage.customName || stage.spec.name}
                                                {stage.customName && (
                                                    <span className="ml-2 text-xs text-gray-400">({stage.spec.name})</span>
                                                )}
                                            </div>
                                            <div className="font-mono text-xs text-gray-500">{stage.spec.pkg}</div>
                                            <div className="text-xs text-gray-400 mt-1">
                                                Extract: <span className="font-mono">{stage.extract}</span>
                                                {Object.keys(stage.spec.state).length > 0 && (
                                                    <span className="ml-2">• {Object.keys(stage.spec.state).length} arg(s)</span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Configure Button */}
                                        <button
                                            onClick={() => handleOpenConfig(stage)}
                                            className="p-2 hover:bg-blue-50 hover:text-blue-600 rounded transition-colors"
                                            title="Configure stage"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>

                                        {/* Remove Button */}
                                        <button
                                            onClick={() => handleRemoveStage(stage.id)}
                                            className="p-2 hover:bg-red-50 hover:text-red-600 rounded transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>

                                        {/* Arrow to next stage */}
                                        {index < stages.length - 1 && (
                                            <div className="absolute left-8 -bottom-4 text-blue-500 text-2xl">
                                                ↓
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Test Pipeline */}
                    {stages.length > 0 && (
                        <div className="border-t p-4 bg-blue-50">
                            <div className="flex items-start gap-3">
                                <div className="flex-1">
                                    <label className="block text-sm font-semibold mb-2">Test Pipeline</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={testInput}
                                            onChange={(e) => setTestInput(e.target.value)}
                                            placeholder="5"
                                            className="flex-1 px-3 py-2 border rounded text-sm"
                                        />
                                        <button
                                            onClick={handleTest}
                                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
                                        >
                                            <TestTube className="w-4 h-4" />
                                            Run Test
                                        </button>
                                    </div>
                                    {testError && (
                                        <p className="text-red-600 text-xs mt-2">{testError}</p>
                                    )}
                                </div>
                            </div>

                            {testResults && (
                                <div className="mt-4 space-y-2">
                                    <p className="text-xs font-semibold text-gray-600">Results:</p>
                                    {testResults.map((result, i) => (
                                        <div key={i} className="bg-white p-2 rounded border text-xs">
                                            <span className="text-gray-500">Stage {i + 1} ({result.stage}):</span>{" "}
                                            <span className="font-mono font-semibold">
                                                {typeof result.value === 'object'
                                                    ? JSON.stringify(result.value)
                                                    : String(result.value)
                                                }
                                            </span>
                                        </div>
                                    ))}
                                    <div className="bg-green-100 p-2 rounded border border-green-300 text-xs font-semibold text-green-700">
                                        → Final Output: {typeof testResults[testResults.length - 1]?.value === 'object'
                                            ? JSON.stringify(testResults[testResults.length - 1]?.value)
                                            : String(testResults[testResults.length - 1]?.value)
                                        }
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions Preview */}
                    {stages.length > 0 && (
                        <div className="border-t p-4 bg-gray-50">
                            <details className="text-xs">
                                <summary className="cursor-pointer text-gray-600 font-mono mb-2">
                                    Generated Actions ({pipeline(stages.map(s => ({ spec: s.spec, extract: s.extract }))).length})
                                </summary>
                                <pre className="bg-white p-3 rounded border overflow-x-auto text-[10px]">
                                    {JSON.stringify(pipeline(stages.map(s => ({ spec: s.spec, extract: s.extract }))), null, 2)}
                                </pre>
                            </details>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="border-t p-4 flex gap-2 justify-between">
                        <button
                            onClick={() => setShowFunctionPicker(true)}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Stage
                        </button>

                        <div className="flex gap-2">
                            <button
                                onClick={onClose}
                                className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleBuild}
                                disabled={stages.length === 0}
                                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Play className="w-4 h-4" />
                                Add to Canvas
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Configuration Modal */}
            {editingStage && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-30 z-50"
                        onClick={handleCancelConfig}
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none p-4">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl pointer-events-auto">
                            <div className="border-b p-4">
                                <h3 className="font-bold text-lg">Configure Stage</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    {stages.find(s => s.id === editingStage)?.spec.name}
                                </p>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* State JSON Editor */}
                                <div>
                                    <label className="block text-sm font-semibold mb-2">
                                        Arguments (JSON)
                                    </label>
                                    <textarea
                                        value={configState}
                                        onChange={(e) => setConfigState(e.target.value)}
                                        className="w-full h-32 px-3 py-2 border rounded font-mono text-sm"
                                        placeholder='{\n  "b": 10\n}'
                                    />
                                    {configError && (
                                        <p className="text-red-600 text-xs mt-1">{configError}</p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">
                                        Example: {`{ "b": 10 }`} for add function
                                    </p>
                                </div>

                                {/* Extract Key */}
                                <div>
                                    <label className="block text-sm font-semibold mb-2">
                                        Extract Key
                                    </label>
                                    <input
                                        type="text"
                                        value={configExtract}
                                        onChange={(e) => setConfigExtract(e.target.value)}
                                        className="w-full px-3 py-2 border rounded text-sm font-mono"
                                        placeholder="computed"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Effect key to extract and forward to next stage
                                    </p>
                                </div>

                                {/* Custom Name */}
                                <div>
                                    <label className="block text-sm font-semibold mb-2">
                                        Custom Name (optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={configName}
                                        onChange={(e) => setConfigName(e.target.value)}
                                        className="w-full px-3 py-2 border rounded text-sm"
                                        placeholder="e.g., addTax, multiplyByTwo"
                                    />
                                </div>
                            </div>
                            <div className="border-t p-4 flex gap-2 justify-end">
                                <button
                                    onClick={handleCancelConfig}
                                    className="px-4 py-2 border rounded hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveConfig}
                                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Function Picker Modal */}
            {showFunctionPicker && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-20 z-50"
                        onClick={() => {
                            setShowFunctionPicker(false);
                            setFunctionSearch("");
                        }}
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none p-4">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col pointer-events-auto">
                            <div className="border-b p-4">
                                <h3 className="font-bold mb-3">Select Function</h3>
                                <input
                                    type="text"
                                    value={functionSearch}
                                    onChange={(e) => setFunctionSearch(e.target.value)}
                                    placeholder="Search functions..."
                                    className="w-full px-3 py-2 border rounded text-sm"
                                    autoFocus
                                />
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {functionGadgets.length === 0 ? (
                                    <div className="p-8 text-center text-gray-400">
                                        No functions found. Make sure function packages are installed.
                                    </div>
                                ) : (
                                    (() => {
                                        // Filter and group by category
                                        const filtered = functionGadgets.filter(({ name, pkg }) =>
                                            functionSearch === "" ||
                                            name.toLowerCase().includes(functionSearch.toLowerCase()) ||
                                            pkg.toLowerCase().includes(functionSearch.toLowerCase())
                                        );

                                        const grouped = filtered.reduce((acc, gadget) => {
                                            const category = gadget.pkg.split('/').pop() || 'other';
                                            if (!acc[category]) acc[category] = [];
                                            acc[category].push(gadget);
                                            return acc;
                                        }, {} as Record<string, typeof filtered>);

                                        return Object.entries(grouped).map(([category, gadgets]) => (
                                            <div key={category} className="mb-4">
                                                <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase sticky top-0 bg-white">
                                                    {category}
                                                </div>
                                                {gadgets.map(({ pkg, name, fullKey }) => (
                                                    <button
                                                        key={fullKey}
                                                        onClick={() => {
                                                            handleAddStage(pkg, name);
                                                            setFunctionSearch("");
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded transition-colors"
                                                    >
                                                        <div className="font-semibold text-sm">{name}</div>
                                                        <div className="font-mono text-xs text-gray-500">{pkg}</div>
                                                    </button>
                                                ))}
                                            </div>
                                        ));
                                    })()
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
