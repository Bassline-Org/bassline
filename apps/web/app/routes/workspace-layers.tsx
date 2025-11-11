import { useMemo } from "react";
import type { Route } from "./+types/workspace-layers";
import { LayeredControl } from "@bassline/parser/control";
import { WorkspaceProvider, Workspace } from "@bassline/parser-react";
import { LayerListPanel } from "@bassline/parser-react/components";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Layers Workspace" },
        {
            name: "description",
            content: "Workspace view for managing layers",
        },
    ];
}

/**
 * Layers Workspace - First workspace view
 *
 * Demonstrates workspace shell with hardcoded 2-column layout:
 * - Left (30%): LayerListPanel
 * - Right (70%): Placeholder for future panels
 *
 * This workspace focuses on layer management and will be extended
 * with REPL panel in Stage 5.
 */
export default function WorkspaceLayers() {
    // Create LayeredControl instance (could be from useProject in future)
    const lc = useMemo(() => new LayeredControl(), []);

    return (
        <WorkspaceProvider lc={lc}>
            <Workspace>
                <div className="container mx-auto p-6">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-3xl font-bold mb-2">
                            Layers Workspace
                        </h1>
                        <p className="text-muted-foreground">
                            Interactive view for managing LayeredControl layers
                        </p>
                    </div>

                    {/* Hardcoded 2-column layout */}
                    <div className="flex gap-6 h-[calc(100vh-200px)]">
                        {/* Left column: LayerListPanel */}
                        <div className="w-[30%] flex flex-col">
                            <div className="flex-1 overflow-hidden">
                                <LayerListPanel />
                            </div>
                        </div>

                        {/* Right column: Placeholder */}
                        <div className="w-[70%] flex flex-col">
                            <div className="flex-1 border border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white">
                                <div className="text-center p-8">
                                    <div className="text-6xl mb-4">📝</div>
                                    <h3 className="text-xl font-semibold mb-2 text-slate-700">
                                        REPL Panel Coming Soon
                                    </h3>
                                    <p className="text-slate-500 max-w-md">
                                        Stage 5 will add an interactive REPL panel here
                                        for executing commands on the selected layer.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="font-semibold text-blue-900 mb-2">
                            How It Works
                        </h3>
                        <ul className="text-sm text-blue-800 space-y-1">
                            <li>
                                • <strong>WorkspaceProvider</strong> shares LayeredControl instance
                                and "active layer" state across panels
                            </li>
                            <li>
                                • <strong>LayerListPanel</strong> shows all layers and lets you
                                select the active one
                            </li>
                            <li>
                                • <strong>Hardcoded layout</strong> (30% / 70% split) -
                                Stage 9 will add dynamic resizing
                            </li>
                            <li>
                                • <strong>Stage 5</strong> will add REPL panel that executes
                                commands on the active layer
                            </li>
                        </ul>
                    </div>
                </div>
            </Workspace>
        </WorkspaceProvider>
    );
}
