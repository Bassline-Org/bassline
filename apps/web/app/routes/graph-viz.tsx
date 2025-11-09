import { useEffect, useState } from "react";
import type { Route } from "./+types/graph-viz";
import { WatchedGraph } from "@bassline/parser/algebra/watch";
import { instrument } from "@bassline/parser/algebra/instrument";
import { GraphVisualization } from "@bassline/parser-react";
import { quad as q } from "@bassline/parser/algebra/quad";
import { word as w } from "@bassline/parser/types";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Graph Visualization Test" },
        {
            name: "description",
            content: "Test the parser-react graph visualization",
        },
    ];
}

const graph = new WatchedGraph();
const events = instrument(graph);
export default function GraphViz() {
    // Add initial data
    useEffect(() => {
        // Add some entities and relationships
        graph.add(q(w("alice"), w("age"), 30, w("demo")));
        graph.add(q(w("alice"), w("city"), w("nyc"), w("demo")));
        graph.add(q(w("alice"), w("friend"), w("bob"), w("demo")));

        graph.add(q(w("bob"), w("age"), 25, w("demo")));
        graph.add(q(w("bob"), w("city"), w("sf"), w("demo")));
        graph.add(q(w("bob"), w("friend"), w("carol"), w("demo")));

        graph.add(q(w("carol"), w("age"), 35, w("demo")));
        graph.add(q(w("carol"), w("city"), w("la"), w("demo")));

        // Add more data over time to demonstrate real-time updates
        const timer1 = setTimeout(() => {
            console.log("Adding status quad...");
            graph.add(q(w("alice"), w("status"), w("admin"), w("demo")));
        }, 2000);

        const timer2 = setTimeout(() => {
            console.log("Adding friendship quad...");
            graph.add(q(w("carol"), w("friend"), w("alice"), w("demo")));
        }, 4000);

        return () => {
            clearTimeout(timer1);
            clearTimeout(timer2);
        };
    }, [graph]);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="p-4">
                <h1 className="text-2xl font-bold mb-4">
                    Graph Visualization Test
                </h1>
                <p className="text-sm text-slate-600 mb-4">
                    Watch the graph update in real-time as new quads are added
                    (at 2s and 4s).
                </p>
            </div>
            <div style={{ width: "100%", height: "calc(100vh - 120px)" }}>
                <GraphVisualization graph={graph} events={events} />
            </div>
        </div>
    );
}
