import { useEffect, useMemo, useState } from "react";
import { fromSpec } from "@bassline/core";
import { Button } from "~/components/ui/button";

interface InspectorProps {
    gadget: any;
}

export function Inspector({ gadget }: InspectorProps) {
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
