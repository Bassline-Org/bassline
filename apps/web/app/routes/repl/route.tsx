import { useState } from "react";
import { RuntimeProvider, useEvaluate } from "~/lib/RuntimeProvider";
import { DisplayValue } from "~/lib/BasicView";

function ReplInner() {
    const [code, setCode] = useState("example-view");
    const [results, setResults] = useState<any[]>([]);
    const evaluate = useEvaluate();

    return (
        <div>
            <h1>Repl</h1>
            <div>
                {results.map((result, index) => (
                    <DisplayValue key={index} value={result} />
                ))}
            </div>
            <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        const result = evaluate(code);
                        console.log("Result", result);
                        setResults([...results, result]);
                    }
                }}
            />
        </div>
    );
}

export default function ReplRoute() {
    return (
        <RuntimeProvider>
            <ReplInner />
        </RuntimeProvider>
    );
}
