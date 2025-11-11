import { describe, it, expect } from "vitest";
import { LayeredControl } from "../src/control.js";

describe("Reactive LayeredControl", () => {
    describe("Layer Management Events", () => {
        it("should emit layer-added event", () => {
            const lc = new LayeredControl();
            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("layer-added", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.addLayer("foo");

            expect(emitted).toBe(true);
            expect(eventDetail).toEqual({ name: "foo" });
        });

        it("should emit bus-added event", () => {
            const lc = new LayeredControl();
            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("bus-added", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.addBus("bus1");

            expect(emitted).toBe(true);
            expect(eventDetail).toEqual({ name: "bus1" });
        });

        it("should emit layer-removed event", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("layer-removed", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.removeLayer("foo");

            expect(emitted).toBe(true);
            expect(eventDetail).toEqual({ name: "foo" });
        });
    });

    describe("Routing Events", () => {
        it("should emit routing-changed event", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            lc.addLayer("bar");

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("routing-changed", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.route("foo", "bar");

            expect(emitted).toBe(true);
            expect(eventDetail).toEqual({ from: "foo", to: "bar" });
        });
    });

    describe("Version Control Events", () => {
        it("should emit committed event", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("committed", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            layer.run("insert { alice age 30 system }");
            const commitHash = lc.commit("foo", "test commit");

            expect(emitted).toBe(true);
            expect(eventDetail.name).toBe("foo");
            expect(eventDetail.commitHash).toBe(commitHash);
            expect(eventDetail.message).toBe("test commit");
        });

        it("should emit restored event", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "commit 1");

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("restored", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.restore("foo", commit1);

            expect(emitted).toBe(true);
            expect(eventDetail).toEqual({
                name: "foo",
                commitHash: commit1,
            });
        });
    });

    describe("Branch Events", () => {
        it("should emit branch-created event", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("branch-created", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.createBranch("foo", "main", commit1);

            expect(emitted).toBe(true);
            expect(eventDetail.layerName).toBe("foo");
            expect(eventDetail.branchName).toBe("main");
            expect(eventDetail.commitHash).toBe(commit1);
        });

        it("should emit branch-switched event", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");
            lc.createBranch("foo", "main", commit1);

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("branch-switched", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            const commitHash = lc.switchBranch("foo", "main");

            expect(emitted).toBe(true);
            expect(eventDetail.layerName).toBe("foo");
            expect(eventDetail.branchName).toBe("main");
            expect(eventDetail.commitHash).toBe(commitHash);
        });

        it("should emit branch-deleted event", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");
            lc.createBranch("foo", "main", commit1);
            lc.createBranch("foo", "feature", commit1);
            lc.switchBranch("foo", "main");

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("branch-deleted", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.deleteBranch("foo", "feature");

            expect(emitted).toBe(true);
            expect(eventDetail).toEqual({
                layerName: "foo",
                branchName: "feature",
            });
        });

        it("should emit head-detached event", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");

            let emitted = false;
            let eventDetail = null;

            lc.addEventListener("head-detached", (e) => {
                emitted = true;
                eventDetail = e.detail;
            });

            lc.detachHead("foo", commit1);

            expect(emitted).toBe(true);
            expect(eventDetail).toEqual({
                layerName: "foo",
                commitHash: commit1,
            });
        });
    });

    describe("Multiple Listeners", () => {
        it("should call multiple listeners for same event", () => {
            const lc = new LayeredControl();
            let count = 0;

            lc.addEventListener("layer-added", () => count++);
            lc.addEventListener("layer-added", () => count++);
            lc.addEventListener("layer-added", () => count++);

            lc.addLayer("foo");

            expect(count).toBe(3);
        });
    });

    describe("No Breaking Changes", () => {
        it("should return same values as before", () => {
            const lc = new LayeredControl();

            // addLayer returns control
            const control = lc.addLayer("foo");
            expect(control).toBeDefined();
            expect(typeof control.run).toBe("function");

            // commit returns commitHash
            control.run("insert { alice age 30 system }");
            const hash = lc.commit("foo", "msg");
            expect(typeof hash).toBe("number");

            // createBranch returns refKey
            const refKey = lc.createBranch("foo", "main", hash);
            expect(refKey).toBe("foo/main");

            // switchBranch returns commitHash
            const commitHash = lc.switchBranch("foo", "main");
            expect(commitHash).toBe(hash);
        });

        it("should work with existing test code", () => {
            const lc = new LayeredControl();
            const foo = lc.addLayer("foo");

            foo.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "Initial commit");

            lc.createBranch("foo", "main", commit1);
            lc.switchBranch("foo", "main");

            foo.run("insert { alice city NYC system }");
            lc.commit("foo", "Add city");

            const branches = lc.listBranches("foo");
            const current = lc.getCurrentBranch("foo");

            expect(branches).toContain("main");
            expect(current).toBe("main");
        });
    });
});
