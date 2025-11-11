import { useEffect, useState } from "react";
import type { Route } from "./+types/components-demo";
import { createBrowserGraph } from "@bassline/parser/browser";
import { GraphProvider } from "@bassline/parser-react/hooks";
import {
    EntityCard,
    EntityList,
    GraphStats,
    Inspector,
    PatternEditor,
    QuadForm,
    QuadTable,
    RuleDebugger,
    RuleEditor,
    RuleList,
} from "@bassline/parser-react/components";
import { pattern, patternQuad as pq, q, v, w } from "@bassline/parser/algebra";

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
    const [selectedRule, setSelectedRule] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<
        | "entity"
        | "table"
        | "editor"
        | "inspector"
        | "list"
        | "form"
        | "stats"
        | "rules-list"
        | "rules-editor"
        | "rules-debugger"
    >("entity");

    // Add initial demo data
    useEffect(() => {
        console.log(
            "useEffect running, current graph size:",
            graph.quads.length,
        );

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
        pq(v("person"), w("city"), v("city")),
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
                            Phase 2: View & Navigate | Phase 3: Forms, Lists &
                            Stats | Phase 4: Rules & Automation
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
                            <button
                                onClick={() => setActiveTab("list")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "list"
                                        ? "border-b-2 border-green-500 text-green-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                EntityList
                            </button>
                            <button
                                onClick={() => setActiveTab("form")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "form"
                                        ? "border-b-2 border-green-500 text-green-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                QuadForm
                            </button>
                            <button
                                onClick={() => setActiveTab("stats")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "stats"
                                        ? "border-b-2 border-green-500 text-green-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                GraphStats
                            </button>
                            <button
                                onClick={() => setActiveTab("rules-list")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "rules-list"
                                        ? "border-b-2 border-purple-500 text-purple-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                RuleList
                            </button>
                            <button
                                onClick={() => setActiveTab("rules-editor")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "rules-editor"
                                        ? "border-b-2 border-purple-500 text-purple-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                RuleEditor
                            </button>
                            <button
                                onClick={() => setActiveTab("rules-debugger")}
                                className={`px-6 py-3 font-medium transition-all ${
                                    activeTab === "rules-debugger"
                                        ? "border-b-2 border-purple-500 text-purple-600"
                                        : "text-slate-600 hover:text-slate-900"
                                }`}
                            >
                                RuleDebugger
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
                                <h2 className="text-xl font-semibold mb-2">
                                    EntityCard Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Displays all attributes of a single entity
                                    with click-to-inspect
                                </p>
                            </div>

                            <div className="grid grid-cols-3 gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">
                                        Alice
                                    </h3>
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
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">
                                        Bob
                                    </h3>
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
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">
                                        Charlie
                                    </h3>
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
                                    <p className="text-sm text-blue-700 font-mono">
                                        {String(selectedEntity)}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* QuadTable Tab */}
                    {activeTab === "table" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    QuadTable Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Displays pattern match results in a table
                                    with dynamic columns
                                </p>
                            </div>

                            <div className="bg-slate-100 p-4 rounded-lg mb-4">
                                <h3 className="text-sm font-medium text-slate-700 mb-2">
                                    Pattern:
                                </h3>
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
                                <h2 className="text-xl font-semibold mb-2">
                                    PatternEditor Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Interactive pattern input with validation
                                    and live results
                                </p>
                            </div>

                            <div className="max-w-3xl">
                                <PatternEditor
                                    initialValue="?person age ?age *"
                                    onExecute={handlePatternExecute}
                                    onError={(err) =>
                                        console.error("Pattern error:", err)}
                                    showResultCount={true}
                                />
                            </div>

                            {patternMatches.length > 0 && (
                                <div className="max-w-3xl mt-6">
                                    <h3 className="text-sm font-medium text-slate-700 mb-3">
                                        Pattern Results ({patternMatches.length}
                                        {" "}
                                        matches)
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
                                <h2 className="text-xl font-semibold mb-2">
                                    Inspector Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Navigate entity relationships with
                                    breadcrumb trail
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

                    {/* EntityList Tab */}
                    {activeTab === "list" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    EntityList Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Browse and filter all entities in the graph
                                </p>
                            </div>

                            <div className="max-w-2xl">
                                <EntityList
                                    events={events}
                                    onSelect={(entity) => {
                                        console.log("Selected entity:", entity);
                                        setSelectedEntity(entity);
                                        setActiveTab("inspector");
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* QuadForm Tab */}
                    {activeTab === "form" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    QuadForm Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Create new quads and add data to the graph
                                </p>
                            </div>

                            <div className="max-w-2xl">
                                <QuadForm
                                    onSubmit={(quad) => {
                                        console.log("Quad added:", quad);
                                    }}
                                />
                            </div>

                            <div className="max-w-2xl mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <h3 className="text-sm font-medium text-green-900 mb-2">
                                    Try Adding:
                                </h3>
                                <ul className="text-sm text-green-800 space-y-1">
                                    <li>
                                        • source:{" "}
                                        <span className="font-mono">dave</span>,
                                        attr:{" "}
                                        <span className="font-mono">age</span>,
                                        target:{" "}
                                        <span className="font-mono">40</span>
                                    </li>
                                    <li>
                                        • source:{" "}
                                        <span className="font-mono">dave</span>,
                                        attr:{" "}
                                        <span className="font-mono">city</span>,
                                        target:{" "}
                                        <span className="font-mono">la</span>
                                    </li>
                                    <li>
                                        • source:{" "}
                                        <span className="font-mono">acme</span>,
                                        attr:{" "}
                                        <span className="font-mono">
                                            employees
                                        </span>, target:{" "}
                                        <span className="font-mono">150</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* GraphStats Tab */}
                    {activeTab === "stats" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    GraphStats Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    View graph statistics and metrics
                                </p>
                            </div>

                            <div className="max-w-2xl">
                                <GraphStats events={events} />
                            </div>
                        </div>
                    )}

                    {/* RuleList Tab */}
                    {activeTab === "rules-list" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    RuleList Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Browse and manage reified rules with
                                    activation controls
                                </p>
                            </div>

                            <div className="max-w-3xl">
                                <RuleList
                                    events={events}
                                    onSelect={(ruleName) => {
                                        console.log("Selected rule:", ruleName);
                                        setSelectedRule(ruleName);
                                        setActiveTab("rules-debugger");
                                    }}
                                    onToggle={(ruleName, active) => {
                                        console.log(
                                            "Toggled rule:",
                                            ruleName,
                                            "active:",
                                            active,
                                        );
                                    }}
                                />
                            </div>

                            <div className="max-w-3xl mt-8 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                <h3 className="text-sm font-medium text-purple-900 mb-2">
                                    About Reified Rules:
                                </h3>
                                <ul className="text-sm text-purple-800 space-y-1">
                                    <li>
                                        • Rules are stored as edges in the graph
                                        (graph-native)
                                    </li>
                                    <li>
                                        • Click "Activate" to make a rule
                                        reactive
                                    </li>
                                    <li>
                                        • Active rules automatically fire when
                                        patterns match
                                    </li>
                                    <li>
                                        • Click a rule to see detailed debugging
                                        info
                                    </li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* RuleEditor Tab */}
                    {activeTab === "rules-editor" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    RuleEditor Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Create new reified rules with live pattern
                                    validation
                                </p>
                            </div>

                            <div className="max-w-3xl">
                                <RuleEditor
                                    initialRuleName="has-age"
                                    events={events}
                                    onSave={(rule) => {
                                        console.log("Saved rule:", rule);
                                        //setActiveTab("rules-list");
                                    }}
                                />
                            </div>

                            <div className="max-w-3xl mt-8 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                                <h3 className="text-sm font-medium text-purple-900 mb-2">
                                    Try These Example Rules:
                                </h3>
                                <div className="text-sm text-purple-800 space-y-3">
                                    <div>
                                        <p className="font-semibold">
                                            Adult Checker:
                                        </p>
                                        <p className="font-mono text-xs">
                                            Match: ?person age ?age *
                                        </p>
                                        <p className="font-mono text-xs">
                                            Produce: ?person adult TRUE *
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">
                                            NYC Residents:
                                        </p>
                                        <p className="font-mono text-xs">
                                            Match: ?person city nyc *
                                        </p>
                                        <p className="font-mono text-xs">
                                            Produce: ?person location-type urban
                                            *
                                        </p>
                                    </div>
                                    <div>
                                        <p className="font-semibold">
                                            Friendship Symmetry:
                                        </p>
                                        <p className="font-mono text-xs">
                                            Match: ?a likes ?b *
                                        </p>
                                        <p className="font-mono text-xs">
                                            Produce: ?b friend-of ?a *
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RuleDebugger Tab */}
                    {activeTab === "rules-debugger" && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-semibold mb-2">
                                    RuleDebugger Component
                                </h2>
                                <p className="text-sm text-slate-600 mb-6">
                                    Deep inspection of rule execution and
                                    produced quads
                                </p>
                            </div>

                            {selectedRule
                                ? (
                                    <div className="max-w-4xl">
                                        <RuleDebugger
                                            ruleName={selectedRule}
                                            events={events}
                                            onClose={() =>
                                                setActiveTab("rules-list")}
                                        />
                                    </div>
                                )
                                : (
                                    <div className="max-w-3xl p-8 bg-slate-50 border border-slate-200 rounded-lg text-center">
                                        <p className="text-slate-600 mb-4">
                                            No rule selected. Please select a
                                            rule from the RuleList tab.
                                        </p>
                                        <button
                                            onClick={() =>
                                                setActiveTab("rules-list")}
                                            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                                        >
                                            Go to RuleList
                                        </button>
                                    </div>
                                )}
                        </div>
                    )}
                </div>
            </div>
        </GraphProvider>
    );
}
