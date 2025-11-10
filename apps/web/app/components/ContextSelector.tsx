import { useMemo } from "react";
import { useGraphQuads } from "@bassline/parser-react";
import {
    matchGraph,
    pattern,
    patternQuad,
} from "@bassline/parser/algebra/pattern";
import { variable as v, WC, serialize } from "@bassline/parser/types";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "~/components/ui/select";

interface ContextSelectorProps {
    graph: any;
    events: EventTarget;
    value: string | null;
    onChange: (context: string | null) => void;
}

export function ContextSelector({
    graph,
    events,
    value,
    onChange,
}: ContextSelectorProps) {
    // Subscribe to graph changes
    const quads = useGraphQuads(graph, events);

    // Get unique contexts via query
    const contexts = useMemo(() => {
        const contextMatches = matchGraph(
            graph,
            pattern(patternQuad(WC, WC, WC, v("ctx")))
        );
        const uniqueContexts = new Set(
            contextMatches.map((m) => serialize(m.get("ctx")))
        );
        return Array.from(uniqueContexts).sort();
    }, [quads, graph]);

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">Context:</span>
            <Select
                value={value || "all"}
                onValueChange={(val) => onChange(val === "all" ? null : val)}
            >
                <SelectTrigger className="w-[200px]">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All contexts</SelectItem>
                    {contexts.map((ctx) => (
                        <SelectItem key={ctx} value={ctx}>
                            {ctx}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
