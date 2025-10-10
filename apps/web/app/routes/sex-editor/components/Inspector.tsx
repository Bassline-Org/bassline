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
            {isWire && wireInfo && (
                <div>
                    <div className="text-xs text-gray-500 uppercase mb-1">
                        Connection
                    </div>
                    <div className="font-mono text-xs bg-blue-50 text-blue-700 p-2 rounded">
                        {wireInfo.source?.pkg}/{wireInfo.source?.name} → {wireInfo.target?.pkg}/{wireInfo.target?.name}
                    </div>
                </div>
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
            {!isWire && (
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
            )}
        </div>
    );
}
