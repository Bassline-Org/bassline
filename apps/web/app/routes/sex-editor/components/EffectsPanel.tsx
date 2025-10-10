import { Button } from "~/components/ui/button";
import type { EffectEntry } from "../types";

interface EffectsPanelProps {
    effectsLog: EffectEntry[] | null;
    onClear: () => void;
}

export function EffectsPanel({ effectsLog, onClear }: EffectsPanelProps) {
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
                <div className="space-y-1">
                    {[...effectsLog].reverse().map((entry, idx) => {
                        const time = new Date(
                            entry.timestamp,
                        ).toLocaleTimeString();
                        const effectKeys = Object.keys(entry.effect).join(
                            ", ",
                        );
                        return (
                            <div
                                key={idx}
                                className="text-xs font-mono border-b pb-1"
                            >
                                <span className="text-gray-500">{time}</span>
                                {" - "}
                                <span className="font-semibold text-blue-600">
                                    {entry.gadgetName}
                                </span>
                                {" → "}
                                <span className="text-green-600">
                                    {effectKeys}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
