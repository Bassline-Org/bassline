import { Button } from "~/components/ui/button";
import type { EffectEntry } from "../types";

interface EffectsPanelProps {
    effectsLog: EffectEntry[] | null;
    onClear: () => void;
}

export function EffectsPanel({ effectsLog, onClear }: EffectsPanelProps) {
    const formatEffectValue = (value: any): string => {
        if (value === null || value === undefined) return String(value);
        if (typeof value === "object") {
            return JSON.stringify(value, null, 0).slice(0, 50);
        }
        return String(value).slice(0, 50);
    };

    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">
                    Effects Log
                </h3>
                <Button size="sm" variant="outline" onClick={onClear}>
                    Clear
                </Button>
            </div>
            {!effectsLog || effectsLog.length === 0 ? (
                <div className="text-sm text-gray-500">
                    No effects emitted yet
                </div>
            ) : (
                <div className="space-y-2">
                    {[...effectsLog].reverse().map((entry, idx) => {
                        const time = new Date(
                            entry.timestamp,
                        ).toLocaleTimeString();

                        return (
                            <div
                                key={idx}
                                className="text-xs font-mono border rounded p-2 bg-gray-50"
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-gray-400">{time}</span>
                                    <span className="font-semibold text-blue-600">
                                        {entry.gadgetName}
                                    </span>
                                </div>
                                <div className="pl-2 space-y-0.5">
                                    {Object.entries(entry.effect).map(([key, value]) => (
                                        <div key={key} className="flex gap-2">
                                            <span className="text-green-600 font-medium">
                                                {key}:
                                            </span>
                                            <span className="text-gray-600">
                                                {formatEffectValue(value)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
