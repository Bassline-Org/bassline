import {
    byKeys,
    GraphProvider,
    useMatchTable,
} from "@bassline/parser-react/alt/useGraph";
import { getString } from "@bassline/parser/algebra/reified-rules";
import { Control } from "@bassline/parser/control";
import { useCallback } from "react";

export function SomeTable() {
    const onMatch = useCallback((match, prev) => {
        const ctx = getString(match.get("ctx"));
        const attr = getString(match.get("a"));
        const value = getString(match.get("v"));

        const newTable = { ...prev };

        if (!newTable._attrs) {
            newTable._attrs = new Set();
        }
        newTable._attrs.add(attr);

        if (!newTable[ctx]) {
            newTable[ctx] = {};
        }
        newTable[ctx][attr] = value;

        return newTable;
    }, []);

    const table = useMatchTable({
        where: "meta ?a ?v ?ctx",
        onMatch,
    });

    const attrs = Array.from(table._attrs || []);

    return (
        <table>
            <thead>
                <tr>
                    <th>Context</th>
                    {attrs.map((attr, i) => <th key={i}>{attr}</th>)}
                </tr>
            </thead>
            <tbody>
                {Object.entries(table).filter(([k]) => k !== "_attrs").map((
                    [ctx, attributes],
                    i,
                ) => (
                    <tr key={i}>
                        <td>{ctx}</td>
                        {attrs.map((attr, j) => (
                            <td key={`${i}-${j}`}>{attributes[attr] ?? ""}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

export function OtherTable() {
    const metaByContext = useMatchTable({
        where: "meta ?a ?v ?ctx",
        onMatch: byKeys(["ctx", "a"], (m) => m.get("v")),
    });

    const attrs = new Set();
    for (const attributes of Object.values(metaByContext)) {
        for (const attr of Object.keys(attributes)) {
            attrs.add(attr);
        }
    }
    const attrArr = Array.from(attrs);

    return (
        <table>
            <thead>
                <tr className="border-b">
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">
                        Context
                    </th>
                    {attrArr.map((attr, i) => (
                        <th
                            className="px-4 py-2 text-center font-medium text-muted-foreground"
                            key={i}
                        >
                            {attr}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {Object.entries(metaByContext).map(([ctx, attributes], i) => (
                    <tr
                        className="border-b hover:bg-muted/50 transition-colors"
                        key={i}
                    >
                        <td className="border-r px-4 py-2 text-center">
                            {ctx}
                        </td>
                        {attrArr.map((attr, j) => {
                            const val = attributes[attr]
                                ? getString(attributes[attr])
                                : "";
                            return (
                                <td
                                    className="border-r px-4 py-2 text-center"
                                    key={`${i}-${j}`}
                                >
                                    {val}
                                </td>
                            );
                        })}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const control = new Control();
const graph = control.graph;

export default function AltFlowOuter() {
    return (
        <GraphProvider graph={graph}>
            {/* <SomeTable /> */}
            <OtherTable />
        </GraphProvider>
    );
}

setTimeout(() => {
    control.run(`
        insert {
    in foo { meta uses bar }
    in other-foo { meta sync foo }

    in bar {
        meta slurp baz
        alice age 30
    }
    in baz {
        bob age 45
    }

    in system.alias {
        slurp as uses
    }
}

;; Manually writing a rule for example
insert {
    in core.alias {
        rule {
            where "
                ?e ?alias ?v ?c
                in system.alias {
                    ?alias as ?original
                }
            "
            produce "?e ?original ?v ?c"
        }
        meta {
            type rule!
            nac false
            docs "Renames a relationship"
        }
    }
}

rule core.meta.uses
    where {
        meta uses ?source ?target
    }
    produce {
        ?source forward ?target system.routing
    }

rule core.meta.sync
    where { meta sync ?source ?target }
    produce {
        in system.routing {
            ?source forward ?target
            ?target forward ?source
        }
    }

rule core.routing.forward
    where {
        ?e ?a ?v ?source
        in system.routing {
            ?source forward ?target
        }
    }
    not {
        meta ?a ?v ?source
    }
    produce {
        ?e ?a ?v ?target
    }

rule core.contexts
    where { ?e ?a ?v ?c }
    not { in system.contexts { ?c tracked true } }
    produce {
        in system.contexts {
            ?c tracked true
        }
    }

query
    where { in system.contexts { ?ctx * * } }

insert {
    in some-call {
        meta type call!
        add {
            x 123
            y 100
        }
        output {
            context some-result
            entity some-entity
            attribute some-label
        }
    }
}

query where { ?e ?a ?v some-result }

insert {
    in some-view {
        meta type view!
        view {
            kind table
            where "?e ?a ?v ?c"
            context foo
        }
    }

    in another-view {
        meta type view!
        view {
            kind table
            where "meta ?a ?v ?c"
            context foo
        }
    }
}

;; Get views on foo
query
    where {
        in ?ctx {
            meta {
                type view!
            }
            view {
                context foo
                kind ?kind
                where ?where
            }
        }
    }


; query
;     where {
;         in ?ctx {
;             meta {
;                 type operation!
;                 operation-type binary
;             }
;         }
;     }
;     produce {
;         in system.binary-ops {
;             ?ctx binary-op true
;         }
;     }

; query
;     where {
;         ?ctx binary-op true system.binary-ops
;         meta docs ?docs ?ctx
;     }
        `);
}, 5000);
