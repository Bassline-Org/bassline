import type { Route } from "./+types/workspace-staging";
import { useProject } from "@bassline/parser-react/state";
import { WorkspaceProvider, Workspace, ProjectHeader } from "@bassline/parser-react";
import {
    LayerListPanel,
    StagingCommitPanel,
} from "@bassline/parser-react/components";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Staging & Commits Workspace" },
        {
            name: "description",
            content: "Git-style version control workspace",
        },
    ];
}

/**
 * Staging Workspace - Version control operations
 *
 * Features:
 * - Project management (save/load/export/import)
 * - Left (30%): LayerListPanel
 * - Right (70%): StagingCommitPanel (staging, commits, branches)
 *
 * This workspace focuses on Git-style version control operations.
 */
export default function WorkspaceStaging() {
    const {
        lc,
        projectName,
        isDirty,
        exportProject,
        importProject,
        newProject,
        listProjects,
        loadProject,
    } = useProject("staging-workspace");

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
                            Staging & Commits Workspace
                        </h1>
                        <p className="text-muted-foreground">
                            Git-style version control for LayeredControl
                        </p>
                    </div>

                    {/* Main layout: LayerList + StagingCommit */}
                    <div className="flex gap-6 h-[700px]">
                        {/* Left: LayerListPanel */}
                        <div className="w-[30%] flex flex-col">
                            <div className="flex-1 overflow-hidden">
                                <LayerListPanel />
                            </div>
                        </div>

                        {/* Right: StagingCommitPanel */}
                        <div className="w-[70%] flex flex-col">
                            <div className="flex-1 overflow-hidden rounded-lg border border-slate-200">
                                <StagingCommitPanel />
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
                                • <strong>Create layers</strong> using the LayerListPanel
                                on the left
                            </li>
                            <li>
                                • <strong>Auto-staging</strong>: Quads are automatically
                                staged when added to a layer
                            </li>
                            <li>
                                • <strong>Commit changes</strong>: Write a message and
                                commit your staged changes
                            </li>
                            <li>
                                • <strong>View history</strong>: See all commits with
                                timestamps and messages
                            </li>
                            <li>
                                • <strong>Restore commits</strong>: Click "Restore" to
                                revert to any previous commit
                            </li>
                            <li>
                                • <strong>Branch management</strong>: Create, switch, and
                                delete branches
                            </li>
                            <li>
                                • <strong>Unstage changes</strong>: Click ✕ to unstage
                                individual quads or "Clear All"
                            </li>
                        </ul>
                    </div>
                </div>
            </Workspace>
            </div>
        </WorkspaceProvider>
    );
}
