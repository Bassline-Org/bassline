import { useMemo } from "react";
import { useGraphQuads } from "@bassline/parser-react";
import {
    matchGraph,
    pattern,
    patternQuad,
} from "@bassline/parser/algebra/pattern";
import { variable as v, WC, serialize } from "@bassline/parser/types";
import { getActiveRules } from "@bassline/parser/algebra/reified-rules";
import { Card } from "~/components/ui/card";

interface GraphStatsPanelProps {
    graph: any;
    events: EventTarget;
}

export function GraphStatsPanel({ graph, events }: GraphStatsPanelProps) {
    // Subscribe to graph changes
    const quads = useGraphQuads(graph, events);

    // Get unique contexts via query
    const contextCount = useMemo(() => {
        const contextMatches = matchGraph(
            graph,
            pattern(patternQuad(WC, WC, WC, v("ctx")))
        );
        const uniqueContexts = new Set(
            contextMatches.map((m) => serialize(m.get("ctx")))
        );
        return uniqueContexts.size;
    }, [quads, graph]);

    // Get active rules
    const activeRulesCount = useMemo(() => {
        try {
            const rules = getActiveRules(graph);
            return rules.length;
        } catch (err) {
            return 0;
        }
    }, [quads, graph]);

    return (
        <Card className="p-4">
            <div className="flex gap-6 text-sm">
                <div>
                    <span className="text-slate-500">Quads:</span>{" "}
                    <span className="font-semibold">{quads.length}</span>
                </div>
                <div>
                    <span className="text-slate-500">Contexts:</span>{" "}
                    <span className="font-semibold">{contextCount}</span>
                </div>
                <div>
                    <span className="text-slate-500">Active Rules:</span>{" "}
                    <span className="font-semibold">{activeRulesCount}</span>
                </div>
            </div>
        </Card>
    );
}
