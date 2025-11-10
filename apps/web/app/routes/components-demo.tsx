import { useEffect, useState } from "react";
import type { Route } from "./+types/components-demo";
import { createBrowserGraph } from "@bassline/parser/browser";
import { GraphProvider } from "@bassline/parser-react/hooks";
import { EntityCard, QuadTable, PatternEditor, Inspector } from "@bassline/parser-react/components";
import { pattern, patternQuad as pq, v, w, q } from "@bassline/parser/algebra";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Bassline Components Demo" },
        {
            name: "description",
            content: "Demo of graph-native React components",
        },
    ];
}

// Module-level singleton graph
const { graph, events } = createBrowserGraph();

export default function ComponentsDemo() {
    const [selectedEntity, setSelectedEntity] = useState<any>(w("alice"));
    const [patternMatches, setPatternMatches] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState<"entity" | "table" | "editor" | "inspector">("entity");

    // Add initial demo data
    useEffect(() => {
        console.log("useEffect running, current graph size:", graph.quads.length);

        // Always add data for demo purposes
        graph.add(q(w("alice"), w("age"), 30, w("demo")));
        graph.add(q(w("alice"), w("city"), w("nyc"), w("demo")));
        graph.add(q(w("alice"), w("likes"), w("bob"), w("demo")));
        graph.add(q(w("alice"), w("status"), w("active"), w("demo")));

        graph.add(q(w("bob"), w("age"), 25, w("demo")));
        graph.add(q(w("bob"), w("city"), w("sf"), w("demo")));
        graph.add(q(w("bob"), w("likes"), w("charlie"), w("demo")));
        graph.add(q(w("bob"), w("status"), w("active"), w("demo")));

        graph.add(q(w("charlie"), w("age"), 35, w("demo")));
        graph.add(q(w("charlie"), w("city"), w("nyc"), w("demo")));
        graph.add(q(w("charlie"), w("likes"), w("alice"), w("demo")));
        graph.add(q(w("charlie"), w("status"), w("inactive"), w("demo")));

        // Organizations
        graph.add(q(w("acme"), w("type"), w("company"), w("demo")));
        graph.add(q(w("acme"), w("city"), w("nyc"), w("demo")));
        graph.add(q(w("alice"), w("works-at"), w("acme"), w("demo")));

        console.log("Graph populated with", graph.quads.length, "quads");
        console.log("Sample quads:", graph.quads.slice(0, 3));
        console.log("Graph object:", graph);
    }, []);

    // Demo pattern for QuadTable
    const demoPattern = pattern(
        pq(v("person"), w("age"), v("age")),
        pq(v("person"), w("city"), v("city"))
    );

    const handlePatternExecute = (pat: any, matches: any[]) => {
        console.log("Pattern executed:", matches);
        setPatternMatches(matches);
    };

    return (
        <GraphProvider graph={graph}>
            <div className="min-h-screen bg-slate-50">
                {/* Header */}
                <div className="border-b bg-white">
                    <div className="container mx-auto px-6 py-6">
                        <h1 className="text-3xl font-bold mb-2">
                            Graph-Native Components Demo
                        </h1>
                        <p className="text-sm text-slate-600">
                            Testing Phase 2: EntityCard, QuadTable, PatternEditor, Inspector
                        </p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="border-b bg-white">
                    <div className="container mx-auto px-6">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setActiveTab("entity")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "entity"
                                        ? "border-b-2 border-blue-500 text-blue-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                EntityCard
                            </button>
                            <button
                                onClick={() => setActiveTab("table")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "table"
                                        ? "border-b-2 border-blue-500 text-blue-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                QuadTable
                            </button>
                            <button
                                onClick={() => setActiveTab("editor")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "editor"
                                        ? "border-b-2 border-blue-500 text-blue-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                PatternEditor
                            </button>
                            <button
                                onClick={() => setActiveTab("inspector")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "inspector"
                                        ? "border-b-2 border-blue-500 text-blue-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                Inspector
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="container mx-auto px-6 py-8">
                    {/* EntityCard Tab */}
                    {activeTab === "entity" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">EntityCard Component</h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Displays all attributes of a single entity with click-to-inspect
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">Alice</h3>
                                    <EntityCard
                                        entityId={w("alice")}
                                        events={events}
                                        onInspect={(value) => {
                                            console.log("Inspect:", value);
                                            setSelectedEntity(value);
                                        }}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">Bob</h3>
                                    <EntityCard
                                        entityId={w("bob")}
                                        events={events}
                                        onInspect={(value) => {
                                            console.log("Inspect:", value);
                                            setSelectedEntity(value);
                                        }}
                                    />
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">Charlie</h3>
                                    <EntityCard
                                        entityId={w("charlie")}
                                        events={events}
                                        onInspect={(value) => {
                                            console.log("Inspect:", value);
                                            setSelectedEntity(value);
                                        }}
                                    />
                                </div>
                            </div>

                            {selectedEntity && (
                                <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                    <h3 className="text-sm font-medium text-blue-900 mb-2">
                                        Last Inspected Entity
                                    </h3>
                                    <p className="text-sm text-blue-700 font-mono">{String(selectedEntity)}</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* QuadTable Tab */}
                    {activeTab === "table" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">QuadTable Component</h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Displays pattern match results in a table with dynamic columns
                                </p>
                            </div>

                            <div className="bg-slate-100 p-4 rounded-lg mb-4">
                                <h3 className="text-sm font-medium text-slate-700 mb-2">Pattern:</h3>
                                <pre className="text-xs font-mono text-slate-600">
                                    {`pattern(\n  pq(v("person"), w("age"), v("age")),\n  pq(v("person"), w("city"), v("city"))\n)`}
                                </pre>
                            </div>

                            <QuadTable
                                pattern={demoPattern}
                                events={events}
                                onInspect={(value) => {
                                    console.log("Table inspect:", value);
                                    setSelectedEntity(value);
                                    setActiveTab("inspector");
                                }}
                            />
                        </div>
                    )}

                    {/* PatternEditor Tab */}
                    {activeTab === "editor" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">PatternEditor Component</h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Interactive pattern input with validation and live results
                                </p>
                            </div>

                            <div className="max-w-3xl">
                                <PatternEditor
                                    initialValue="?person age ?age *"
                                    onExecute={handlePatternExecute}
                                    onError={(err) => console.error("Pattern error:", err)}
                                    showResultCount={true}
                                />
                            </div>

                            {patternMatches.length > 0 && (
                                <div className="max-w-3xl mt-6">
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">
                                        Pattern Results ({patternMatches.length} matches)
                                    </h3>
                                    <div className="bg-white border rounded-lg p-4">
                                        <pre className="text-xs font-mono text-slate-600 overflow-x-auto">
                                            {JSON.stringify(
                                                patternMatches.map(m => {
                                                    const obj: any = {};
                                                    for (const key in m.bindings) {
                                                        obj[key] = String(m.bindings[key]);
                                                    }
                                                    return obj;
                                                }),
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                </div>
                            )}

                            <div className="max-w-3xl mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <h3 className="text-sm font-medium text-amber-900 mb-2">
                                    Try These Patterns:
                                </h3>
                                <ul className="text-sm text-amber-800 space-y-1 font-mono">
                                    <li>• ?person age ?age *</li>
                                    <li>• ?person city NYC *</li>
                                    <li>• ?person likes ?target *</li>
                                    <li>• ?x type COMPANY *</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* Inspector Tab */}
                    {activeTab === "inspector" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">Inspector Component</h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Navigate entity relationships with breadcrumb trail
                                </p>
                            </div>

                            <div className="max-w-4xl">
                                <Inspector
                                    initialEntity={w("alice")}
                                    events={events}
                                    onNavigate={(entity) => {
                                        console.log("Navigated to:", entity);
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </GraphProvider>
    );
}
