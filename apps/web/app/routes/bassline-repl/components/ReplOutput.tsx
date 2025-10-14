interface OutputEntry {
    code: string;
    result: { ok: boolean; value?: any; error?: string };
}

interface ReplOutputProps {
    history: OutputEntry[];
}

function formatValue(value: any): string {
    // Handle Bassline value types
    if (value && typeof value === "object") {
        const constructorName = value.constructor?.name;

        // Bassline Num
        if (constructorName === "Num" && "value" in value) {
            return String(value.value);
        }

        // Bassline Str
        if (constructorName === "Str" && "value" in value) {
            return `"${value.value}"`;
        }

        // Bassline Block
        if (constructorName === "Block" && "items" in value) {
            return `[Block with ${value.items.length} items]`;
        }

        // Bassline Paren
        if (constructorName === "Paren" && "items" in value) {
            return `(Paren with ${value.items.length} items)`;
        }

        // Bassline Context
        if (constructorName === "Context" && "bindings" in value) {
            const bindingsCount = value.bindings.size;
            return `[Context with ${bindingsCount} bindings]`;
        }

        // Bassline Word types
        if (["Word", "SetWord", "LitWord"].includes(constructorName) && "spelling" in value) {
            return value.spelling.description;
        }
    }

    // Handle JS primitives
    if (typeof value === "string") return `"${value}"`;
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return String(value);
    if (value === null || value === undefined) return "none";

    // Fallback to JSON
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

export function ReplOutput({ history }: ReplOutputProps) {
    if (history.length === 0) {
        return (
            <div className="text-slate-400 text-sm">
                <p>Welcome to Bassline REPL!</p>
                <p className="mt-2">Try typing some code:</p>
                <code className="block mt-2 p-2 bg-slate-100 rounded text-xs">
                    x: 5<br />
                    y: + x 10<br />
                    print y
                </code>
            </div>
        );
    }

    return (
        <div className="space-y-4 font-mono text-sm">
            {history.map((entry, index) => (
                <div key={index} className="space-y-1">
                    {/* Input */}
                    <div className="flex gap-2">
                        <span className="text-slate-400">
                            [{index + 1}]
                        </span>
                        <span className="text-slate-600">
                            &gt;
                        </span>
                        <pre className="flex-1 whitespace-pre-wrap text-violet-700">
                            {entry.code}
                        </pre>
                    </div>

                    {/* Output */}
                    <div className="pl-8">
                        {entry.result.ok ? (
                            <div className="text-slate-900">
                                {formatValue(entry.result.value)}
                            </div>
                        ) : (
                            <div className="text-red-600">
                                Error: {entry.result.error}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
