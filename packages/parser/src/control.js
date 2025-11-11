import { parseProgram } from "./pattern-parser.js";
import { createBrowserGraph } from "./browser-graph.js";
import { Graph } from "./algebra/graph.js";
import { hash, serialize } from "./types.js";

export const serializeQuad = (q) => q.values.map(serialize).join(" ");

export class Control {
    constructor() {
        const { graph, events } = createBrowserGraph();
        this.graph = graph;
        this.events = events;
    }
    add(quad) {
        this.graph.add(quad);
    }
    serialize() {
        const quads = this.graph.quads.map(serializeQuad).join("\n  ");
        return `
insert {
  ${quads}
}`;
    }

    listen(fn) {
        const handler = (e) => fn(e.detail);
        this.events.addEventListener("quad-added", handler);
        return () => this.events.removeEventListener("quad-added", handler);
    }

    run(source) {
        return parseProgram(source.trim())
            .map((cmd) => cmd(this));
    }
}

export class Bus extends EventTarget {
    add(quad) {
        this.dispatchEvent(
            new CustomEvent("quad-added", {
                detail: quad,
            }),
        );
    }
    listen(fn) {
        const handler = (e) => fn(e.detail);
        this.addEventListener("quad-added", handler);
        return () => this.removeEventListener("quad-added", handler);
    }
}

export class LayeredControl extends EventTarget {
    // =============================================================================
    // CONSTRUCTOR & CORE STATE
    // =============================================================================
    // LayeredControl manages multiple graph layers with Git-style version control
    // - layers: Map of layer name -> {control, staging, commits, head, currentBranch}
    // - quadStore: Central storage for all quads (deduplicated by hash)
    // - refs: Branch references (layerName/branchName -> commitHash)

    constructor() {
        super();
        this.layers = {};
        this.quadStore = new Graph();
        this.refs = {};
    }

    // =============================================================================
    // LAYER MANAGEMENT
    // =============================================================================
    // Create, remove, and manage graph layers (controls) and routing buses

    addBus(name) {
        if (this.layers[name]) {
            throw new Error("Must remove the layer before adding a new layer!");
        }
        this.layers[name] = {
            bus: new Bus(),
        };

        this.dispatchEvent(new CustomEvent("bus-added", {
            detail: { name }
        }));
    }
    addLayer(name) {
        if (this.layers[name]) {
            throw new Error("Must remove the layer before adding a new layer!");
        }
        const control = new Control();
        this.layers[name] = {
            control,
            staging: new Set(),
            commits: new Map(),
            head: null, // Current commit hash (like detached HEAD)
            currentBranch: null, // Current branch name (like HEAD -> refs/heads/main)
        };
        control.listen((quad) => {
            const layer = this.layers[name];
            layer.staging.add(quad.hash());
            this.quadStore.add(quad);
        });

        this.dispatchEvent(new CustomEvent("layer-added", {
            detail: { name }
        }));

        return control;
    }

    removeLayer(name) {
        const { cleanup } = this.getLayer(name) ?? {};
        cleanup?.();
        delete this.layers[name];

        this.dispatchEvent(new CustomEvent("layer-removed", {
            detail: { name }
        }));
    }

    // =============================================================================
    // ROUTING
    // =============================================================================
    // Connect layers: quads flow from source -> target via event listeners
    // Each layer can have one output (use buses for fan-in/merge)

    route(fromName, toName) {
        const from = this.getLayer(fromName);
        const to = this.getLayer(toName);
        if (from.cleanup) {
            from?.cleanup?.();
        }
        from.output = toName;
        const source = from.control ?? from.bus;
        const target = to.control ?? to.bus;
        const cleanup = source.listen((quad) => target.add(quad));
        from.cleanup = cleanup;

        this.dispatchEvent(new CustomEvent("routing-changed", {
            detail: { from: fromName, to: toName }
        }));
    }

    // =============================================================================
    // VERSION CONTROL: STAGING & COMMITS
    // =============================================================================
    // Git-style staging area and commit creation per layer

    commit(name, message = "") {
        const layer = this.layers[name];
        if (!layer) throw new Error(`Layer not found: ${name}`);

        const quadHashes = Array.from(layer.staging);
        if (quadHashes.length === 0) {
            return layer.head; // No changes to commit
        }

        // Create commit hash from: quad hashes + previous head + timestamp
        const toHash = [...quadHashes, layer.head ?? 0, Date.now()];
        const commitHash = toHash.reduce(
            (acc, curr, index) => hash(curr) ^ (acc + index),
            0,
        );

        const commit = {
            hash: commitHash,
            parent: layer.head,
            quads: quadHashes,
            message,
            timestamp: Date.now(),
        };

        layer.commits.set(commitHash, commit);
        layer.head = commitHash;
        layer.staging.clear();

        // Update branch ref if on a branch (like Git updating refs/heads/main)
        if (layer.currentBranch) {
            const refKey = `${name}/${layer.currentBranch}`;
            this.refs[refKey] = commitHash;
        }

        this.dispatchEvent(new CustomEvent("committed", {
            detail: { name, commitHash, message }
        }));

        return commitHash;
    }

    hasStagedChanges(name) {
        const layer = this.layers[name];
        return layer ? layer.staging.size > 0 : false;
    }

    getStagedCount(name) {
        const layer = this.layers[name];
        return layer ? layer.staging.size : 0;
    }

    unstage(name, quadHash) {
        const layer = this.layers[name];
        if (!layer) throw new Error(`Layer not found: ${name}`);

        const removed = layer.staging.delete(quadHash);

        if (removed) {
            this.dispatchEvent(new CustomEvent("staging-changed", {
                detail: { layerName: name, action: "unstage", quadHash }
            }));
        }

        return removed;
    }

    clearStaging(name) {
        const layer = this.layers[name];
        if (!layer) throw new Error(`Layer not found: ${name}`);

        const count = layer.staging.size;
        layer.staging.clear();

        if (count > 0) {
            this.dispatchEvent(new CustomEvent("staging-changed", {
                detail: { layerName: name, action: "clear", count }
            }));
        }

        return count;
    }

    getStagedQuads(name) {
        const layer = this.layers[name];
        if (!layer) throw new Error(`Layer not found: ${name}`);

        const quads = [];
        for (const quadHash of layer.staging) {
            for (const quad of this.quadStore.quads) {
                if (quad.hash() === quadHash) {
                    quads.push(quad);
                    break;
                }
            }
        }

        return quads;
    }

    // =============================================================================
    // VERSION CONTROL: HISTORY & RESTORE
    // =============================================================================
    // Navigate commit history and restore layers to specific commits
    // Restore recreates the layer with fresh indexes to avoid stale state

    getCommitChain(name, commitHash) {
        const layer = this.layers[name];
        if (!layer) throw new Error(`Layer not found: ${name}`);

        const quadHashes = new Set();
        let current = commitHash;

        while (current !== null) {
            const commit = layer.commits.get(current);
            if (!commit) throw new Error(`Commit not found: ${current}`);

            commit.quads.forEach((h) => quadHashes.add(h));
            current = commit.parent;
        }

        return quadHashes;
    }

    restore(name, commitHash) {
        const layer = this.layers[name];
        if (!layer) throw new Error(`Layer not found: ${name}`);

        // Get all quad hashes for this commit
        const quadHashes = this.getCommitChain(name, commitHash);

        // Save metadata before recreation
        const commits = layer.commits;
        const currentBranch = layer.currentBranch;

        // Find all layers routing TO this layer
        const incomingRoutes = [];
        for (const [sourceName, sourceLayer] of Object.entries(this.layers)) {
            if (sourceLayer.output === name) {
                incomingRoutes.push(sourceName);
            }
        }

        // Find outgoing route
        const outgoingRoute = layer.output;

        // Remove the layer completely (cleans up listeners)
        this.removeLayer(name);

        // Create fresh layer WITHOUT listener (we'll add quads directly)
        const control = new Control();
        this.layers[name] = {
            control,
            staging: new Set(),
            commits: commits,
            head: commitHash,
            currentBranch: currentBranch,
        };

        // Add quads from quad store to fresh graph (no listener, so no staging pollution)
        quadHashes.forEach((h) => {
            for (const quad of this.quadStore.quads) {
                if (quad.hash() === h) {
                    control.graph.add(quad);
                    break;
                }
            }
        });

        // NOW set up the listener for future additions
        const newLayer = this.layers[name];
        control.listen((quad) => {
            newLayer.staging.add(quad.hash());
            this.quadStore.add(quad);
        });

        // Restore outgoing route
        if (outgoingRoute) {
            this.route(name, outgoingRoute);
        }

        // Restore incoming routes
        for (const sourceName of incomingRoutes) {
            this.route(sourceName, name);
        }

        this.dispatchEvent(new CustomEvent("restored", {
            detail: { name, commitHash }
        }));

        return control;
    }

    getCommitHistory(name, maxCount = 10) {
        const layer = this.layers[name];
        if (!layer) throw new Error(`Layer not found: ${name}`);

        const history = [];
        let current = layer.head;
        let count = 0;

        while (current !== null && count < maxCount) {
            const commit = layer.commits.get(current);
            if (!commit) break;

            history.push({
                hash: commit.hash,
                parent: commit.parent,
                message: commit.message,
                timestamp: commit.timestamp,
                quadCount: commit.quads.length,
            });

            current = commit.parent;
            count++;
        }

        return history;
    }

    // =============================================================================
    // VERSION CONTROL: BRANCHES
    // =============================================================================
    // Git-style branch management - lightweight pointers to commits

    createBranch(layerName, branchName, commitHash) {
        const layer = this.layers[layerName];
        if (!layer) throw new Error(`Layer not found: ${layerName}`);

        // Use current HEAD if no commit specified
        const commit = commitHash ?? layer.head;
        if (commit === null) {
            throw new Error("Cannot create branch: no commits exist yet");
        }

        const refKey = `${layerName}/${branchName}`;
        if (this.refs[refKey]) {
            throw new Error(`Branch already exists: ${branchName}`);
        }

        this.refs[refKey] = commit;

        this.dispatchEvent(new CustomEvent("branch-created", {
            detail: { layerName, branchName, commitHash: commit }
        }));

        return refKey;
    }

    switchBranch(layerName, branchName) {
        let layer = this.layers[layerName];
        if (!layer) throw new Error(`Layer not found: ${layerName}`);

        const refKey = `${layerName}/${branchName}`;
        const commitHash = this.refs[refKey];

        if (!commitHash) {
            throw new Error(`Branch not found: ${branchName}`);
        }

        // Restore to branch's commit (recreates layer)
        this.restore(layerName, commitHash);

        // Get fresh reference after restore recreated the layer
        layer = this.layers[layerName];

        // Update HEAD to point to branch
        layer.currentBranch = branchName;

        this.dispatchEvent(new CustomEvent("branch-switched", {
            detail: { layerName, branchName, commitHash }
        }));

        return commitHash;
    }

    deleteBranch(layerName, branchName) {
        const layer = this.layers[layerName];
        if (!layer) throw new Error(`Layer not found: ${layerName}`);

        // Prevent deleting current branch
        if (layer.currentBranch === branchName) {
            throw new Error(`Cannot delete current branch: ${branchName}`);
        }

        const refKey = `${layerName}/${branchName}`;
        if (!this.refs[refKey]) {
            throw new Error(`Branch not found: ${branchName}`);
        }

        delete this.refs[refKey];

        this.dispatchEvent(new CustomEvent("branch-deleted", {
            detail: { layerName, branchName }
        }));
    }

    listBranches(layerName) {
        const prefix = `${layerName}/`;
        return Object.keys(this.refs)
            .filter((ref) => ref.startsWith(prefix))
            .map((ref) => ref.slice(prefix.length));
    }

    getCurrentBranch(layerName) {
        const layer = this.layers[layerName];
        return layer ? layer.currentBranch : null;
    }

    detachHead(layerName, commitHash) {
        let layer = this.layers[layerName];
        if (!layer) throw new Error(`Layer not found: ${layerName}`);

        // Restore to commit without being on a branch (detached HEAD)
        this.restore(layerName, commitHash);

        // Get fresh reference after restore recreated the layer
        layer = this.layers[layerName];

        // Detach from branch
        layer.currentBranch = null;

        this.dispatchEvent(new CustomEvent("head-detached", {
            detail: { layerName, commitHash }
        }));

        return commitHash;
    }

    // =============================================================================
    // SERIALIZATION
    // =============================================================================
    // Serialize/deserialize entire LayeredControl state
    // Stores quadStore once (deduplicated), then layer metadata + commit history

    toString() {
        const out = {
            quadStore: [], // Serialize all quads once
            refs: this.refs, // Branch references
            layers: {},
        };

        // Serialize quad store (all quads in one place)
        for (const quad of this.quadStore.quads) {
            out.quadStore.push({
                hash: quad.hash(),
                quad: serializeQuad(quad),
            });
        }

        // Serialize layer metadata (commits, head, branch info, routing)
        for (const [name, layer] of Object.entries(this.layers)) {
            const entry = { output: layer.output };

            if (layer.bus) {
                entry.bus = true;
            }

            if (layer.control) {
                // Store commit history and current state
                const commits = [];
                for (const [hash, commit] of layer.commits.entries()) {
                    commits.push({
                        hash: commit.hash,
                        parent: commit.parent,
                        quads: commit.quads, // Array of quad hashes
                        message: commit.message,
                        timestamp: commit.timestamp,
                    });
                }

                entry.commits = commits;
                entry.head = layer.head;
                entry.currentBranch = layer.currentBranch;
            }

            out.layers[name] = entry;
        }

        return JSON.stringify(out);
    }
    static fromJSON(str) {
        const obj = JSON.parse(str);
        const layered = new LayeredControl();

        // Restore quad store first (central store, populated once)
        // We need a temporary control to parse quads
        const tempControl = new Control();
        for (const { quad } of obj.quadStore ?? []) {
            tempControl.run(`insert { ${quad} }`);
        }
        // Copy all quads to the central quadStore
        for (const quad of tempControl.graph.quads) {
            layered.quadStore.add(quad);
        }

        // Restore refs
        layered.refs = obj.refs ?? {};

        // Restore layers
        const routes = [];
        for (const [name, layer] of Object.entries(obj.layers ?? {})) {
            if (layer.bus) {
                layered.addBus(name);
            } else if (layer.commits) {
                // Create layer (but don't populate graph yet)
                layered.addLayer(name);
                const layerObj = layered.layers[name];

                // Restore commits
                layerObj.commits = new Map();
                for (const commit of layer.commits) {
                    layerObj.commits.set(commit.hash, {
                        hash: commit.hash,
                        parent: commit.parent,
                        quads: commit.quads,
                        message: commit.message,
                        timestamp: commit.timestamp,
                    });
                }

                // Restore HEAD and branch
                layerObj.head = layer.head;
                layerObj.currentBranch = layer.currentBranch;

                // Restore to current HEAD state (pulls from quadStore)
                if (layer.head !== null) {
                    layered.restore(name, layer.head);
                    // Restore already clears staging, but make sure
                    layerObj.staging.clear();
                }
            }

            if (layer.output) {
                routes.push([name, layer.output]);
            }
        }

        // Restore routing
        for (const [from, to] of routes) {
            layered.route(from, to);
        }

        return layered;
    }

    // =============================================================================
    // UTILITIES
    // =============================================================================
    // Helper methods for accessing layer state

    getLayer(name) {
        return this.layers[name];
    }
}

// =============================================================================
// TEST / DEMO CODE (commented out to avoid running during imports)
// =============================================================================
// To run demo: node packages/parser/src/control.js
//
// const layered = new LayeredControl();
//
// const foo = layered.addLayer("foo");
//
// // Add initial data and commit
// foo.run(`insert { alice age 30 system }`);
// const commit1 = layered.commit("foo", "Initial commit");
// console.log("Commit 1:", commit1);
//
// // Create main branch at commit1
// layered.createBranch("foo", "main", commit1);
// console.log("Created branch: main");
//
// // Switch to main (makes commits update branch ref)
// layered.switchBranch("foo", "main");
// console.log("Current branch:", layered.getCurrentBranch("foo"));
//
// // Add more data on main
// foo.run(`insert { alice city NYC system }`);
// layered.commit("foo", "Add city");
// console.log("Committed on main");
//
// // Create feature branch from current commit
// layered.createBranch("foo", "feature-x");
// layered.switchBranch("foo", "feature-x");
// console.log("Switched to branch: feature-x");
//
// // Add feature data
// foo.run(`insert { alice hobby coding system }`);
// layered.commit("foo", "Add hobby");
// console.log("Committed on feature-x");
//
// // Check branch status
// console.log("\nBranches:", layered.listBranches("foo"));
// console.log("Current branch:", layered.getCurrentBranch("foo"));
// console.log("Refs:", layered.refs);
//
// // Switch back to main
// layered.switchBranch("foo", "main");
// console.log("\nSwitched back to main");
// const mainData = foo.run(`query where { alice ?a ?v system }`);
// console.log("Alice data on main:", mainData.length); // Should be 2: age and city (not hobby)
//
// // Switch to feature-x
// layered.switchBranch("foo", "feature-x");
// console.log("\nSwitched to feature-x");
// const featureData = foo.run(`query where { alice ?a ?v system }`);
// console.log("Alice data on feature-x:", featureData.length); // Should be 3: age, city, and hobby
//
// // Commit history from feature-x
// console.log("\nHistory on feature-x:", layered.getCommitHistory("foo"));
//
// // Detached HEAD
// console.log("\nDetaching HEAD to commit1...");
// layered.detachHead("foo", commit1);
// console.log("Current branch (detached):", layered.getCurrentBranch("foo"));
// const detachedData = foo.run(`query where { alice ?a ?v system }`);
// console.log("Alice data at commit1:", detachedData.length); // Should be 1: just age
