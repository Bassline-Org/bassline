import { Table2, Network, Columns2 } from "lucide-react";

export type ViewMode = "table" | "graph" | "both";

interface VisualizationModeSwitcherProps {
    value: ViewMode;
    onChange: (mode: ViewMode) => void;
}

export function VisualizationModeSwitcher({ value, onChange }: VisualizationModeSwitcherProps) {
    const modes: { value: ViewMode; label: string; icon: typeof Table2 }[] = [
        { value: "table", label: "Table", icon: Table2 },
        { value: "graph", label: "Graph", icon: Network },
        { value: "both", label: "Both", icon: Columns2 },
    ];

    return (
        <div className="inline-flex rounded-md shadow-sm" role="group">
            {modes.map((mode, idx) => {
                const Icon = mode.icon;
                const isActive = value === mode.value;
                const isFirst = idx === 0;
                const isLast = idx === modes.length - 1;

                return (
                    <button
                        key={mode.value}
                        type="button"
                        onClick={() => onChange(mode.value)}
                        className={`
                            inline-flex items-center gap-2 px-4 py-2 text-sm font-medium
                            border border-slate-300
                            ${isFirst ? "rounded-l-lg" : ""}
                            ${isLast ? "rounded-r-lg" : ""}
                            ${!isFirst ? "-ml-px" : ""}
                            ${isActive
                                ? "bg-blue-600 text-white border-blue-600 z-10"
                                : "bg-white text-slate-700 hover:bg-slate-50"
                            }
                            focus:z-10 focus:ring-2 focus:ring-blue-500
                            transition-colors
                        `}
                    >
                        <Icon className="w-4 h-4" />
                        {mode.label}
                    </button>
                );
            })}
        </div>
    );
}
