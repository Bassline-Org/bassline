import { useEffect, useMemo, useState } from "react";
import { fromSpec } from "@bassline/core";
import { Button } from "~/components/ui/button";

interface InspectorProps {
    gadget: any;
    workspace: Record<string, any>;
}

export function Inspector({ gadget, workspace }: InspectorProps) {
    // Use regular React state for simple UI interactions
    const [inputValue, setInputValue] = useState("");
    const [keysInputValue, setKeysInputValue] = useState("");
    const [effects, setEffects] = useState<Array<{ timestamp: number; effect: any }>>([]);

    // Always call hooks - use null gadget if not provided
    const emptyGadget = useMemo(() =>
        fromSpec({
            pkg: "@bassline/cells/unsafe",
            name: "last",
            state: null,
        }), []);
    const state = (gadget || emptyGadget).useCurrent();

    // Tap selected gadget to collect effects history
    useEffect(() => {
        // Clear effects immediately on every gadget change
        setEffects([]);

        if (!gadget) {
            emptyGadget.kill();
            return;
        }

        const cleanup = gadget.tap((effect: any) => {
            setEffects(prev => [...prev.slice(-4), { timestamp: Date.now(), effect }]);
        });

        return () => {
            cleanup();
        };
    }, [gadget, emptyGadget]);

    // Sync keysInputValue with gadget state for wires
    useEffect(() => {
        if (gadget && gadget.pkg === "@bassline/relations" && gadget.name === "scopedWire") {
            const wireState = gadget.current();
            const keys = wireState.keys || [];
            setKeysInputValue(keys.join(', '));
        }
    }, [gadget, state]);

    // Find all connections to/from this gadget (must be before early return)
    const connections = useMemo(() => {
        if (!gadget) return { incoming: [], outgoing: [] };

        const incoming: Array<{ name: string; source: any }> = [];
        const outgoing: Array<{ name: string; target: any }> = [];

        Object.entries(workspace).forEach(([name, g]) => {
            if (g.pkg === "@bassline/relations" && g.name === "scopedWire") {
                const wireState = g.current();
                if (wireState?.source === gadget) {
                    outgoing.push({ name, target: wireState.target });
                }
                if (wireState?.target === gadget) {
                    incoming.push({ name, source: wireState.source });
                }
            }
        });

        return { incoming, outgoing };
    }, [workspace, gadget]);

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

    const handleSend = () => {
        const value = smartParse(inputValue);
        gadget.receive(value);
        setInputValue("");
    };

    const handleQuickSend = (value: string) => {
        const parsed = smartParse(value);
        gadget.receive(parsed);
        setInputValue("");
    };

    if (!gadget) {
        return (
            <div className="p-4 text-gray-500 text-sm">
                Select a gadget to inspect
            </div>
        );
    }

    // Check if this is a wire gadget
    const isWire = gadget.pkg === "@bassline/relations" && gadget.name === "scopedWire";
    const wireInfo = isWire ? state : null;

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

            {/* Port Information (if gadget has ports) */}
            {!isWire && (gadget.inputs || gadget.outputs) && (
                <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">Ports</div>
                    <div className="space-y-2">
                        {gadget.inputs && (
                            <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                    Inputs
                                </div>
                                <div className="space-y-1">
                                    {Object.entries(gadget.inputs).map(([portName, spec]: [string, any]) => {
                                        // Skip metadata if inputs is a single-value input
                                        if (portName === 'type' || portName === 'description') return null;
                                        return (
                                            <div
                                                key={portName}
                                                className="font-mono text-xs bg-blue-50 text-blue-700 p-1.5 rounded"
                                            >
                                                <div className="flex justify-between items-center">
                                                    <span className="font-semibold">{portName}</span>
                                                    <span className="text-blue-500">{spec.type}</span>
                                                </div>
                                                {spec.routes_to && (
                                                    <div className="text-blue-500 text-[10px] mt-0.5">
                                                        → {spec.routes_to}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {gadget.outputs && (
                            <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                    Outputs
                                </div>
                                <div className="space-y-1">
                                    {Object.entries(gadget.outputs).map(([portName, spec]: [string, any]) => (
                                        <div
                                            key={portName}
                                            className="font-mono text-xs bg-green-50 text-green-700 p-1.5 rounded"
                                        >
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold">{portName}</span>
                                                <span className="text-green-500">{spec.type}</span>
                                            </div>
                                            {spec.routes_from && (
                                                <div className="text-green-500 text-[10px] mt-0.5">
                                                    ← {spec.routes_from} [{spec.effects?.join(', ')}]
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Port Editor for Sex Gadgets */}
            {!isWire && gadget.pkg === "@bassline/systems" && gadget.name === "sex" && (
                <div>
                    <div className="text-xs text-gray-500 uppercase mb-2">
                        Port Configuration
                    </div>
                    <PortEditor gadget={gadget} workspace={workspace} />
                </div>
            )}

            {/* View Selector (if gadget supports views) */}
            {!isWire && gadget.getView && (
                <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">
                        View Mode
                    </div>
                    <select
                        value={gadget.getView()}
                        onChange={(e) => gadget.setView(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border rounded bg-white"
                    >
                        {gadget.getAvailableViews().map((v: string) => (
                            <option key={v} value={v}>
                                {v === "default" ? "Default (JSON Box)" : v}
                            </option>
                        ))}
                    </select>

                    {/* Suggested views based on data shape */}
                    {gadget.getSuggestedViews && gadget.getSuggestedViews().length > 1 && (
                        <div className="mt-2">
                            <div className="text-xs text-gray-500 mb-1">
                                Suggested:
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {gadget.getSuggestedViews().map((v: string) => (
                                    <button
                                        key={v}
                                        onClick={() => gadget.setView(v)}
                                        className={`px-2 py-0.5 text-xs rounded ${
                                            gadget.getView() === v
                                                ? "bg-blue-500 text-white"
                                                : "bg-blue-100 hover:bg-blue-200 text-blue-700"
                                        }`}
                                    >
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {isWire && wireInfo && (
                <>
                    <div>
                        <div className="text-xs text-gray-500 uppercase mb-1">
                            Connection
                        </div>
                        <div className="font-mono text-xs bg-blue-50 text-blue-700 p-2 rounded">
                            {wireInfo.sourceName || "unknown"} → {wireInfo.targetName || "unknown"}
                        </div>
                    </div>

                    {/* Port-based configuration (new way) */}
                    {(wireInfo.sourcePort || wireInfo.targetPort) && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">
                                Port Configuration
                            </div>
                            <div className="space-y-2">
                                {wireInfo.sourcePort && (
                                    <div className="font-mono text-xs bg-green-50 text-green-700 p-2 rounded">
                                        Extract: <span className="font-semibold">{wireInfo.sourcePort}</span>
                                    </div>
                                )}
                                {wireInfo.targetPort && (
                                    <div className="font-mono text-xs bg-purple-50 text-purple-700 p-2 rounded">
                                        As field: <span className="font-semibold">{wireInfo.targetPort}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Keys-based configuration (old way, backwards compat) */}
                    {wireInfo.keys && (
                        <div>
                            <div className="text-xs text-gray-500 uppercase mb-1">
                                Forward Keys (Legacy)
                            </div>
                            <input
                                type="text"
                                value={keysInputValue}
                                placeholder="all (leave empty for all)"
                                onChange={(e) => {
                                    setKeysInputValue(e.target.value);
                                }}
                                onBlur={() => {
                                    const newKeys = keysInputValue
                                        .split(',')
                                        .map(k => k.trim())
                                        .filter(k => k.length > 0);
                                    gadget.receive({ keys: newKeys.length > 0 ? newKeys : null });
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        const newKeys = keysInputValue
                                            .split(',')
                                            .map(k => k.trim())
                                            .filter(k => k.length > 0);
                                        gadget.receive({ keys: newKeys.length > 0 ? newKeys : null });
                                    }
                                }}
                                className="w-full px-2 py-1 text-sm border rounded font-mono"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                                Examples: <span className="font-mono">changed</span>, <span className="font-mono">computed</span>
                            </div>
                        </div>
                    )}
                </>
            )}
            {!isWire && (connections.incoming.length > 0 || connections.outgoing.length > 0) && (
                <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">
                        Connections
                    </div>
                    <div className="space-y-2">
                        {connections.incoming.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                    ← Incoming ({connections.incoming.length})
                                </div>
                                <div className="space-y-1">
                                    {connections.incoming.map(({ name, source }) => {
                                        // Find workspace name for source
                                        const sourceName = Object.entries(workspace).find(
                                            ([, g]) => g === source
                                        )?.[0];
                                        return (
                                            <div
                                                key={name}
                                                className="font-mono text-xs bg-green-50 text-green-700 p-1.5 rounded"
                                            >
                                                {sourceName || "unknown"} → this
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        {connections.outgoing.length > 0 && (
                            <div>
                                <div className="text-xs font-semibold text-gray-600 mb-1">
                                    → Outgoing ({connections.outgoing.length})
                                </div>
                                <div className="space-y-1">
                                    {connections.outgoing.map(({ name, target }) => {
                                        // Find workspace name for target
                                        const targetName = Object.entries(workspace).find(
                                            ([, g]) => g === target
                                        )?.[0];
                                        return (
                                            <div
                                                key={name}
                                                className="font-mono text-xs bg-blue-50 text-blue-700 p-1.5 rounded"
                                            >
                                                this → {targetName || "unknown"}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div>
                <div className="text-xs text-gray-500 uppercase mb-1">
                    State
                </div>
                <pre className="font-mono text-xs bg-gray-50 p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(state, null, 2)}
                </pre>
            </div>
            {effects.length > 0 && (
                <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">
                        Recent Effects ({effects.length})
                    </div>
                    <div className="space-y-1 max-h-32 overflow-auto">
                        {effects.map(({ timestamp, effect }, i) => (
                            <div key={timestamp + i} className="font-mono text-xs bg-purple-50 p-1.5 rounded">
                                <div className="text-purple-600 font-semibold">
                                    {Object.keys(effect).join(", ")}
                                </div>
                                <pre className="text-purple-700 text-xs mt-0.5 whitespace-pre-wrap break-all">
                                    {JSON.stringify(effect, null, 2)}
                                </pre>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function PortEditor({ gadget, workspace }: { gadget: any; workspace: Record<string, any> }) {
    const [showAddInput, setShowAddInput] = useState(false);
    const [showAddOutput, setShowAddOutput] = useState(false);
    const [newInputPort, setNewInputPort] = useState({ name: "", routes_to: "", type: "any" });
    const [newOutputPort, setNewOutputPort] = useState({ name: "", routes_from: "", effects: "", type: "any" });
    const [ports, setPorts] = useState({ inputs: gadget.inputs || {}, outputs: gadget.outputs || {} });

    const state = gadget.useCurrent();
    const internalGadgets = Object.keys(state || {}).filter(key =>
        state[key] && typeof state[key] === 'object' && 'receive' in state[key]
    );

    // Listen for port changes and update local state
    useEffect(() => {
        const cleanup = gadget.tap((effect: any) => {
            if (effect.portsChanged) {
                setPorts({ inputs: gadget.inputs || {}, outputs: gadget.outputs || {} });
            }
        });
        return cleanup;
    }, [gadget]);

    const handleAddInput = () => {
        if (!newInputPort.name || !newInputPort.routes_to) return;

        const newInputs = {
            ...(gadget.inputs || {}),
            [newInputPort.name]: {
                type: newInputPort.type,
                routes_to: newInputPort.routes_to
            }
        };

        gadget.inputs = newInputs;
        gadget.emit({ portsChanged: { inputs: gadget.inputs, outputs: gadget.outputs } });
        setNewInputPort({ name: "", routes_to: "", type: "any" });
        setShowAddInput(false);
    };

    const handleRemoveInput = (portName: string) => {
        const newInputs = { ...gadget.inputs };
        delete newInputs[portName];
        gadget.inputs = Object.keys(newInputs).length > 0 ? newInputs : undefined;
        gadget.emit({ portsChanged: { inputs: gadget.inputs, outputs: gadget.outputs } });
    };

    const handleAddOutput = () => {
        if (!newOutputPort.name || !newOutputPort.routes_from || !newOutputPort.effects) return;

        const effects = newOutputPort.effects.split(',').map(e => e.trim()).filter(e => e);

        const newOutputs = {
            ...(gadget.outputs || {}),
            [newOutputPort.name]: {
                type: newOutputPort.type,
                routes_from: newOutputPort.routes_from,
                effects
            }
        };

        gadget.outputs = newOutputs;
        gadget.setupOutputTaps?.();
        gadget.emit({ portsChanged: { inputs: gadget.inputs, outputs: gadget.outputs } });
        setNewOutputPort({ name: "", routes_from: "", effects: "", type: "any" });
        setShowAddOutput(false);
    };

    const handleRemoveOutput = (portName: string) => {
        const newOutputs = { ...gadget.outputs };
        delete newOutputs[portName];
        gadget.outputs = Object.keys(newOutputs).length > 0 ? newOutputs : undefined;
        gadget.setupOutputTaps?.();
        gadget.emit({ portsChanged: { inputs: gadget.inputs, outputs: gadget.outputs } });
    };

    return (
        <div className="space-y-3">
            {/* Input Ports */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <div className="text-xs font-semibold text-gray-600">Input Ports</div>
                    <Button
                        size="sm"
                        onClick={() => setShowAddInput(!showAddInput)}
                        className="text-xs px-2 py-1 h-6"
                    >
                        + Add
                    </Button>
                </div>

                {showAddInput && (
                    <div className="bg-blue-50 p-2 rounded space-y-2 mb-2">
                        <input
                            type="text"
                            placeholder="Port name"
                            value={newInputPort.name}
                            onChange={(e) => setNewInputPort({ ...newInputPort, name: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                        />
                        <select
                            value={newInputPort.routes_to}
                            onChange={(e) => setNewInputPort({ ...newInputPort, routes_to: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                        >
                            <option value="">Select internal gadget...</option>
                            {internalGadgets.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        <select
                            value={newInputPort.type}
                            onChange={(e) => setNewInputPort({ ...newInputPort, type: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                        >
                            <option value="any">any</option>
                            <option value="number">number</option>
                            <option value="string">string</option>
                            <option value="boolean">boolean</option>
                            <option value="array">array</option>
                            <option value="object">object</option>
                        </select>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleAddInput} className="text-xs flex-1">
                                Add Input Port
                            </Button>
                            <Button size="sm" onClick={() => setShowAddInput(false)} className="text-xs">
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    {ports.inputs && Object.entries(ports.inputs).map(([portName, spec]: [string, any]) => (
                        <div key={portName} className="flex items-center gap-2">
                            <div className="flex-1 font-mono text-xs bg-blue-50 text-blue-700 p-1.5 rounded">
                                <div className="flex justify-between">
                                    <span className="font-semibold">{portName}</span>
                                    <span className="text-blue-500">{spec.type}</span>
                                </div>
                                {spec.routes_to && (
                                    <div className="text-blue-500 text-[10px] mt-0.5">
                                        → {spec.routes_to}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleRemoveInput(portName)}
                                className="text-red-600 hover:text-red-800 text-sm"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Output Ports */}
            <div>
                <div className="flex justify-between items-center mb-2">
                    <div className="text-xs font-semibold text-gray-600">Output Ports</div>
                    <Button
                        size="sm"
                        onClick={() => setShowAddOutput(!showAddOutput)}
                        className="text-xs px-2 py-1 h-6"
                    >
                        + Add
                    </Button>
                </div>

                {showAddOutput && (
                    <div className="bg-green-50 p-2 rounded space-y-2 mb-2">
                        <input
                            type="text"
                            placeholder="Port name"
                            value={newOutputPort.name}
                            onChange={(e) => setNewOutputPort({ ...newOutputPort, name: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                        />
                        <select
                            value={newOutputPort.routes_from}
                            onChange={(e) => setNewOutputPort({ ...newOutputPort, routes_from: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                        >
                            <option value="">Select internal gadget...</option>
                            {internalGadgets.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Effect keys (comma-separated)"
                            value={newOutputPort.effects}
                            onChange={(e) => setNewOutputPort({ ...newOutputPort, effects: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                        />
                        <select
                            value={newOutputPort.type}
                            onChange={(e) => setNewOutputPort({ ...newOutputPort, type: e.target.value })}
                            className="w-full px-2 py-1 text-xs border rounded"
                        >
                            <option value="any">any</option>
                            <option value="number">number</option>
                            <option value="string">string</option>
                            <option value="boolean">boolean</option>
                            <option value="array">array</option>
                            <option value="object">object</option>
                        </select>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleAddOutput} className="text-xs flex-1">
                                Add Output Port
                            </Button>
                            <Button size="sm" onClick={() => setShowAddOutput(false)} className="text-xs">
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className="space-y-1">
                    {ports.outputs && Object.entries(ports.outputs).map(([portName, spec]: [string, any]) => (
                        <div key={portName} className="flex items-center gap-2">
                            <div className="flex-1 font-mono text-xs bg-green-50 text-green-700 p-1.5 rounded">
                                <div className="flex justify-between">
                                    <span className="font-semibold">{portName}</span>
                                    <span className="text-green-500">{spec.type}</span>
                                </div>
                                {spec.routes_from && (
                                    <div className="text-green-500 text-[10px] mt-0.5">
                                        ← {spec.routes_from} [{spec.effects?.join(', ')}]
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => handleRemoveOutput(portName)}
                                className="text-red-600 hover:text-red-800 text-sm"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
