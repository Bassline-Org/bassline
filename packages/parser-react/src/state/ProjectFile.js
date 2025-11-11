/**
 * ProjectFile - Unified project file format (.bassline.json)
 *
 * Combines LayeredControl state and UI configuration into a single
 * serializable format for saving, loading, and sharing projects.
 */

export class ProjectFile {
    /**
     * Create a project object from current state
     * @param {LayeredControl} lc - LayeredControl instance
     * @param {Object} uiConfig - UI configuration state
     * @param {Object} metadata - Optional project metadata
     * @returns {Object} Project object ready for serialization
     */
    static create(lc, uiConfig, metadata = {}) {
        return {
            version: "1.0",
            name: metadata.name || "Untitled Project",
            timestamp: new Date().toISOString(),
            layeredControl: JSON.parse(lc.toString()), // Serialize LC to object
            uiConfig: uiConfig
        };
    }

    /**
     * Export project to downloadable file
     * @param {Object} project - Project object
     */
    static exportToFile(project) {
        const json = JSON.stringify(project, null, 2);
        const blob = new Blob([json], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project.name}.bassline.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import project from file
     * @param {File} file - File object from input
     * @returns {Promise<Object>} Parsed project object
     */
    static async importFromFile(file) {
        const text = await file.text();
        const project = JSON.parse(text);

        // Validate and migrate if needed
        if (project.version !== "1.0") {
            project = this.migrate(project);
        }

        return project;
    }

    /**
     * Save project to localStorage
     * @param {string} projectName - Project identifier
     * @param {Object} project - Project object
     */
    static saveToLocalStorage(projectName, project) {
        try {
            const key = `bassline:project:${projectName}`;
            localStorage.setItem(key, JSON.stringify(project));
        } catch (err) {
            console.error("Failed to save project to localStorage:", err);
        }
    }

    /**
     * Load project from localStorage
     * @param {string} projectName - Project identifier
     * @returns {Object|null} Project object or null if not found
     */
    static loadFromLocalStorage(projectName) {
        try {
            const key = `bassline:project:${projectName}`;
            const json = localStorage.getItem(key);
            return json ? JSON.parse(json) : null;
        } catch (err) {
            console.error("Failed to load project from localStorage:", err);
            return null;
        }
    }

    /**
     * List all projects in localStorage
     * @returns {Array<{name: string, timestamp: string}>} Project list
     */
    static listProjects() {
        const projects = [];

        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith("bassline:project:")) {
                    const name = key.replace("bassline:project:", "");
                    const json = localStorage.getItem(key);
                    if (json) {
                        const project = JSON.parse(json);
                        projects.push({
                            name,
                            timestamp: project.timestamp
                        });
                    }
                }
            }
        } catch (err) {
            console.error("Failed to list projects:", err);
        }

        // Sort by most recent first
        projects.sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );

        return projects;
    }

    /**
     * Delete project from localStorage
     * @param {string} projectName - Project identifier
     */
    static deleteProject(projectName) {
        try {
            const key = `bassline:project:${projectName}`;
            localStorage.removeItem(key);
        } catch (err) {
            console.error("Failed to delete project:", err);
        }
    }

    /**
     * Migrate project from older versions
     * @param {Object} project - Old project object
     * @returns {Object} Migrated project object
     */
    static migrate(project) {
        // Handle schema changes between versions
        let migrated = { ...project };

        // Example migration paths
        if (project.version === "0.9") {
            // Migrate 0.9 -> 1.0
            migrated = {
                ...migrated,
                version: "1.0",
                // Add any new fields or transform data structures
            };
        }

        return migrated;
    }

    /**
     * Create empty project with default structure
     * @param {string} name - Project name
     * @returns {Object} Empty project object
     */
    static createEmpty(name = "Untitled") {
        return {
            version: "1.0",
            name,
            timestamp: new Date().toISOString(),
            layeredControl: {
                quadStore: [],
                refs: {},
                layers: {}
            },
            uiConfig: {
                panels: [],
                groups: {},
                preferences: {
                    theme: "dark",
                    activeLayer: null
                }
            }
        };
    }

    /**
     * Validate project structure
     * @param {Object} project - Project object to validate
     * @returns {{valid: boolean, errors: string[]}}
     */
    static validate(project) {
        const errors = [];

        if (!project.version) {
            errors.push("Missing version field");
        }

        if (!project.name) {
            errors.push("Missing name field");
        }

        if (!project.layeredControl) {
            errors.push("Missing layeredControl field");
        }

        if (!project.uiConfig) {
            errors.push("Missing uiConfig field");
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }
}
