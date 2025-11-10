import { useState } from "react";
import { Graph } from "@bassline/parser/algebra";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { parseProgram } from "@bassline/parser/parser";

interface ViewQueryPanelProps {
    graph: any;
    onFilterChange: (quads: any[] | null) => void;
}

export function ViewQueryPanel({ graph, onFilterChange }: ViewQueryPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [queryInput, setQueryInput] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [matchCount, setMatchCount] = useState<number | null>(null);

    const handleApplyFilter = () => {
        try {
            setError(null);

            if (!queryInput.trim()) {
                // Empty query = show all
                onFilterChange(null);
                setMatchCount(null);
                return;
            }

            // Parse the pattern by wrapping it in a query command
            const wrappedQuery = `query ${queryInput} `;
            const commands = parseProgram(wrappedQuery);

            // Execute the query on the graph
            const results = commands.map((fn) => fn(graph));
            console.log("view query results:", results);

            // Extract matched quads from results
            if (results[0] && Array.isArray(results[0])) {
                // results[0] is an array of Match objects with { bindings, quads }
                const allQuads = results[0].flatMap((match: any) =>
                    match.quads || []
                );
                const viewGraph = new Graph(...allQuads);

                onFilterChange(viewGraph.quads);
                setMatchCount(viewGraph.quads.length);
            } else {
                onFilterChange([]);
                setMatchCount(0);
            }
        } catch (err: any) {
            setError(err.message || "Failed to parse query");
            onFilterChange(null);
            setMatchCount(null);
        }
    };

    const handleClear = () => {
        setQueryInput("");
        setError(null);
        setMatchCount(null);
        onFilterChange(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleApplyFilter();
        }
    };

    return (
        <div className="border rounded-lg bg-white shadow-sm">
            {/* Header */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
            >
                <div className="flex items-center gap-2">
                    {isOpen
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    <span className="font-medium text-sm">
                        View Query Filter
                    </span>
                    {matchCount !== null && (
                        <span className="text-xs text-slate-500">
                            ({matchCount} quad{matchCount !== 1 ? "s" : ""}{" "}
                            matched)
                        </span>
                    )}
                </div>
                {queryInput && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClear();
                        }}
                        className="h-6 px-2"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                )}
            </button>

            {/* Panel Content */}
            {isOpen && (
                <div className="p-3 pt-0 space-y-2 border-t">
                    <div className="text-xs text-slate-600 mb-2">
                        Enter a pattern to filter the visualization. Examples:
                        <ul className="mt-1 ml-4 list-disc space-y-0.5 font-mono">
                            <li>?x age ?a *</li>
                            <li>alice ?attr ?value *</li>
                            <li>?person city nyc *</li>
                        </ul>
                    </div>

                    <Textarea
                        value={queryInput}
                        onChange={(e) => setQueryInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="?entity ?attribute ?value *"
                        className="font-mono text-sm min-h-[60px]"
                        rows={2}
                    />

                    {error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {error}
                        </div>
                    )}

                    <div className="flex gap-2">
                        <Button
                            onClick={handleApplyFilter}
                            size="sm"
                            className="flex-1"
                        >
                            Apply Filter
                        </Button>
                        <Button
                            onClick={handleClear}
                            variant="outline"
                            size="sm"
                        >
                            Clear
                        </Button>
                    </div>

                    <div className="text-xs text-slate-500 italic">
                        Press Cmd+Enter (or Ctrl+Enter) to apply
                    </div>
                </div>
            )}
        </div>
    );
}
