import { createRuntime } from "@bassline/lang/runtime";
import { useEffect, useState } from "react";
import { Outlet } from "react-router";
import { ValueDisplay } from "~/lib/ValueDisplay";
import {
    RuntimeProvider,
    useEvaluate,
    useRuntime,
} from "~/lib/RuntimeProvider";

function ReplInner() {
    const [code, setCode] = useState("");
    const [results, setResults] = useState<any[]>([]);
    const evaluate = useEvaluate();

    return (
        <div>
            <h1>Repl</h1>
            <div>
                {results.map((result, index) => (
                    <div key={index}>
                        <ValueDisplay value={result} />
                    </div>
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
