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
import { VisualizationModeSwitcher, type ViewMode } from "~/components/VisualizationModeSwitcher";
import { QuadsTableView } from "~/components/QuadsTableView";
import { ViewQueryPanel } from "~/components/ViewQueryPanel";
import { ForceControlsPanel, type ForceLayoutOptions } from "~/components/ForceControlsPanel";
import { FileText } from "lucide-react";

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
    const [viewMode, setViewMode] = useState<ViewMode>("graph");
    const [filteredQuads, setFilteredQuads] = useState<any[] | null>(null);
    const [layoutOptions, setLayoutOptions] = useState<ForceLayoutOptions>({
        charge: -300,
        linkDistance: 100,
        linkStrength: 0.5,
        collisionRadius: 50,
        iterations: 300,
    });

    // Use filtered quads if available, otherwise use all quads from graph
    const displayQuads = filteredQuads || graph.quads;

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
                // Auto-switch to results view when query returns results
                setViewMode("results");
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
        <div className="flex flex-col min-h-screen bg-slate-50">
            {/* Compact Header */}
            <div className="border-b bg-white">
                <div className="container mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">
                                Bassline Interactive REPL
                            </h1>
                            <p className="text-xs text-slate-600">
                                Execute pattern commands and explore the graph in real-time
                            </p>
                        </div>
                        <div className="flex gap-4 items-center">
                            <GraphStatsPanel graph={graph} events={events} />
                            <ContextSelector
                                graph={graph}
                                events={events}
                                value={filterContext}
                                onChange={setFilterContext}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content: Horizontal Split */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Panel: REPL + Results + Filters */}
                <div className="w-[30%] flex flex-col border-r bg-white overflow-y-auto">
                    <div className="p-4 space-y-4">
                        {/* REPL Input */}
                        <div>
                            <h2 className="text-sm font-semibold text-slate-700 mb-2">
                                Command Input
                            </h2>
                            <ReplInput onExecute={handleExecute} />
                        </div>

                        {/* Error Display */}
                        {error && (
                            <ErrorDisplay
                                error={error}
                                onDismiss={() => setError(null)}
                            />
                        )}

                        {/* Query Results - Only show inline if not in results view mode */}
                        {queryResults.length > 0 && viewMode !== "results" && (
                            <div>
                                <h2 className="text-sm font-semibold text-slate-700 mb-2">
                                    Query Results
                                    <span className="text-xs text-slate-500 ml-2">
                                        (Switch to Results view for better display)
                                    </span>
                                </h2>
                                <QueryResultsTable results={queryResults} />
                            </div>
                        )}

                        {/* View Query Filter */}
                        <ViewQueryPanel
                            graph={graph}
                            events={events}
                            onFilterChange={setFilteredQuads}
                        />

                        {/* Force Layout Controls */}
                        <ForceControlsPanel
                            options={layoutOptions}
                            onChange={setLayoutOptions}
                        />
                    </div>
                </div>

                {/* Right Panel: Visualization */}
                <div className="flex-1 flex flex-col bg-slate-50">
                    {/* Visualization Controls */}
                    <div className="border-b bg-white px-4 py-3 flex items-center justify-between">
                        <h2 className="text-sm font-semibold text-slate-700">
                            Visualization
                        </h2>
                        <VisualizationModeSwitcher
                            value={viewMode}
                            onChange={setViewMode}
                        />
                    </div>

                    {/* Visualization Area - Fills Remaining Space */}
                    <div className="flex-1 p-4 overflow-hidden min-w-0">
                        {viewMode === "table" && (
                            <div className="h-full w-full overflow-auto">
                                <QuadsTableView quads={displayQuads} />
                            </div>
                        )}

                        {viewMode === "graph" && (
                            <div className="h-full border rounded-lg bg-white overflow-hidden">
                                <GraphVisualization
                                    graph={graph}
                                    events={events}
                                    filterContext={filterContext}
                                    filteredQuads={filteredQuads}
                                    layoutOptions={layoutOptions}
                                />
                            </div>
                        )}

                        {viewMode === "results" && (
                            <div className="h-full w-full overflow-auto">
                                {queryResults.length > 0 ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-sm font-medium text-slate-700">
                                                Query Results
                                            </h3>
                                            <div className="text-sm text-slate-600">
                                                {queryResults.length} result{queryResults.length !== 1 ? "s" : ""}
                                            </div>
                                        </div>
                                        <QueryResultsTable results={queryResults} />
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center">
                                        <div className="text-center text-slate-500">
                                            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p className="text-sm font-medium">No query results</p>
                                            <p className="text-xs mt-1">
                                                Execute a query to see results here
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {viewMode === "both" && (
                            <div className="h-full grid grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-2 overflow-hidden">
                                    <h3 className="text-sm font-medium text-slate-700">
                                        Table View
                                    </h3>
                                    <div className="flex-1 overflow-auto">
                                        <QuadsTableView quads={displayQuads} />
                                    </div>
                                </div>
                                <div className="flex flex-col space-y-2 overflow-hidden">
                                    <h3 className="text-sm font-medium text-slate-700">
                                        Graph View
                                    </h3>
                                    <div className="flex-1 border rounded-lg bg-white overflow-hidden">
                                        <GraphVisualization
                                            graph={graph}
                                            events={events}
                                            filterContext={filterContext}
                                            filteredQuads={filteredQuads}
                                            layoutOptions={layoutOptions}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
