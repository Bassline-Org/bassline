import { useState, useEffect, useCallback } from "react";

const SCRIPT_PREFIX = "bassline_script_";
const INDEX_KEY = "bassline_script_index";
const DRAFT_KEY = "bassline_script_draft";

export interface Script {
    name: string;
    code: string;
    timestamp: number;
}

/**
 * Hook for managing script storage in localStorage
 */
export function useScriptStorage() {
    const [scripts, setScripts] = useState<string[]>([]);
    const [currentScript, setCurrentScript] = useState<string>("draft");

    // Check if we're in browser environment
    const isBrowser = typeof window !== "undefined";

    // Load script index from localStorage
    useEffect(() => {
        if (!isBrowser) return;

        try {
            const indexJson = localStorage.getItem(INDEX_KEY);
            if (indexJson) {
                const index = JSON.parse(indexJson);
                setScripts(Array.isArray(index) ? index : []);
            }
        } catch (err) {
            console.error("Failed to load script index:", err);
        }
    }, [isBrowser]);

    // Save script index to localStorage
    const saveIndex = useCallback((index: string[]) => {
        if (!isBrowser) return;

        try {
            localStorage.setItem(INDEX_KEY, JSON.stringify(index));
            setScripts(index);
        } catch (err) {
            console.error("Failed to save script index:", err);
        }
    }, [isBrowser]);

    // Save a script
    const saveScript = useCallback((name: string, code: string) => {
        if (!isBrowser) return;

        try {
            const script: Script = {
                name,
                code,
                timestamp: Date.now(),
            };

            // Save script data
            localStorage.setItem(SCRIPT_PREFIX + name, JSON.stringify(script));

            // Update index if this is a new script
            if (!scripts.includes(name)) {
                const newIndex = [...scripts, name].sort();
                saveIndex(newIndex);
            }

            return true;
        } catch (err) {
            console.error("Failed to save script:", err);
            return false;
        }
    }, [isBrowser, scripts, saveIndex]);

    // Load a script
    const loadScript = useCallback((name: string): Script | null => {
        if (!isBrowser) return null;

        try {
            const key = name === "draft" ? DRAFT_KEY : SCRIPT_PREFIX + name;
            const scriptJson = localStorage.getItem(key);

            if (scriptJson) {
                return JSON.parse(scriptJson);
            }
        } catch (err) {
            console.error("Failed to load script:", err);
        }

        return null;
    }, [isBrowser]);

    // Delete a script
    const deleteScript = useCallback((name: string) => {
        if (!isBrowser || name === "draft") return;

        try {
            localStorage.removeItem(SCRIPT_PREFIX + name);
            const newIndex = scripts.filter(s => s !== name);
            saveIndex(newIndex);
            return true;
        } catch (err) {
            console.error("Failed to delete script:", err);
            return false;
        }
    }, [isBrowser, scripts, saveIndex]);

    // Save draft (special case)
    const saveDraft = useCallback((code: string) => {
        if (!isBrowser) return;

        try {
            const draft: Script = {
                name: "draft",
                code,
                timestamp: Date.now(),
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (err) {
            console.error("Failed to save draft:", err);
        }
    }, [isBrowser]);

    // Rename a script
    const renameScript = useCallback((oldName: string, newName: string) => {
        if (!isBrowser || oldName === "draft" || newName === "draft") return false;

        try {
            const script = loadScript(oldName);
            if (!script) return false;

            // Save with new name
            script.name = newName;
            localStorage.setItem(SCRIPT_PREFIX + newName, JSON.stringify(script));

            // Delete old
            localStorage.removeItem(SCRIPT_PREFIX + oldName);

            // Update index
            const newIndex = scripts.map(s => s === oldName ? newName : s).sort();
            saveIndex(newIndex);

            return true;
        } catch (err) {
            console.error("Failed to rename script:", err);
            return false;
        }
    }, [isBrowser, scripts, loadScript, saveIndex]);

    return {
        scripts,
        currentScript,
        setCurrentScript,
        saveScript,
        loadScript,
        deleteScript,
        saveDraft,
        renameScript,
    };
}
