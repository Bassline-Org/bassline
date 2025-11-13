import { pattern } from "@bassline/parser/algebra";
import { getString } from "@bassline/parser/algebra/reified-rules";
import { parsePatterns, toPatternQuad } from "@bassline/parser/parser";
import { useCallback, useReducer } from "react";
import { useEffect, useRef, useState } from "react";
import { createContext, useContext } from "react";

const graphContext = createContext(null);

export function GraphProvider({ graph, children }) {
    const graphRef = useRef(null);
    if (!graphRef.current) {
        graphRef.current = graph;
    }
    return (
        <graphContext.Provider value={graphRef.current}>
            {children}
        </graphContext.Provider>
    );
}

export function useGraph() {
    const graph = useContext(graphContext);
    if (!graph) {
        throw new Error("useGraph must be used within a GraphProvider");
    }
    return graph;
}

export function useRule({ where, not, callback }) {
    const graph = useGraph();
    const callbackRef = useRef();

    useEffect(() => {
        callbackRef.current = callback;
    });

    useEffect(() => {
        const whereQuads = parsePatterns(where).map(toPatternQuad);
        const notQuads = not && parsePatterns(not).map(toPatternQuad);
        const pat = pattern(...whereQuads);
        if (not && notQuads.length > 0) {
            pat.setNAC(...notQuads);
        }

        const unwatch = graph.watch({
            pattern: pat,
            production: (match) => {
                callbackRef.current?.(match);
                return [];
            },
        });

        return unwatch;
    }, [graph, where, not]);
}

export function useMatchTable({ where, not, onMatch }) {
    const [table, setTable] = useState({});
    const onMatchRef = useRef();

    useEffect(() => {
        onMatchRef.current = onMatch;
    });

    useRule({
        where,
        not,
        callback: useCallback((match) => {
            setTable((prev) => onMatchRef.current?.(match, prev) ?? prev);
        }, []),
    });

    return table;
}

export function byKey(keyVar, transform = (match) => match.bindingObject()) {
    return (match, prev) => {
        const key = getString(match.get(keyVar));
        const value = transform(match);
        return {
            ...prev,
            [key]: {
                ...prev[key],
                ...value,
            },
        };
    };
}

export function byKeys(
    [outerKey, innerKey],
    valueTransform = (match) => match.bindingObject(),
) {
    return (match, prev) => {
        const outer = getString(match.get(outerKey));
        const inner = getString(match.get(innerKey));
        const value = valueTransform(match);

        return {
            ...prev,
            [outer]: {
                ...prev[outer],
                [inner]: value,
            },
        };
    };
}
