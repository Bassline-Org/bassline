/**
 * useProject - React hook for managing Bassline projects
 *
 * Manages LayeredControl state, UI config, and persistence
 * with auto-save to localStorage and export/import functionality.
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { LayeredControl } from "@bassline/parser/control";
import { ProjectFile } from "./ProjectFile.js";

/**
 * Hook for managing a Bassline project
 * @param {string} initialProjectName - Initial project name to load
 * @returns {Object} Project management API
 */
export function useProject(initialProjectName = "default") {
    const [projectName, setProjectName] = useState(initialProjectName);
    const [project, setProject] = useState(() =>
        ProjectFile.loadFromLocalStorage(initialProjectName) ||
        ProjectFile.createEmpty(initialProjectName)
    );

    const [uiConfig, setUIConfig] = useState(project.uiConfig || getDefaultUIConfig());

    // Create/restore LayeredControl instance - stable across autosaves
    // Only recreated on mount or explicit load operations
    const [lc, setLc] = useState(() => {
        const instance = new LayeredControl();

        // Restore state if we have it
        if (project.layeredControl) {
            try {
                const json = JSON.stringify(project.layeredControl);
                const restored = LayeredControl.fromJSON(json);
                return restored;
            } catch (err) {
                console.error("Failed to restore LayeredControl state:", err);
                return instance;
            }
        }

        return instance;
    });

    // Track if project has been modified since last save
    const [isDirty, setIsDirty] = useState(false);
    const saveTimeoutRef = useRef(null);

    // Auto-save to localStorage with debouncing
    // NOTE: This does NOT update the project state to avoid recreating LC
    useEffect(() => {
        // Clear previous timeout
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        // Debounce save for 1 second
        saveTimeoutRef.current = setTimeout(() => {
            try {
                const updatedProject = ProjectFile.create(lc, uiConfig, {
                    name: projectName
                });

                // Save to localStorage only - don't update state
                // This prevents LC from being recreated every second
                ProjectFile.saveToLocalStorage(projectName, updatedProject);
                setIsDirty(false);
            } catch (err) {
                console.error("Failed to auto-save project:", err);
            }
        }, 1000);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [lc, uiConfig, projectName]);

    // Mark as dirty when LC or UI changes
    useEffect(() => {
        setIsDirty(true);
    }, [lc, uiConfig]);

    /**
     * Export project to downloadable file
     */
    const exportProject = useCallback(() => {
        try {
            const currentProject = ProjectFile.create(lc, uiConfig, {
                name: projectName
            });
            ProjectFile.exportToFile(currentProject);
        } catch (err) {
            console.error("Failed to export project:", err);
            alert(`Failed to export project: ${err.message}`);
        }
    }, [lc, uiConfig, projectName]);

    /**
     * Import project from file
     * @param {File} file - File object from input
     */
    const importProject = useCallback(async (file) => {
        try {
            const imported = await ProjectFile.importFromFile(file);

            // Validate project
            const validation = ProjectFile.validate(imported);
            if (!validation.valid) {
                throw new Error(`Invalid project file: ${validation.errors.join(", ")}`);
            }

            // Restore LC instance from imported data
            if (imported.layeredControl) {
                try {
                    const json = JSON.stringify(imported.layeredControl);
                    const restored = LayeredControl.fromJSON(json);
                    setLc(restored);
                } catch (err) {
                    console.error("Failed to restore LC from import:", err);
                    setLc(new LayeredControl());
                }
            } else {
                setLc(new LayeredControl());
            }

            setProject(imported);
            setProjectName(imported.name);
            setUIConfig(imported.uiConfig || getDefaultUIConfig());

            // Save to localStorage
            ProjectFile.saveToLocalStorage(imported.name, imported);
        } catch (err) {
            console.error("Failed to import project:", err);
            alert(`Failed to import project: ${err.message}`);
        }
    }, []);

    /**
     * Create a new empty project
     * @param {string} name - New project name
     */
    const newProject = useCallback((name) => {
        if (!name || !name.trim()) {
            alert("Project name required");
            return;
        }

        // Create fresh LC instance
        setLc(new LayeredControl());

        const newProj = ProjectFile.createEmpty(name);
        setProject(newProj);
        setProjectName(name);
        setUIConfig(getDefaultUIConfig());

        // Save to localStorage
        ProjectFile.saveToLocalStorage(name, newProj);
    }, []);

    /**
     * Load an existing project from localStorage
     * @param {string} name - Project name to load
     */
    const loadProject = useCallback((name) => {
        try {
            const loaded = ProjectFile.loadFromLocalStorage(name);
            if (!loaded) {
                throw new Error(`Project "${name}" not found`);
            }

            // Restore LC instance from loaded data
            if (loaded.layeredControl) {
                try {
                    const json = JSON.stringify(loaded.layeredControl);
                    const restored = LayeredControl.fromJSON(json);
                    setLc(restored);
                } catch (err) {
                    console.error("Failed to restore LC from load:", err);
                    setLc(new LayeredControl());
                }
            } else {
                setLc(new LayeredControl());
            }

            setProject(loaded);
            setProjectName(name);
            setUIConfig(loaded.uiConfig || getDefaultUIConfig());
        } catch (err) {
            console.error("Failed to load project:", err);
            alert(`Failed to load project: ${err.message}`);
        }
    }, []);

    /**
     * Delete a project from localStorage
     * @param {string} name - Project name to delete
     */
    const deleteProject = useCallback((name) => {
        if (confirm(`Delete project "${name}"? This cannot be undone.`)) {
            ProjectFile.deleteProject(name);

            // If we deleted the current project, create a new one
            if (name === projectName) {
                newProject("default");
            }
        }
    }, [projectName, newProject]);

    /**
     * Get list of all saved projects
     * @returns {Array<{name: string, timestamp: string}>}
     */
    const listProjects = useCallback(() => {
        return ProjectFile.listProjects();
    }, []);

    /**
     * Update UI configuration (triggers auto-save)
     * @param {Object|Function} updates - New config or updater function
     */
    const updateUIConfig = useCallback((updates) => {
        if (typeof updates === "function") {
            setUIConfig(prev => updates(prev));
        } else {
            setUIConfig(updates);
        }
    }, []);

    return {
        // Core instances
        lc,

        // Project state
        projectName,
        project,
        uiConfig,
        updateUIConfig,
        isDirty,

        // Project operations
        exportProject,
        importProject,
        newProject,
        loadProject,
        deleteProject,
        listProjects
    };
}

/**
 * Get default UI configuration
 * @returns {Object} Default UI config
 */
function getDefaultUIConfig() {
    return {
        panels: [],
        groups: {},
        preferences: {
            theme: "dark",
            activeLayer: null,
            showGrid: false,
            snapToGrid: false
        }
    };
}
