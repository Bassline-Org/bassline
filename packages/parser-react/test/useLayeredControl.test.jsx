import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { LayeredControl } from "@bassline/parser/control";
import {
    LayeredControlProvider,
    useBranches,
    useCommits,
    useLayer,
    useLayeredControl,
    useLayerQuads,
    useLayers,
    useRouting,
    useStaging,
} from "../src/hooks/useLayeredControl.jsx";

// Helper to create wrapper with provider
function createWrapper(lc) {
    return function Wrapper({ children }) {
        return (
            <LayeredControlProvider value={lc}>
                {children}
            </LayeredControlProvider>
        );
    };
}

describe("LayeredControl Hooks", () => {
    describe("useLayeredControl", () => {
        it("should return LayeredControl instance from context", () => {
            const lc = new LayeredControl();
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayeredControl(), {
                wrapper,
            });

            expect(result.current).toBe(lc);
        });

        it("should throw error when used outside provider", () => {
            expect(() => {
                renderHook(() => useLayeredControl());
            }).toThrow(
                "useLayeredControl must be used within LayeredControlProvider",
            );
        });
    });

    describe("useLayer", () => {
        it("should return Control instance for existing layer", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayer("foo"), { wrapper });

            expect(result.current).toBeDefined();
            expect(typeof result.current.run).toBe("function");
        });

        it("should throw error for non-existent layer", () => {
            const lc = new LayeredControl();
            const wrapper = createWrapper(lc);

            expect(() => {
                renderHook(() => useLayer("nonexistent"), { wrapper });
            }).toThrow("Layer not found: nonexistent");
        });
    });

    describe("useLayers", () => {
        it("should return empty array initially", () => {
            const lc = new LayeredControl();
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayers(), { wrapper });

            expect(result.current).toEqual([]);
        });

        it("should update when layer is added", () => {
            const lc = new LayeredControl();
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayers(), { wrapper });

            expect(result.current).toEqual([]);

            act(() => {
                lc.addLayer("foo");
            });

            expect(result.current).toEqual(["foo"]);

            act(() => {
                lc.addLayer("bar");
            });

            expect(result.current).toEqual(["foo", "bar"]);
        });

        it("should update when layer is removed", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            lc.addLayer("bar");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayers(), { wrapper });

            expect(result.current).toEqual(["foo", "bar"]);

            act(() => {
                lc.removeLayer("foo");
            });

            expect(result.current).toEqual(["bar"]);
        });

        it("should update when bus is added", () => {
            const lc = new LayeredControl();
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayers(), { wrapper });

            act(() => {
                lc.addBus("bus1");
            });

            expect(result.current).toEqual(["bus1"]);
        });
    });

    describe("useRouting", () => {
        it("should return empty array initially", () => {
            const lc = new LayeredControl();
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useRouting(), { wrapper });

            expect(result.current).toEqual([]);
        });

        it("should update when routing is added", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            lc.addLayer("bar");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useRouting(), { wrapper });

            expect(result.current).toEqual([]);

            act(() => {
                lc.route("foo", "bar");
            });

            expect(result.current).toEqual([{ from: "foo", to: "bar" }]);
        });

        it("should handle multiple routes", () => {
            const lc = new LayeredControl();
            lc.addLayer("a");
            lc.addLayer("b");
            lc.addLayer("c");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useRouting(), { wrapper });

            act(() => {
                lc.route("a", "b");
                lc.route("b", "c");
            });

            expect(result.current).toEqual([
                { from: "a", to: "b" },
                { from: "b", to: "c" },
            ]);
        });
    });

    describe("useLayerQuads", () => {
        it("should return quads array initially", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayerQuads("foo"), {
                wrapper,
            });

            // Layers start with system quads (operations/effects)
            expect(Array.isArray(result.current)).toBe(true);
            expect(result.current.length).toBeGreaterThan(0);
        });

        it("should update when quads are added", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useLayerQuads("foo"), {
                wrapper,
            });

            const initialLength = result.current.length;

            act(() => {
                layer.run("insert { alice age 30 system }");
            });

            expect(result.current.length).toBe(initialLength + 1);

            act(() => {
                layer.run("insert { bob age 25 system }");
            });

            expect(result.current.length).toBe(initialLength + 2);
        });
    });

    describe("useStaging", () => {
        it("should return no changes initially", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useStaging("foo"), { wrapper });

            expect(result.current).toEqual({
                count: 0,
                hasChanges: false,
            });
        });

        it("should update when quads are staged", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useStaging("foo"), { wrapper });

            act(() => {
                layer.run("insert { alice age 30 system }");
            });

            expect(result.current).toEqual({
                count: 1,
                hasChanges: true,
            });

            act(() => {
                layer.run("insert { bob age 25 system }");
            });

            expect(result.current).toEqual({
                count: 2,
                hasChanges: true,
            });
        });

        it("should clear after commit", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useStaging("foo"), { wrapper });

            act(() => {
                layer.run("insert { alice age 30 system }");
            });

            expect(result.current.hasChanges).toBe(true);

            act(() => {
                lc.commit("foo", "test");
            });

            expect(result.current).toEqual({
                count: 0,
                hasChanges: false,
            });
        });
    });

    describe("useCommits", () => {
        it("should return empty array initially", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useCommits("foo"), { wrapper });

            expect(result.current).toEqual([]);
        });

        it("should update when commits are made", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useCommits("foo"), { wrapper });

            act(() => {
                layer.run("insert { alice age 30 system }");
                lc.commit("foo", "first commit");
            });

            expect(result.current.length).toBe(1);
            expect(result.current[0].message).toBe("first commit");

            act(() => {
                layer.run("insert { bob age 25 system }");
                lc.commit("foo", "second commit");
            });

            expect(result.current.length).toBe(2);
            expect(result.current[0].message).toBe("second commit");
            expect(result.current[1].message).toBe("first commit");
        });

        it("should update when restored", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "commit 1");
            layer.run("insert { bob age 25 system }");
            lc.commit("foo", "commit 2");

            const wrapper = createWrapper(lc);
            const { result } = renderHook(() => useCommits("foo"), { wrapper });

            expect(result.current.length).toBe(2);

            act(() => {
                lc.restore("foo", commit1);
            });

            // After restore, we're back at commit1
            expect(result.current.length).toBe(1);
            expect(result.current[0].message).toBe("commit 1");
        });
    });

    describe("useBranches", () => {
        it("should return empty branches initially", () => {
            const lc = new LayeredControl();
            lc.addLayer("foo");
            const wrapper = createWrapper(lc);

            const { result } = renderHook(() => useBranches("foo"), {
                wrapper,
            });

            expect(result.current).toEqual({
                branches: [],
                current: null,
            });
        });

        it("should update when branch is created", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");

            const wrapper = createWrapper(lc);
            const { result } = renderHook(() => useBranches("foo"), {
                wrapper,
            });

            act(() => {
                lc.createBranch("foo", "main", commit1);
            });

            expect(result.current.branches).toEqual(["main"]);
            expect(result.current.current).toBe(null);
        });

        it("should update when branch is switched", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");
            lc.createBranch("foo", "main", commit1);

            const wrapper = createWrapper(lc);
            const { result } = renderHook(() => useBranches("foo"), {
                wrapper,
            });

            act(() => {
                lc.switchBranch("foo", "main");
            });

            expect(result.current.current).toBe("main");
        });

        it("should update when branch is deleted", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");
            lc.createBranch("foo", "main", commit1);
            lc.createBranch("foo", "feature", commit1);
            lc.switchBranch("foo", "main");

            const wrapper = createWrapper(lc);
            const { result } = renderHook(() => useBranches("foo"), {
                wrapper,
            });

            expect(result.current.branches).toContain("feature");

            act(() => {
                lc.deleteBranch("foo", "feature");
            });

            expect(result.current.branches).not.toContain("feature");
            expect(result.current.branches).toEqual(["main"]);
        });

        it("should show null current after head detached", () => {
            const lc = new LayeredControl();
            const layer = lc.addLayer("foo");

            layer.run("insert { alice age 30 system }");
            const commit1 = lc.commit("foo", "initial");
            lc.createBranch("foo", "main", commit1);
            lc.switchBranch("foo", "main");

            const wrapper = createWrapper(lc);
            const { result } = renderHook(() => useBranches("foo"), {
                wrapper,
            });

            expect(result.current.current).toBe("main");

            act(() => {
                lc.detachHead("foo", commit1);
            });

            expect(result.current.current).toBe(null);
        });
    });

    describe("Integration Tests", () => {
        it("should handle complex workflow with multiple hooks", () => {
            const lc = new LayeredControl();
            const wrapper = createWrapper(lc);

            const layers = renderHook(() => useLayers(), { wrapper });
            expect(layers.result.current).toEqual([]);

            // Add layer
            act(() => {
                lc.addLayer("foo");
            });
            expect(layers.result.current).toEqual(["foo"]);

            // Hook up other hooks
            const staging = renderHook(() => useStaging("foo"), { wrapper });
            const commits = renderHook(() => useCommits("foo"), { wrapper });
            const branches = renderHook(() => useBranches("foo"), { wrapper });

            const layer = lc.getLayer("foo").control;

            // Add data
            act(() => {
                layer.run("insert { alice age 30 system }");
            });
            expect(staging.result.current.hasChanges).toBe(true);

            // Commit
            act(() => {
                const hash = lc.commit("foo", "first");
                lc.createBranch("foo", "main", hash);
                lc.switchBranch("foo", "main");
            });

            expect(staging.result.current.hasChanges).toBe(false);
            expect(commits.result.current.length).toBe(1);
            expect(branches.result.current.current).toBe("main");
        });
    });
});
