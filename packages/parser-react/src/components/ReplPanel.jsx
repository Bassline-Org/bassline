/**
 * ReplPanel - Interactive REPL for executing commands on layers
 *
 * Executes commands directly on the active layer's control using layer.control.run().
 * No ad-hoc command handling - uses the real LayeredControl API.
 */

import { useEffect, useRef, useState } from "react";
import { useLayer, useLayeredControl } from "../hooks/useLayeredControl.jsx";
import { useWorkspace } from "@bassline/parser-react";

export function ReplPanel() {
    const lc = useLayeredControl();
    const { activeLayer } = useWorkspace();
    const layer = useLayer(activeLayer);  // Now handles null gracefully
    console.log("layer: ", activeLayer, layer);

    const [input, setInput] = useState("");
    const [output, setOutput] = useState([]);
    const outputRef = useRef(null);

    // Auto-scroll to bottom when output changes
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    const handleExecute = () => {
        if (!input.trim()) return;

        const command = input.trim();

        // Add to output immediately
        setOutput((prev) => [...prev, { type: "input", content: command }]);

        if (!activeLayer || !layer) {
            setOutput((prev) => [
                ...prev,
                { type: "error", content: "No active layer selected" },
            ]);
            setInput("");
            return;
        }

        try {
            // Execute command using the layer's run() method (layer is already a Control)
            const results = layer.run(command);

            // Display results
            if (results && results.length > 0) {
                results.forEach((result) => {
                    setOutput((prev) => [
                        ...prev,
                        {
                            type: "success",
                            content: JSON.stringify(result, null, 2),
                        },
                    ]);
                });
            } else {
                setOutput((prev) => [
                    ...prev,
                    { type: "success", content: "OK" },
                ]);
            }
        } catch (err) {
            setOutput((prev) => [
                ...prev,
                { type: "error", content: err.message || "Unknown error" },
            ]);
        }

        setInput("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleExecute();
        }
    };

    const quadCount = layer?.graph?.quads
        ? Object.keys(layer.graph.quads).length
        : 0;

    return (
        <div className="flex flex-col h-full bg-card border rounded-lg">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                <div>
                    <h3 className="text-lg font-semibold">REPL</h3>
                    <p className="text-xs text-muted-foreground">
                        {activeLayer
                            ? `Executing on: ${activeLayer}`
                            : "No layer selected"}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                        Quads:
                    </span>
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-200 text-slate-800">
                        {quadCount}
                    </span>
                </div>
            </div>

            {/* Output area */}
            <div
                ref={outputRef}
                className="flex-1 overflow-auto p-4 font-mono text-sm bg-slate-900 text-slate-100"
            >
                {output.length === 0
                    ? (
                        <div className="text-slate-500 italic">
                            Enter Bassline commands below...
                        </div>
                    )
                    : (
                        output.map((entry, i) => (
                            <div key={i} className="mb-2">
                                {entry.type === "input" && (
                                    <div className="text-blue-400">
                                        <span className="text-slate-500">
                                            $
                                        </span>
                                        {entry.content}
                                    </div>
                                )}
                                {entry.type === "success" && (
                                    <div className="text-green-400 ml-2 whitespace-pre-wrap">
                                        {entry.content}
                                    </div>
                                )}
                                {entry.type === "error" && (
                                    <div className="text-red-400 ml-2">
                                        Error: {entry.content}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
            </div>

            {/* Input area */}
            <div className="p-4 border-t bg-slate-50">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={activeLayer
                            ? "Enter Bassline command..."
                            : "Select a layer first..."}
                        disabled={!activeLayer}
                        className="flex-1 px-3 py-2 border rounded font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                    />
                    <button
                        onClick={handleExecute}
                        disabled={!activeLayer || !input.trim()}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                    >
                        Execute
                    </button>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                    Press Enter to execute • Uses layer.control.run()
                </div>
            </div>
        </div>
    );
}
