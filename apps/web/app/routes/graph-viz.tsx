import { useEffect, useState } from "react";
import type { Route } from "./+types/graph-viz";
import { createBrowserGraph } from "@bassline/parser/browser";
import { GraphVisualization } from "@bassline/parser-react";
import { parseProgram } from "@bassline/parser/parser";
import { pat, pq, q, v, w } from "@bassline/parser/algebra";
import { ReplInput } from "~/components/ReplInput";
import { QueryResultsTable } from "~/components/QueryResultsTable";
import { GraphStatsPanel } from "~/components/GraphStatsPanel";
import { ContextSelector } from "~/components/ContextSelector";
import { ErrorDisplay } from "~/components/ErrorDisplay";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Bassline Interactive REPL" },
        {
            name: "description",
            content: "Interactive graph REPL with real-time visualization",
        },
    ];
}

// Module-level singleton (persists across navigation)
// Creates graph with all browser-compatible extensions:
// - Reified rules (graph-native rule storage)
// - IO Compute (18 math operations: add, subtract, multiply, etc.)
// - IO Effects (console: LOG, ERROR, WARN + HTTP: HTTP_GET, HTTP_POST)
const { graph, events } = createBrowserGraph();

export default function GraphViz() {
    const [queryResults, setQueryResults] = useState<any[]>([]);
    const [filterContext, setFilterContext] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Add initial demo data
    useEffect(() => {
        // Only add if graph is empty
        if (graph.quads.length === 0) {
            graph.add(q(w("alice"), w("age"), 30, w("demo")));
            graph.add(q(w("alice"), w("city"), w("nyc"), w("demo")));
            graph.add(q(w("bob"), w("age"), 25, w("demo")));
            graph.add(q(w("bob"), w("city"), w("sf"), w("demo")));
        }
    }, []);

    const handleExecute = (input: string) => {
        try {
            setError(null);
            const commands = parseProgram(input);
            const results = commands.map((fn) => fn(graph));

            // Check if this was a query that returned results
            if (
                results[0] && Array.isArray(results[0]) &&
                results[0][0]?.bindings
            ) {
                setQueryResults(results[0]);
            } else {
                // Clear results for non-query commands
                setQueryResults([]);
            }
        } catch (err: any) {
            setError(err.message || "Unknown error");
            setQueryResults([]);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="container mx-auto p-6 space-y-4">
                {/* Header */}
                <div>
                    <h1 className="text-3xl font-bold mb-2">
                        Bassline Interactive REPL
                    </h1>
                    <p className="text-sm text-slate-600">
                        Execute pattern commands and explore the graph in
                        real-time
                    </p>
                </div>

                {/* REPL Input */}
                <ReplInput onExecute={handleExecute} />

                {/* Error Display */}
                {error && (
                    <ErrorDisplay
                        error={error}
                        onDismiss={() => setError(null)}
                    />
                )}

                {/* Query Results */}
                {queryResults.length > 0 && (
                    <QueryResultsTable results={queryResults} />
                )}

                {/* Stats & Context Filter */}
                <div className="flex gap-4 items-center">
                    <GraphStatsPanel graph={graph} events={events} />
                    <ContextSelector
                        graph={graph}
                        events={events}
                        value={filterContext}
                        onChange={setFilterContext}
                    />
                </div>

                {/* Graph Visualization */}
                <div
                    className="border rounded-lg bg-white"
                    style={{ height: "500px" }}
                >
                    <GraphVisualization
                        graph={graph}
                        events={events}
                        filterContext={filterContext}
                    />
                </div>
            </div>
        </div>
    );
}
