import { useEffect, useState } from "react";
import { SyntaxHighlight } from "./SyntaxHighlight";
import { useREPL } from "../../../lib/repl-context";
import { Block, Word } from "@bassline/lang/values";
import { Context } from "@bassline/lang/context";
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
    const [expanded, setExpanded] = useState(false);
    return (
        <InspectedValue
            value={value}
            depth={depth}
            expanded={expanded}
            setExpanded={setExpanded}
        />
    );
}

interface InspectedValueProps {
    value: any;
    depth: number;
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
}

function InspectedValue(
    { value, depth, expanded, setExpanded }: InspectedValueProps,
) {
    if (typeof value === "number") {
        return <span className="text-blue-600">{String(value)}</span>;
    }
    if (typeof value === "string") {
        return <span className="text-green-600">"{value}"</span>;
    }
    if (typeof value === "boolean") {
        return <span className="text-orange-600">{String(value)}</span>;
    }
    if (value === null || value === undefined) {
        return <span className="text-slate-400">none</span>;
    }
    if (value instanceof Block) {
        return (
            <ExpandableContainer
                summary={`[Block with ${value.items.length} items]`}
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
    }
    if (value instanceof Context) {
        return (
            <ExpandableContainer
                summary={`Context with ${value.bindings.size} bindings`}
                expanded={expanded}
                onToggle={() => setExpanded(!expanded)}
            >
                <div className="ml-4 mt-1 space-y-1">
                    {value.bindings.entries().map((
                        [key, binding]: [Symbol, any],
                        i: number,
                    ) => (
                        <div key={i} className="flex gap-2">
                            <span className="text-slate-400">
                                {key.description}:
                            </span>
                            <ValueRenderer value={binding} depth={depth + 1} />
                        </div>
                    ))}
                </div>
            </ExpandableContainer>
        );
    }
    return <pre className="text-xs">{JSON.stringify(value, null, 2)}</pre>;
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
    const { repl } = useREPL();

    // Component data is now pre-evaluated and structured from view.js
    const { type, value, label, action, onChange, checked, variant, children } =
        component;

    switch (type) {
        case "text": {
            return <div className="text-slate-900">{value || ""}</div>;
        }

        case "button": {
            const handleClick = async () => {
                if (action && repl) {
                    try {
                        // Execute the Bassline block
                        const { moldValue } = await import(
                            "@bassline/lang/prelude/helpers"
                        );
                        const code = moldValue(action);
                        await repl.eval(code);
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
                    {label || "Button"}
                </button>
            );
        }

        case "input": {
            const [inputValue, setInputValue] = useState(value || "");

            const handleChange = async (
                e: React.ChangeEvent<HTMLInputElement>,
            ) => {
                const newValue = e.target.value;
                setInputValue(newValue);

                if (onChange && repl) {
                    try {
                        // Set 'value' variable in context before executing handler
                        await repl.eval(`value: "${newValue}"`);
                        const { moldValue } = await import(
                            "@bassline/lang/prelude/helpers"
                        );
                        const code = moldValue(onChange);
                        await repl.eval(code);
                    } catch (error) {
                        console.error(
                            "Error executing input change handler:",
                            error,
                        );
                    }
                }
            };

            return (
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleChange}
                    placeholder={value || "Enter text..."}
                    className="px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
            );
        }

        case "checkbox": {
            const [isChecked, setIsChecked] = useState(checked || false);

            const handleChange = async (
                e: React.ChangeEvent<HTMLInputElement>,
            ) => {
                const newChecked = e.target.checked;
                setIsChecked(newChecked);

                if (onChange && repl) {
                    try {
                        await repl.eval(`checked: ${newChecked}`);
                        const { moldValue } = await import(
                            "@bassline/lang/prelude/helpers"
                        );
                        const code = moldValue(onChange);
                        await repl.eval(code);
                    } catch (error) {
                        console.error(
                            "Error executing checkbox change handler:",
                            error,
                        );
                    }
                }
            };

            return (
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={handleChange}
                        className="w-4 h-4 text-violet-600 rounded focus:ring-2 focus:ring-violet-500"
                    />
                    {label && <span className="text-slate-900">{label}</span>}
                </label>
            );
        }

        case "badge": {
            const variantMap: Record<string, string> = {
                default: "bg-slate-100 text-slate-800",
                success: "bg-green-100 text-green-800",
                warning: "bg-yellow-100 text-yellow-800",
                error: "bg-red-100 text-red-800",
                info: "bg-blue-100 text-blue-800",
            };
            const variantClasses = variantMap[variant || "default"] ||
                "bg-slate-100 text-slate-800";

            return (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses}`}
                >
                    {label || ""}
                </span>
            );
        }

        case "separator": {
            return <hr className="border-t border-slate-200 my-2" />;
        }

        case "row": {
            // Children are pre-evaluated component structures
            return (
                <div className="flex flex-row gap-2 items-center">
                    {(children || []).map((child: any, i: number) => (
                        <ViewComponent key={i} component={child} />
                    ))}
                </div>
            );
        }

        case "column": {
            // Children are pre-evaluated component structures
            return (
                <div className="flex flex-col gap-2">
                    {(children || []).map((child: any, i: number) => (
                        <ViewComponent key={i} component={child} />
                    ))}
                </div>
            );
        }

        case "panel": {
            return (
                <div className="border rounded-lg p-4 bg-white shadow-sm">
                    <div className="space-y-2">
                        {(children || []).map((child: any, i: number) => (
                            <ViewComponent key={i} component={child} />
                        ))}
                    </div>
                </div>
            );
        }

        case "fragment": {
            // Fragment is just a container for children
            return (
                <>
                    {(children || []).map((child: any, i: number) => (
                        <ViewComponent key={i} component={child} />
                    ))}
                </>
            );
        }

        case "table": {
            const { headers, rows } = component;

            return (
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 border border-slate-200">
                        {headers && headers.length > 0 && (
                            <thead className="bg-slate-50">
                                <tr>
                                    {headers.map((
                                        header: string,
                                        i: number,
                                    ) => (
                                        <th
                                            key={i}
                                            className="px-4 py-2 text-left text-xs font-medium text-slate-700 uppercase tracking-wider"
                                        >
                                            {header}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                        )}
                        <tbody className="bg-white divide-y divide-slate-200">
                            {(rows || []).map((
                                row: any[],
                                rowIndex: number,
                            ) => (
                                <tr
                                    key={rowIndex}
                                    className="hover:bg-slate-50"
                                >
                                    {row.map((cell: any, cellIndex: number) => (
                                        <td
                                            key={cellIndex}
                                            className="px-4 py-2 text-sm text-slate-900 whitespace-nowrap"
                                        >
                                            {String(cell ?? "")}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
        }

        case "code": {
            const { code, language } = component;

            return (
                <div className="relative">
                    {language && language !== "plaintext" && (
                        <div className="absolute top-2 right-2 px-2 py-1 bg-slate-700 text-slate-300 text-xs rounded">
                            {language}
                        </div>
                    )}
                    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
                        <code className={`language-${language || "plaintext"}`}>
                            {code || ""}
                        </code>
                    </pre>
                </div>
            );
        }

        default:
            return (
                <div className="text-slate-400 text-sm">
                    Unknown component: {type}
                </div>
            );
    }
}

interface ExpandableContainerProps {
    summary: string;
    expanded: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

function ExpandableContainer(
    { summary, expanded, onToggle, children }: ExpandableContainerProps,
) {
    return (
        <div>
            <button
                onClick={onToggle}
                className="hover:bg-slate-100 rounded px-1 -ml-1 transition-colors"
            >
                <span className="text-slate-400 mr-1">
                    {expanded ? "▼" : "▶"}
                </span>
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
                <p className="mt-4">
                    Use{" "}
                    <code className="bg-slate-100 px-1 rounded">inspect</code>
                    {" "}
                    to explore complex values:
                </p>
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
                        {entry.result.ok
                            ? <ValueRenderer value={entry.result.value} />
                            : (
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
