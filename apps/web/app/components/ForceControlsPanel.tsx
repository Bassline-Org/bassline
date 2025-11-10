import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { ChevronDown, ChevronRight, RotateCcw } from "lucide-react";

export interface ForceLayoutOptions {
    charge: number;
    linkDistance: number;
    linkStrength: number;
    collisionRadius: number;
    iterations: number;
}

const DEFAULT_OPTIONS: ForceLayoutOptions = {
    charge: -300,
    linkDistance: 100,
    linkStrength: 0.5,
    collisionRadius: 50,
    iterations: 300,
};

interface ForceControlsPanelProps {
    options: ForceLayoutOptions;
    onChange: (options: ForceLayoutOptions) => void;
}

export function ForceControlsPanel(
    { options, onChange }: ForceControlsPanelProps,
) {
    const [isOpen, setIsOpen] = useState(false);
    // Local state for immediate visual feedback
    const [localOptions, setLocalOptions] = useState(options);

    // Sync local state when parent options change (e.g., reset)
    useEffect(() => {
        setLocalOptions(options);
    }, [options]);

    // Debounce onChange calls to parent (400ms delay)
    useEffect(() => {
        const timer = setTimeout(() => {
            onChange(localOptions);
        }, 1);

        return () => clearTimeout(timer);
    }, [localOptions, onChange]);

    const handleReset = () => {
        setLocalOptions(DEFAULT_OPTIONS);
    };

    return (
        <div className="border rounded-lg bg-white shadow-sm">
            {/* Header */}
            <div className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 flex-1"
                >
                    {isOpen
                        ? <ChevronDown className="w-4 h-4" />
                        : <ChevronRight className="w-4 h-4" />}
                    <span className="font-medium text-sm">
                        Force Layout Controls
                    </span>
                </button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleReset}
                    className="h-6 px-2"
                    title="Reset to defaults"
                >
                    <RotateCcw className="w-3 h-3" />
                </Button>
            </div>

            {/* Panel Content */}
            {isOpen && (
                <div className="p-3 pt-0 space-y-4 border-t">
                    {/* Charge Strength */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700">
                                Charge Strength (Repulsion)
                            </label>
                            <span className="text-xs text-slate-500 font-mono">
                                {localOptions.charge}
                            </span>
                        </div>
                        <Slider
                            value={[localOptions.charge]}
                            onValueChange={([value]) =>
                                setLocalOptions({
                                    ...localOptions,
                                    charge: value,
                                })}
                            min={-1000}
                            max={0}
                            step={10}
                        />
                        <p className="text-xs text-slate-500">
                            How strongly nodes repel each other (more negative =
                            stronger)
                        </p>
                    </div>

                    {/* Link Distance */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700">
                                Link Distance
                            </label>
                            <span className="text-xs text-slate-500 font-mono">
                                {localOptions.linkDistance}
                            </span>
                        </div>
                        <Slider
                            value={[localOptions.linkDistance]}
                            onValueChange={([value]) =>
                                setLocalOptions({
                                    ...localOptions,
                                    linkDistance: value,
                                })}
                            min={20}
                            max={500}
                            step={10}
                        />
                        <p className="text-xs text-slate-500">
                            Target distance between connected nodes
                        </p>
                    </div>

                    {/* Link Strength */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700">
                                Link Strength
                            </label>
                            <span className="text-xs text-slate-500 font-mono">
                                {localOptions.linkStrength.toFixed(2)}
                            </span>
                        </div>
                        <Slider
                            value={[localOptions.linkStrength]}
                            onValueChange={([value]) =>
                                setLocalOptions({
                                    ...localOptions,
                                    linkStrength: value,
                                })}
                            min={0}
                            max={1}
                            step={0.05}
                        />
                        <p className="text-xs text-slate-500">
                            How strongly links pull nodes together
                        </p>
                    </div>

                    {/* Collision Radius */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700">
                                Collision Radius
                            </label>
                            <span className="text-xs text-slate-500 font-mono">
                                {localOptions.collisionRadius}
                            </span>
                        </div>
                        <Slider
                            value={[localOptions.collisionRadius]}
                            onValueChange={([value]) =>
                                setLocalOptions({
                                    ...localOptions,
                                    collisionRadius: value,
                                })}
                            min={10}
                            max={200}
                            step={5}
                        />
                        <p className="text-xs text-slate-500">
                            Prevent node overlap radius
                        </p>
                    </div>

                    {/* Iterations */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-slate-700">
                                Simulation Iterations
                            </label>
                            <span className="text-xs text-slate-500 font-mono">
                                {localOptions.iterations}
                            </span>
                        </div>
                        <Slider
                            value={[localOptions.iterations]}
                            onValueChange={([value]) =>
                                setLocalOptions({
                                    ...localOptions,
                                    iterations: value,
                                })}
                            min={100}
                            max={1000}
                            step={50}
                        />
                        <p className="text-xs text-slate-500">
                            Number of simulation steps (higher = slower but more
                            stable)
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}
