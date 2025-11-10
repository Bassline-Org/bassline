import { useState, useEffect } from "react";
import { Graph } from "@bassline/parser/algebra";
import { Button } from "~/components/ui/button";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import { parseProgram } from "@bassline/parser/parser";
import { ReplInput } from "~/components/ReplInput";

interface ViewQueryPanelProps {
    graph: any;
    events: EventTarget;
    onFilterChange: (quads: any[] | null) => void;
}

export function ViewQueryPanel({ graph, events, onFilterChange }: ViewQueryPanelProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [matchCount, setMatchCount] = useState<number | null>(null);
    const [isActive, setIsActive] = useState(false);
    const [queryPattern, setQueryPattern] = useState<string | null>(null);

    const handleExecute = (input: string) => {
        try {
            setError(null);

            if (!input.trim()) {
                // Empty query = show all
                onFilterChange(null);
                setMatchCount(null);
                setIsActive(false);
                setQueryPattern(null);
                return;
            }

            // Store the query pattern for reactive re-execution
            setQueryPattern(input);

            // Parse and execute the query directly (no wrapping)
            const commands = parseProgram(input);
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
                setIsActive(true);
            } else {
                onFilterChange([]);
                setMatchCount(0);
                setIsActive(false);
            }
        } catch (err: any) {
            setError(err.message || "Failed to parse query");
            onFilterChange(null);
            setMatchCount(null);
            setIsActive(false);
        }
    };

    const handleClear = () => {
        setError(null);
        setMatchCount(null);
        setIsActive(false);
        setQueryPattern(null);
        onFilterChange(null);
    };

    // Subscribe to graph events and re-execute query when quads are added
    useEffect(() => {
        if (!queryPattern) return;

        const reExecuteQuery = () => {
            try {
                // Parse and execute the stored query
                const commands = parseProgram(queryPattern);
                const results = commands.map((fn: any) => fn(graph));

                // Extract matched quads from results
                if (results[0] && Array.isArray(results[0])) {
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
                // Silent failure - don't show errors on auto-refresh
                console.error("View query re-execution error:", err);
            }
        };

        // Subscribe to quad-added events
        events.addEventListener("quad-added", reExecuteQuery);
        return () => events.removeEventListener("quad-added", reExecuteQuery);
    }, [queryPattern, graph, events, onFilterChange]);

    return (
        <div className="border rounded-lg bg-white shadow-sm">
            {/* Header */}
            <div className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 flex-1"
                >
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
                </button>
                {isActive && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClear}
                        className="h-6 px-2"
                    >
                        <X className="w-3 h-3" />
                    </Button>
                )}
            </div>

            {/* Panel Content */}
            {isOpen && (
                <div className="p-3 pt-0 space-y-2 border-t">
                    <div className="text-xs text-slate-600 mb-2">
                        Enter a query to filter the visualization. Examples:
                        <ul className="mt-1 ml-4 list-disc space-y-0.5 font-mono">
                            <li>query where &#123; ?person age ?a * &#125;</li>
                            <li>query where &#123; alice ?attr ?value * &#125;</li>
                            <li>query where &#123; ?x city nyc * &#125;</li>
                        </ul>
                    </div>

                    <ReplInput onExecute={handleExecute} />

                    {error && (
                        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            {error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
