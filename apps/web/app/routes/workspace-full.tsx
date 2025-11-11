import type { Route } from "./+types/workspace-full";
import { useProject } from "@bassline/parser-react/state";
import { WorkspaceProvider, Workspace, ProjectHeader } from "@bassline/parser-react";

export function meta({}: Route.MetaArgs) {
    return [
        { title: "Full Workspace - Bassline" },
        {
            name: "description",
            content: "Complete workspace with all panels - dynamic layout system",
        },
    ];
}

/**
 * Full Workspace - All panels in dynamic layout
 *
 * Features:
 * - Project management (save/load/export/import)
 * - Dynamic panel composition
 * - Drag-and-drop repositioning
 * - Resizable panels
 * - Add/remove panels on the fly
 * - Layout persistence in project files
 * - Auto-save functionality
 *
 * Default layout (can be customized):
 * - Left (25%): LayerListPanel
 * - Center-Top (50%): PlugboardPanel
 * - Center-Bottom (50%): ReplPanel
 * - Right (25%): StagingCommitPanel
 */
export default function WorkspaceFull() {
    const {
        lc,
        projectName,
        isDirty,
        exportProject,
        importProject,
        newProject,
        listProjects,
        loadProject,
    } = useProject("full-workspace");

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
                <div className="flex-1 overflow-hidden">
                    <Workspace layoutName="full" showControls={true} />
                </div>
            </div>
        </WorkspaceProvider>
    );
}
