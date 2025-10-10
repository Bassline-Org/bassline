import { useState, useMemo } from "react";
import { pipeline } from "@bassline/builders";
import { Play, Plus, X, GripVertical, Settings } from "lucide-react";

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
    "@bassline/functions/math",
    "@bassline/functions/logic",
    "@bassline/functions/array",
    "@bassline/functions/core",
];

export function PipelineBuilder({ isOpen, onClose, onComplete, packages }: PipelineBuilderProps) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [showFunctionPicker, setShowFunctionPicker] = useState(false);
    const [editingStage, setEditingStage] = useState<string | null>(null);

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
            extract: "result",
        };
        setStages([...stages, newStage]);
        setShowFunctionPicker(false);
    };

    const handleRemoveStage = (id: string) => {
        setStages(stages.filter(s => s.id !== id));
    };

    const handleUpdateExtract = (id: string, extract: string) => {
        setStages(stages.map(s => s.id === id ? { ...s, extract } : s));
    };

    const handleBuild = () => {
        const actions = pipeline(stages.map(stage => ({
            spec: stage.spec,
            extract: stage.extract,
            name: stage.customName,
        })));
        onComplete(actions);
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
                                            <div className="font-semibold text-sm">{stage.spec.name}</div>
                                            <div className="font-mono text-xs text-gray-500">{stage.spec.pkg}</div>
                                        </div>

                                        {/* Extract Key Input */}
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs text-gray-500">Extract:</label>
                                            <input
                                                type="text"
                                                value={stage.extract || ""}
                                                onChange={(e) => handleUpdateExtract(stage.id, e.target.value)}
                                                placeholder="result"
                                                className="px-2 py-1 border rounded text-sm w-24"
                                            />
                                        </div>

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

            {/* Function Picker Modal */}
            {showFunctionPicker && (
                <>
                    <div
                        className="fixed inset-0 bg-black bg-opacity-20 z-50"
                        onClick={() => setShowFunctionPicker(false)}
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none p-4">
                        <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[60vh] flex flex-col pointer-events-auto">
                            <div className="border-b p-4">
                                <h3 className="font-bold">Select Function</h3>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2">
                                {functionGadgets.map(({ pkg, name, fullKey }) => (
                                    <button
                                        key={fullKey}
                                        onClick={() => handleAddStage(pkg, name)}
                                        className="w-full text-left px-4 py-3 hover:bg-gray-50 rounded transition-colors"
                                    >
                                        <div className="font-semibold text-sm">{name}</div>
                                        <div className="font-mono text-xs text-gray-500">{pkg}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
