/**
 * ProjectHeader - Project management header component
 *
 * Displays project name, save status, and provides controls for
 * export/import, new project, and project switching.
 */

import { useState, useRef } from "react";

/**
 * ProjectHeader component
 *
 * @param {Object} props
 * @param {string} props.projectName - Current project name
 * @param {boolean} props.isDirty - Whether there are unsaved changes
 * @param {Function} props.onExport - Export project handler
 * @param {Function} props.onImport - Import project handler (receives File)
 * @param {Function} props.onNewProject - New project handler
 * @param {Function} props.onRenameProject - Rename project handler (receives new name)
 * @param {Array<{name: string, timestamp: string}>} [props.projects] - List of available projects
 * @param {Function} [props.onLoadProject] - Load project handler (receives project name)
 * @returns {JSX.Element}
 */
export function ProjectHeader({
    projectName,
    isDirty,
    onExport,
    onImport,
    onNewProject,
    onRenameProject,
    projects = [],
    onLoadProject,
}) {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(projectName);
    const [showProjectMenu, setShowProjectMenu] = useState(false);
    const fileInputRef = useRef(null);

    const handleStartEdit = () => {
        setEditName(projectName);
        setIsEditing(true);
    };

    const handleFinishEdit = () => {
        if (editName && editName.trim() && editName !== projectName) {
            onRenameProject?.(editName.trim());
        } else {
            setEditName(projectName);
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleFinishEdit();
        } else if (e.key === "Escape") {
            setEditName(projectName);
            setIsEditing(false);
        }
    };

    const handleNewProject = () => {
        const name = prompt("Enter new project name:");
        if (name && name.trim()) {
            onNewProject?.(name.trim());
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (file) {
            await onImport?.(file);
            // Reset input so the same file can be imported again
            e.target.value = "";
        }
    };

    const handleLoadProject = (name) => {
        onLoadProject?.(name);
        setShowProjectMenu(false);
    };

    return (
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-white">
            {/* Left: Project name and save status */}
            <div className="flex items-center gap-3">
                {/* Project name - editable */}
                {isEditing ? (
                    <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={handleFinishEdit}
                        onKeyDown={handleKeyDown}
                        className="px-2 py-1 text-lg font-semibold border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                ) : (
                    <button
                        onClick={handleStartEdit}
                        className="px-2 py-1 text-lg font-semibold text-slate-800 hover:bg-slate-100 rounded transition-colors"
                        title="Click to rename project"
                    >
                        {projectName}
                    </button>
                )}

                {/* Save status indicator */}
                <div className="flex items-center gap-1.5 text-sm">
                    {isDirty ? (
                        <>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-amber-600">Saving...</span>
                        </>
                    ) : (
                        <>
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-green-600">Saved</span>
                        </>
                    )}
                </div>
            </div>

            {/* Right: Action buttons */}
            <div className="flex items-center gap-2">
                {/* Project switcher dropdown (if projects list provided) */}
                {projects.length > 0 && onLoadProject && (
                    <div className="relative">
                        <button
                            onClick={() => setShowProjectMenu(!showProjectMenu)}
                            className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                        >
                            Projects ▼
                        </button>
                        {showProjectMenu && (
                            <>
                                {/* Backdrop */}
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowProjectMenu(false)}
                                />
                                {/* Menu */}
                                <div className="absolute right-0 mt-1 w-64 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-20">
                                    {projects.map((proj) => (
                                        <button
                                            key={proj.name}
                                            onClick={() => handleLoadProject(proj.name)}
                                            className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 transition-colors ${
                                                proj.name === projectName
                                                    ? "bg-blue-50 font-medium text-blue-700"
                                                    : "text-slate-700"
                                            }`}
                                        >
                                            <div>{proj.name}</div>
                                            {proj.timestamp && (
                                                <div className="text-xs text-slate-500">
                                                    {new Date(proj.timestamp).toLocaleString()}
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* New Project */}
                <button
                    onClick={handleNewProject}
                    className="px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                    title="Create new project"
                >
                    ➕ New
                </button>

                {/* Export */}
                <button
                    onClick={onExport}
                    className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                    title="Export project to file"
                >
                    ⬇️ Export
                </button>

                {/* Import */}
                <button
                    onClick={handleImportClick}
                    className="px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded transition-colors"
                    title="Import project from file"
                >
                    ⬆️ Import
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.bassline"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>
        </div>
    );
}
