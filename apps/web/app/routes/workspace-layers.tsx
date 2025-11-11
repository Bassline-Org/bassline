import type { Route } from "./+types/workspace-layers";
import { useProject } from "@bassline/parser-react/state";
import { WorkspaceProvider, Workspace, ProjectHeader } from "@bassline/parser-react";
import { LayerListPanel, ReplPanel } from "@bassline/parser-react/components";

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
 * Layers Workspace - Interactive layer management workspace
 *
 * Features:
 * - Project management (save/load/export/import)
 * - Left (30%): LayerListPanel
 * - Right (70%): ReplPanel for interactive command execution
 *
 * This workspace focuses on layer management and command execution.
 */
export default function WorkspaceLayers() {
    const {
        lc,
        projectName,
        isDirty,
        exportProject,
        importProject,
        newProject,
        listProjects,
        loadProject,
    } = useProject("layers-workspace");

    return (
        <WorkspaceProvider lc={lc}>
            <div className="h-screen flex flex-col">
                <ProjectHeader
                    projectName={projectName}
                    isDirty={isDirty}
                    onExport={exportProject}
                    onImport={importProject}
                    onNewProject={newProject}
                    projects={listProjects()}
                    onLoadProject={loadProject}
                />
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

                        {/* Right column: ReplPanel */}
                        <div className="w-[70%] flex flex-col">
                            <div className="flex-1 overflow-hidden">
                                <ReplPanel />
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
                                • <strong>Create a layer</strong> using the LayerListPanel on the left
                            </li>
                            <li>
                                • <strong>Click a layer</strong> to set it as the active layer
                            </li>
                            <li>
                                • <strong>Execute commands</strong> in the REPL panel on the right
                            </li>
                            <li>
                                • Try commands: <code className="bg-blue-100 px-1 rounded">help</code>,{" "}
                                <code className="bg-blue-100 px-1 rounded">info</code>,{" "}
                                <code className="bg-blue-100 px-1 rounded">quads</code>,{" "}
                                <code className="bg-blue-100 px-1 rounded">staging</code>
                            </li>
                            <li>
                                • <strong>Use ↑↓ arrows</strong> to navigate command history
                            </li>
                        </ul>
                    </div>
                </div>
            </Workspace>
            </div>
        </WorkspaceProvider>
    );
}
