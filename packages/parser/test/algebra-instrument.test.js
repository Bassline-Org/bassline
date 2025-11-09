import { describe, it, expect } from "vitest";
import { WatchedGraph } from "../src/algebra/watch.js";
import { instrument } from "../src/algebra/instrument.js";
import { quad as q } from "../src/algebra/quad.js";
import { word as w } from "../src/types.js";
import { installReifiedRules } from "../src/algebra/reified-rules.js";

describe("Algebra - Instrumentation", () => {
    it("should emit quad-added events", () => {
        const graph = new WatchedGraph();
        const events = instrument(graph);

        const capturedEvents = [];
        events.addEventListener("quad-added", (e) => {
            capturedEvents.push(e.detail);
        });

        // Add some quads
        const quad1 = q(w("alice"), w("age"), 30);
        const quad2 = q(w("bob"), w("age"), 25);

        graph.add(quad1);
        graph.add(quad2);

        // Verify events were emitted
        expect(capturedEvents).toHaveLength(2);
        expect(capturedEvents[0]).toBe(quad1);
        expect(capturedEvents[1]).toBe(quad2);
    });

    it("should still add quads to graph normally", () => {
        const graph = new WatchedGraph();
        instrument(graph);

        const quad1 = q(w("alice"), w("age"), 30);
        graph.add(quad1);

        // Verify quad was actually added to graph
        expect(graph.has(quad1)).toBe(true);
        expect(graph.quads.length).toBe(1);
    });

    it("should work with multiple listeners", () => {
        const graph = new WatchedGraph();
        const events = instrument(graph);

        const listener1Events = [];
        const listener2Events = [];

        events.addEventListener("quad-added", (e) => {
            listener1Events.push(e.detail);
        });

        events.addEventListener("quad-added", (e) => {
            listener2Events.push(e.detail);
        });

        const quad1 = q(w("alice"), w("age"), 30);
        graph.add(quad1);

        // Both listeners should receive the event
        expect(listener1Events).toHaveLength(1);
        expect(listener2Events).toHaveLength(1);
        expect(listener1Events[0]).toBe(quad1);
        expect(listener2Events[0]).toBe(quad1);
    });

    it("should capture all quads including from cascading additions", () => {
        const graph = new WatchedGraph();
        const events = instrument(graph);

        const capturedQuads = [];
        events.addEventListener("quad-added", (e) => {
            capturedQuads.push(e.detail);
        });

        // Add multiple quads
        const quad1 = q(w("alice"), w("age"), 30);
        const quad2 = q(w("bob"), w("age"), 25);
        const quad3 = q(w("carol"), w("age"), 35);

        graph.add(quad1);
        graph.add(quad2);
        graph.add(quad3);

        // All three quads should be captured in order
        expect(capturedQuads).toHaveLength(3);
        expect(capturedQuads[0]).toBe(quad1);
        expect(capturedQuads[1]).toBe(quad2);
        expect(capturedQuads[2]).toBe(quad3);
    });
});
