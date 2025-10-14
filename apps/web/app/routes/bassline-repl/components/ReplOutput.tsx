import { useState, useEffect } from "react";
import { SyntaxHighlight } from "./SyntaxHighlight";
import { useREPL } from "../../../lib/repl-context";

interface OutputEntry {
    code: string;
    result: { ok: boolean; value?: any; error?: string };
}

interface ReplOutputProps {
    history: OutputEntry[];
}

interface ValueRendererProps {
    value: any;
    depth?: number;
}

function ValueRenderer({ value, depth = 0 }: ValueRendererProps) {
    const [expanded, setExpanded] = useState(depth < 2);

    // Check if this is an inspected value (from inspect native)
    if (value && typeof value === "object" && value.type) {
        return <InspectedValue value={value} depth={depth} expanded={expanded} setExpanded={setExpanded} />;
    }

    // Handle Bassline value types (non-inspected)
    if (value && typeof value === "object") {
        const constructorName = value.constructor?.name;

        // Bassline Num
        if (constructorName === "Num" && "value" in value) {
            return <span className="text-blue-600">{String(value.value)}</span>;
        }

        // Bassline Str
        if (constructorName === "Str" && "value" in value) {
            return <span className="text-green-600">"{value.value}"</span>;
        }

        // Bassline Block
        if (constructorName === "Block" && "items" in value) {
            return (
                <ExpandableContainer
                    summary={`[Block with ${value.items.length} items]`}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                >
                    <div className="text-slate-500 text-xs ml-4 mt-1">
                        Use <code className="bg-slate-100 px-1 rounded">inspect</code> to see contents
                    </div>
                </ExpandableContainer>
            );
        }

        // Bassline Paren
        if (constructorName === "Paren" && "items" in value) {
            return (
                <ExpandableContainer
                    summary={`(Paren with ${value.items.length} items)`}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                >
                    <div className="text-slate-500 text-xs ml-4 mt-1">
                        Use <code className="bg-slate-100 px-1 rounded">inspect</code> to see contents
                    </div>
                </ExpandableContainer>
            );
        }

        // Bassline Context
        if (constructorName === "Context" && "bindings" in value) {
            const bindingsCount = value.bindings.size;
            return (
                <ExpandableContainer
                    summary={`[Context with ${bindingsCount} bindings]`}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                >
                    <div className="text-slate-500 text-xs ml-4 mt-1">
                        Use <code className="bg-slate-100 px-1 rounded">inspect</code> to see contents
                    </div>
                </ExpandableContainer>
            );
        }

        // Bassline Word types
        if (["Word", "SetWord", "LitWord"].includes(constructorName) && "spelling" in value) {
            return <span className="text-purple-600">{value.spelling.description}</span>;
        }
    }

    // Handle JS primitives
    if (typeof value === "string") return <span className="text-green-600">"{value}"</span>;
    if (typeof value === "number") return <span className="text-blue-600">{String(value)}</span>;
    if (typeof value === "boolean") return <span className="text-orange-600">{String(value)}</span>;
    if (value === null || value === undefined) return <span className="text-slate-400">none</span>;

    // Fallback to JSON
    try {
        return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
    } catch {
        return <span>{String(value)}</span>;
    }
}

interface InspectedValueProps {
    value: any;
    depth: number;
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
}

function InspectedValue({ value, depth, expanded, setExpanded }: InspectedValueProps) {
    switch (value.type) {
        case "num":
            return <span className="text-blue-600">{value.value}</span>;

        case "str":
            return <span className="text-green-600">"{value.value}"</span>;

        case "bool":
            return <span className="text-orange-600">{String(value.value)}</span>;

        case "none":
            return <span className="text-slate-400">none</span>;

        case "lit-word":
            return <span className="text-purple-600">'{value.spelling}</span>;

        case "set-word":
            return <span className="text-purple-600">{value.spelling}:</span>;

        case "word":
            return <span className="text-purple-600">{value.spelling}</span>;

        case "native":
            return <span className="text-cyan-600">#[native]</span>;

        case "block":
            return (
                <ExpandableContainer
                    summary={`[${value.items.length} items]`}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                >
                    <div className="ml-4 mt-1 space-y-1">
                        {value.items.map((item: any, i: number) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-slate-400">{i}:</span>
                                <ValueRenderer value={item} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                </ExpandableContainer>
            );

        case "paren":
            return (
                <ExpandableContainer
                    summary={`(${value.items.length} items)`}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                >
                    <div className="ml-4 mt-1 space-y-1">
                        {value.items.map((item: any, i: number) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-slate-400">{i}:</span>
                                <ValueRenderer value={item} depth={depth + 1} />
                            </div>
                        ))}
                    </div>
                </ExpandableContainer>
            );

        case "context":
            return (
                <ExpandableContainer
                    summary={`Context [${value.bindings.length} bindings]`}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                >
                    <div className="ml-4 mt-1 space-y-1">
                        {value.bindings.map((binding: any, i: number) => (
                            <div key={i} className="flex gap-2">
                                <span className="text-purple-600 font-semibold">{binding.name}:</span>
                                <ValueRenderer value={binding.value} depth={depth + 1} />
                            </div>
                        ))}
                        {value.parent && (
                            <div className="text-slate-400 text-xs mt-2">parent: {value.parent}</div>
                        )}
                    </div>
                </ExpandableContainer>
            );

        case "function":
            const argString = value.args
                .map((arg: any) => (arg.literal ? `'${arg.name}` : arg.name))
                .join(" ");
            return (
                <ExpandableContainer
                    summary={`Function [${argString}]`}
                    expanded={expanded}
                    onToggle={() => setExpanded(!expanded)}
                >
                    <div className="ml-4 mt-1 space-y-2">
                        <div>
                            <span className="text-slate-500 text-xs">Arguments:</span>
                            <div className="ml-4 text-sm">
                                {value.args.map((arg: any, i: number) => (
                                    <div key={i}>
                                        {arg.literal ? "'" : ""}
                                        {arg.name}
                                        {arg.literal && <span className="text-slate-400"> (literal)</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {value.bindings.length > 0 && (
                            <div>
                                <span className="text-slate-500 text-xs">Closure bindings:</span>
                                <div className="ml-4 space-y-1">
                                    {value.bindings.map((binding: any, i: number) => (
                                        <div key={i} className="flex gap-2">
                                            <span className="text-purple-600 font-semibold">
                                                {binding.name}:
                                            </span>
                                            <ValueRenderer value={binding.value} depth={depth + 1} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {value.parent && (
                            <div className="text-slate-400 text-xs">parent: {value.parent}</div>
                        )}
                    </div>
                </ExpandableContainer>
            );

        case "help":
            if (value.topic === "all") {
                // List all functions
                return (
                    <div className="space-y-2">
                        <div className="text-slate-600 font-semibold">Available functions:</div>
                        <div className="ml-4 grid grid-cols-3 gap-2 text-sm">
                            {value.functions.map((fn: string, i: number) => (
                                <div key={i} className="text-purple-600">
                                    {fn}
                                </div>
                            ))}
                        </div>
                        <div className="text-slate-500 text-xs mt-4">
                            Type <code className="bg-slate-100 px-1 rounded">help &lt;name&gt;</code> for
                            details
                        </div>
                    </div>
                );
            }

            if (!value.found) {
                return <div className="text-red-600">{value.message}</div>;
            }

            // Specific function help
            return (
                <div className="space-y-2">
                    <div className="text-slate-600 font-semibold">
                        Help for: <span className="text-purple-600">{value.topic}</span>
                    </div>
                    {value.kind === "native" && (
                        <div className="ml-4 text-sm">
                            <div className="text-cyan-600">Native function</div>
                            <div className="text-slate-500">{value.description}</div>
                        </div>
                    )}
                    {value.kind === "function" && (
                        <div className="ml-4 text-sm">
                            <div className="text-green-600">User-defined function</div>
                            <div className="mt-1">
                                <span className="text-slate-500">Arguments:</span>{" "}
                                {value.args
                                    .map((arg: any) => (arg.literal ? `'${arg.name}` : arg.name))
                                    .join(" ")}
                            </div>
                        </div>
                    )}
                    {value.kind === "value" && (
                        <div className="ml-4 text-sm text-slate-500">
                            Variable of type: {value.valueType}
                        </div>
                    )}
                </div>
            );

        case "error":
            return <div className="text-red-600">Error: {value.message}</div>;

        case "view":
            return <ViewRenderer view={value} />;

        default:
            return <span className="text-slate-400">{value.type}</span>;
    }
}

interface ViewRendererProps {
    view: any;
}

function ViewRenderer({ view }: ViewRendererProps) {
    const { repl, version } = useREPL();
    if (!view.components || view.components.length === 0) {
        return <div className="text-slate-400 text-sm">Empty view</div>;
    }

    return (
        <div className="border rounded-lg p-4 bg-white shadow-sm space-y-2">
            {view.components.map((comp: any, i: number) => (
                <ViewComponent key={i} component={comp} />
            ))}
        </div>
    );
}

interface ViewComponentProps {
    component: any;
}

function ViewComponent({ component }: ViewComponentProps) {
    const { repl, rawRepl, version } = useREPL();
    const { component: name, args, handlers = {} } = component;
    const [evaledArgs, setEvaledArgs] = useState<any[]>([]);

    // Re-evaluate expressions whenever version changes
    useEffect(() => {
        const evaluateArgs = async () => {
            const results = await Promise.all(
                args.map(async (arg: any) => {
                    if (arg.type === "expr") {
                        // Use rawRepl to avoid incrementing version on reads
                        const result = await rawRepl.eval(arg.code);
                        if (result.ok) {
                            return result.value;
                        }
                        return null;
                    } else if (arg.type === "value") {
                        return arg.value;
                    } else if (arg.type === "view") {
                        // Nested view objects - pass through
                        return arg.value;
                    } else if (arg.type === "block") {
                        return arg.value;
                    }
                    return null;
                })
            );
            setEvaledArgs(results);
        };
        evaluateArgs();
    }, [version, args, rawRepl]);

    // Helper to extract value from evaluated arg
    const getValue = (val: any) => {
        // Handle Bassline types
        if (val && typeof val === "object") {
            if (val.constructor?.name === "Num") return val.value;
            if (val.constructor?.name === "Str") return val.value;
        }
        return val;
    };

    switch (name) {
        case "text": {
            // Concatenate all string arguments from evaluated args
            const text = evaledArgs.map(getValue).filter((v: any) => v !== null).join("");
            return <div className="text-slate-900">{text}</div>;
        }

        case "button": {
            const label = getValue(evaledArgs[0]) || "Button";
            const action = handlers["on-click"];

            const handleClick = async () => {
                if (action && repl) {
                    try {
                        if (typeof action === "string") {
                            await repl.eval(action);
                        }
                    } catch (error) {
                        console.error("Error executing button action:", error);
                    }
                }
            };

            return (
                <button
                    onClick={handleClick}
                    className="px-4 py-2 bg-violet-600 text-white rounded hover:bg-violet-700 transition-colors"
                >
                    {label}
                </button>
            );
        }

        case "input": {
            const [value, setValue] = useState("");
            const placeholder = getValue(args[0]) || "Enter text...";
            const onChange = handlers["on-change"];

            const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const newValue = e.target.value;
                setValue(newValue);

                if (onChange && repl) {
                    try {
                        // Set 'value' variable in context before executing handler
                        await repl.eval(`value: "${newValue}"`);
                        await repl.eval(onChange);
                        // Re-render happens automatically via version tracking
                    } catch (error) {
                        console.error("Error executing input change handler:", error);
                    }
                }
            };

            return (
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    placeholder={placeholder}
                    className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
            );
        }

        case "checkbox": {
            const [checked, setChecked] = useState(false);
            const label = getValue(evaledArgs[0]) || "";
            const onChange = handlers["on-change"];

            const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                const newChecked = e.target.checked;
                setChecked(newChecked);

                if (onChange && repl) {
                    try {
                        await repl.eval(`checked: ${newChecked}`);
                        await repl.eval(onChange);
                    } catch (error) {
                        console.error("Error executing checkbox change handler:", error);
                    }
                }
            };

            return (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={checked}
                        onChange={handleChange}
                        className="w-4 h-4 text-violet-600 rounded focus:ring-2 focus:ring-violet-500"
                    />
                    {label && <span className="text-slate-900">{label}</span>}
                </label>
            );
        }

        case "badge": {
            const label = getValue(evaledArgs[0]) || "";
            const variant = getValue(evaledArgs[1]) || "default";

            const variantMap: Record<string, string> = {
                default: "bg-slate-100 text-slate-800",
                success: "bg-green-100 text-green-800",
                warning: "bg-yellow-100 text-yellow-800",
                error: "bg-red-100 text-red-800",
                info: "bg-blue-100 text-blue-800",
            };
            const variantClasses = variantMap[variant] || "bg-slate-100 text-slate-800";

            return (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses}`}>
                    {label}
                </span>
            );
        }

        case "separator": {
            return <hr className="border-t border-slate-200 my-2" />;
        }

        case "foreach": {
            // foreach <collection> <item-name> <template-block>
            const collection = getValue(evaledArgs[0]);
            const itemName = getValue(args[1]); // Word/string from args, not evaledArgs
            const templateBlock = args[2]?.value; // Block object

            if (!collection || !Array.isArray(collection)) {
                return <span className="text-red-600">foreach: collection must be an array</span>;
            }

            if (!templateBlock) {
                return <span className="text-red-600">foreach: missing template block</span>;
            }

            // For each item, we need to parse the template with the item bound to itemName
            // Since we don't have scoped evaluation yet, we'll render a simplified version
            return (
                <div className="flex flex-col gap-1">
                    {collection.map((item, idx) => {
                        // For now, just render the item value
                        // TODO: Parse template block with item in scope
                        return (
                            <div key={idx} className="text-slate-900">
                                {String(item)}
                            </div>
                        );
                    })}
                </div>
            );
        }

        case "row": {
            // Render children in a horizontal row
            return (
                <div className="flex flex-row gap-2 items-center">
                    {evaledArgs.map((value, i) => {
                        const val = getValue(value);
                        if (value && typeof value === "object" && value.type === "view") {
                            return <ViewRenderer key={i} view={value} />;
                        }
                        return <span key={i}>{String(val)}</span>;
                    })}
                </div>
            );
        }

        case "column": {
            // Render children in a vertical column
            return (
                <div className="flex flex-col gap-2">
                    {evaledArgs.map((value, i) => {
                        const val = getValue(value);
                        if (value && typeof value === "object" && value.type === "view") {
                            return <ViewRenderer key={i} view={value} />;
                        }
                        return <span key={i}>{String(val)}</span>;
                    })}
                </div>
            );
        }

        case "panel": {
            // Render children in a bordered panel with optional title
            const title = getValue(evaledArgs[0]);
            const childrenStart = title && typeof title === "string" ? 1 : 0;

            return (
                <div className="border rounded-lg p-4 bg-white shadow-sm">
                    {title && typeof title === "string" && (
                        <h3 className="font-semibold mb-3 text-lg">{title}</h3>
                    )}
                    <div className="space-y-2">
                        {evaledArgs.slice(childrenStart).map((value, i) => {
                            const val = getValue(value);
                            if (value && typeof value === "object" && value.type === "view") {
                                return <ViewRenderer key={i} view={value} />;
                            }
                            return <span key={i}>{String(val)}</span>;
                        })}
                    </div>
                </div>
            );
        }

        default:
            return <div className="text-slate-400 text-sm">Unknown component: {name}</div>;
    }
}

interface ExpandableContainerProps {
    summary: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function ExpandableContainer({ summary, expanded, onToggle, children }: ExpandableContainerProps) {
    return (
        <div>
            <button
                onClick={onToggle}
                className="hover:bg-slate-100 rounded px-1 -ml-1 transition-colors"
            >
                <span className="text-slate-400 mr-1">{expanded ? "▼" : "▶"}</span>
                <span className="text-slate-700">{summary}</span>
            </button>
            {expanded && <div className="mt-1">{children}</div>}
        </div>
    );
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
                <p className="mt-4">Use <code className="bg-slate-100 px-1 rounded">inspect</code> to explore complex values:</p>
                <code className="block mt-2 p-2 bg-slate-100 rounded text-xs">
                    inspect system
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
                        <pre className="flex-1 whitespace-pre-wrap">
                            <SyntaxHighlight code={entry.code} />
                        </pre>
                    </div>

                    {/* Output */}
                    <div className="pl-8">
                        {entry.result.ok ? (
                            <ValueRenderer value={entry.result.value} />
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
