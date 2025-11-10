import { describe, expect, it } from "vitest";
import { WatchedGraph } from "../src/algebra/watch.js";
import {
    getActiveOperations,
    getComputedContexts,
    getComputeResult,
    installBuiltinCompute,
    installIOCompute,
    isComputed,
} from "../extensions/io-compute.js";
import { matchGraph, pattern, patternQuad } from "../src/algebra/pattern.js";
import { quad as q } from "../src/algebra/quad.js";
import { variable as v, word as w } from "../src/types.js";

describe("IO-Compute", () => {
    describe("Binary Operations", () => {
        describe("ADD", () => {
            it("should add two positive numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 10, w("calc1")));
                g.add(q(w("calc1"), w("y"), 20, w("calc1")));
                g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

                expect(isComputed(g, w("add"), w("calc1"))).toBe(true);
                expect(getComputeResult(g, w("calc1"))).toBe(30);
            });

            it("should add negative numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), -5, w("calc2")));
                g.add(q(w("calc2"), w("y"), -10, w("calc2")));
                g.add(q(w("calc2"), w("handle"), w("add"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(-15);
            });

            it("should add decimal numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 1.5, w("calc3")));
                g.add(q(w("calc3"), w("y"), 2.3, w("calc3")));
                g.add(q(w("calc3"), w("handle"), w("add"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBeCloseTo(3.8);
            });

            it("should mark operation as handled in output context", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc4"), w("x"), 5, w("calc4")));
                g.add(q(w("calc4"), w("y"), 3, w("calc4")));
                g.add(q(w("calc4"), w("handle"), w("add"), w("input")));

                const handled = matchGraph(
                    g,
                    pattern(
                        patternQuad(
                            w("add"),
                            w("handled"),
                            w("calc4"),
                            w("output"),
                        ),
                    ),
                );
                expect(handled).toHaveLength(1);
            });
        });

        describe("SUBTRACT", () => {
            it("should subtract two numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 20));
                g.add(q(w("calc1"), w("y"), 8));
                g.add(q(w("calc1"), w("handle"), w("subtract"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(12);
            });

            it("should handle negative results", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 5));
                g.add(q(w("calc2"), w("y"), 10));
                g.add(q(w("calc2"), w("handle"), w("subtract"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(-5);
            });
        });

        describe("MULTIPLY", () => {
            it("should multiply two positive numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 6));
                g.add(q(w("calc1"), w("y"), 7));
                g.add(q(w("calc1"), w("handle"), w("multiply"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(42);
            });

            it("should handle multiplication by zero", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 100));
                g.add(q(w("calc2"), w("y"), 0));
                g.add(q(w("calc2"), w("handle"), w("multiply"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(0);
            });

            it("should multiply decimal numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 2.5));
                g.add(q(w("calc3"), w("y"), 4));
                g.add(q(w("calc3"), w("handle"), w("multiply"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBe(10);
            });
        });

        describe("DIVIDE", () => {
            it("should divide two numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 20));
                g.add(q(w("calc1"), w("y"), 4));
                g.add(q(w("calc1"), w("handle"), w("divide"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(5);
            });

            it("should handle division by zero (returns Infinity)", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 10));
                g.add(q(w("calc2"), w("y"), 0));
                g.add(q(w("calc2"), w("handle"), w("divide"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(Infinity);
            });

            it("should handle decimal division", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 7));
                g.add(q(w("calc3"), w("y"), 2));
                g.add(q(w("calc3"), w("handle"), w("divide"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBe(3.5);
            });
        });

        describe("MODULO", () => {
            it("should compute modulo", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 17));
                g.add(q(w("calc1"), w("y"), 5));
                g.add(q(w("calc1"), w("handle"), w("modulo"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(2);
            });

            it("should handle exact division (modulo 0)", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 20));
                g.add(q(w("calc2"), w("y"), 5));
                g.add(q(w("calc2"), w("handle"), w("modulo"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(0);
            });
        });

        describe("POW", () => {
            it("should compute power", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 2));
                g.add(q(w("calc1"), w("y"), 8));
                g.add(q(w("calc1"), w("handle"), w("pow"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(256);
            });

            it("should handle power of zero", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 5));
                g.add(q(w("calc2"), w("y"), 0));
                g.add(q(w("calc2"), w("handle"), w("pow"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(1);
            });

            it("should handle fractional powers (roots)", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 27));
                g.add(q(w("calc3"), w("y"), 1 / 3));
                g.add(q(w("calc3"), w("handle"), w("pow"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBeCloseTo(3);
            });
        });
    });

    describe("Unary Operations", () => {
        describe("SQRT", () => {
            it("should compute square root", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 16));
                g.add(q(w("calc1"), w("handle"), w("sqrt"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(4);
            });

            it("should handle perfect squares", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 144));
                g.add(q(w("calc2"), w("handle"), w("sqrt"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(12);
            });

            it("should handle non-perfect squares", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 2));
                g.add(q(w("calc3"), w("handle"), w("sqrt"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBeCloseTo(1.414, 3);
            });
        });

        describe("ABS", () => {
            it("should compute absolute value of negative number", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), -42));
                g.add(q(w("calc1"), w("handle"), w("abs"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(42);
            });

            it("should handle positive numbers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 42));
                g.add(q(w("calc2"), w("handle"), w("abs"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(42);
            });

            it("should handle zero", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 0));
                g.add(q(w("calc3"), w("handle"), w("abs"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBe(0);
            });
        });

        describe("FLOOR", () => {
            it("should floor positive decimal", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 3.7));
                g.add(q(w("calc1"), w("handle"), w("floor"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(3);
            });

            it("should floor negative decimal", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), -3.7));
                g.add(q(w("calc2"), w("handle"), w("floor"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(-4);
            });

            it("should handle integers", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 5));
                g.add(q(w("calc3"), w("handle"), w("floor"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBe(5);
            });
        });

        describe("CEIL", () => {
            it("should ceil positive decimal", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 3.2));
                g.add(q(w("calc1"), w("handle"), w("ceil"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(4);
            });

            it("should ceil negative decimal", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), -3.2));
                g.add(q(w("calc2"), w("handle"), w("ceil"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(-3);
            });
        });

        describe("ROUND", () => {
            it("should round up", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 3.6));
                g.add(q(w("calc1"), w("handle"), w("round"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(4);
            });

            it("should round down", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), 3.4));
                g.add(q(w("calc2"), w("handle"), w("round"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(3);
            });

            it("should round 0.5 up", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 3.5));
                g.add(q(w("calc3"), w("handle"), w("round"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBe(4);
            });
        });

        describe("NEGATE", () => {
            it("should negate positive number", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc1"), w("x"), 42));
                g.add(q(w("calc1"), w("handle"), w("negate"), w("input")));

                expect(getComputeResult(g, w("calc1"))).toBe(-42);
            });

            it("should negate negative number", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc2"), w("x"), -42));
                g.add(q(w("calc2"), w("handle"), w("negate"), w("input")));

                expect(getComputeResult(g, w("calc2"))).toBe(42);
            });

            it("should negate zero", () => {
                const g = new WatchedGraph();
                installBuiltinCompute(g);

                g.add(q(w("calc3"), w("x"), 0));
                g.add(q(w("calc3"), w("handle"), w("negate"), w("input")));

                expect(getComputeResult(g, w("calc3"))).toBe(-0);
            });
        });
    });

    describe("Helper Functions", () => {
        it("getComputeResult should extract result from output context", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("x"), 100));
            g.add(q(w("calc1"), w("y"), 50));
            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            const result = getComputeResult(g, w("calc1"));
            expect(result).toBe(150);
        });

        it("isComputed should check if operation completed", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("x"), 10));
            g.add(q(w("calc1"), w("y"), 5));

            expect(isComputed(g, w("add"), w("calc1"))).toBe(false);

            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            expect(isComputed(g, w("add"), w("calc1"))).toBe(true);
        });

        it("getComputedContexts should find all contexts for an operation", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            // Execute add twice
            g.add(q(w("calc1"), w("x"), 10, w("calc1")));
            g.add(q(w("calc1"), w("y"), 5, w("calc1")));
            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            g.add(q(w("calc2"), w("x"), 20, w("calc2")));
            g.add(q(w("calc2"), w("y"), 30, w("calc2")));
            g.add(q(w("calc2"), w("handle"), w("add"), w("input")));

            const contexts = getComputedContexts(g, w("add"));
            expect(contexts).toHaveLength(2);

            const spellings = contexts.map((c) => c.spelling);
            expect(spellings).toContain(w("calc1").spelling);
            expect(spellings).toContain(w("calc2").spelling);
        });

        it("getActiveOperations should list installed operations", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            const ops = getActiveOperations(g);

            // Should have all 12 operations
            expect(ops.length).toBeGreaterThanOrEqual(12);

            const opNames = ops.map((o) => o.spelling);
            expect(opNames).toContain(w("add").spelling);
            expect(opNames).toContain(w("subtract").spelling);
            expect(opNames).toContain(w("sqrt").spelling);
            expect(opNames).toContain(w("abs").spelling);
        });
    });

    describe("Error Handling", () => {
        it("should error when binary operation missing x operand", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("y"), 20, w("calc1")));
            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            const errors = matchGraph(
                g,
                pattern(
                    patternQuad(w("calc1"), w("error"), v("msg"), w("output")),
                ),
            );

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].get("msg")).toContain("Missing");
        });

        it("should error when binary operation missing y operand", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("x"), 10, w("calc1")));
            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            const errors = matchGraph(
                g,
                pattern(
                    patternQuad(w("calc1"), w("error"), v("msg"), w("output")),
                ),
            );

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].get("msg")).toContain("Missing");
        });

        it("should error when unary operation missing x operand", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("handle"), w("sqrt"), w("input")));

            const errors = matchGraph(
                g,
                pattern(
                    patternQuad(w("calc1"), w("error"), v("msg"), w("output")),
                ),
            );

            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0].get("msg")).toContain("Missing");
        });

        it("should set status to 'error' on error", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            const status = matchGraph(
                g,
                pattern(
                    patternQuad(
                        w("calc1"),
                        w("status"),
                        w("error"),
                        w("output"),
                    ),
                ),
            );

            expect(status).toHaveLength(1);
        });

        it("should set status to 'SUCCESS' on success", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("x"), 10, w("calc1")));
            g.add(q(w("calc1"), w("y"), 5, w("calc1")));
            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            const status = matchGraph(
                g,
                pattern(
                    patternQuad(
                        w("calc1"),
                        w("status"),
                        w("SUCCESS"),
                        w("output"),
                    ),
                ),
            );

            expect(status).toHaveLength(1);
        });
    });

    describe("Multiple Computations", () => {
        it("should handle multiple operations in sequence", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            // First: add 10 + 5 = 15
            g.add(q(w("step1"), w("x"), 10));
            g.add(q(w("step1"), w("y"), 5));
            g.add(q(w("step1"), w("handle"), w("add"), w("input")));

            // Second: multiply result by 2 = 30
            const step1Result = getComputeResult(g, w("step1"));
            g.add(q(w("step2"), w("x"), step1Result));
            g.add(q(w("step2"), w("y"), 2));
            g.add(q(w("step2"), w("handle"), w("multiply"), w("input")));

            expect(getComputeResult(g, w("step2"))).toBe(30);
        });

        it("should handle same operation on different contexts independently", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            g.add(q(w("calc1"), w("x"), 10));
            g.add(q(w("calc1"), w("y"), 5));
            g.add(q(w("calc1"), w("handle"), w("add"), w("input")));

            g.add(q(w("calc2"), w("x"), 100));
            g.add(q(w("calc2"), w("y"), 50));
            g.add(q(w("calc2"), w("handle"), w("add"), w("input")));

            expect(getComputeResult(g, w("calc1"))).toBe(15);
            expect(getComputeResult(g, w("calc2"))).toBe(150);
        });

        it("should allow mixing binary and unary operations", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            // Add: 16 + 9 = 25
            g.add(q(w("step1"), w("x"), 16));
            g.add(q(w("step1"), w("y"), 9));
            g.add(q(w("step1"), w("handle"), w("add"), w("input")));

            // Sqrt: sqrt(25) = 5
            const step1Result = getComputeResult(g, w("step1"));
            g.add(q(w("step2"), w("x"), step1Result));
            g.add(q(w("step2"), w("handle"), w("sqrt"), w("input")));

            expect(getComputeResult(g, w("step2"))).toBe(5);
        });
    });

    describe("Installation", () => {
        it("installBuiltinCompute should install all operations", () => {
            const g = new WatchedGraph();
            const unwatchMap = installBuiltinCompute(g);

            // Should return Map with unwatch functions
            expect(unwatchMap).toBeInstanceOf(Map);
            expect(unwatchMap.size).toBeGreaterThanOrEqual(12);

            // Check some key operations are installed
            expect(unwatchMap.has("ADD")).toBe(true);
            expect(unwatchMap.has("SUBTRACT")).toBe(true);
            expect(unwatchMap.has("SQRT")).toBe(true);
        });

        it("should register operation metadata in system context", () => {
            const g = new WatchedGraph();
            installBuiltinCompute(g);

            // Check that ADD is registered
            const typeQuads = matchGraph(
                g,
                pattern(
                    patternQuad(
                        w("add"),
                        w("type"),
                        w("operation!"),
                        w("system"),
                    ),
                ),
            );
            expect(typeQuads).toHaveLength(1);

            // Check arity metadata
            const arityQuads = matchGraph(
                g,
                pattern(
                    patternQuad(w("add"), w("arity"), v("arity"), w("system")),
                ),
            );
            expect(arityQuads).toHaveLength(1);
            expect(arityQuads[0].get("arity")).toBe("binary");
        });
    });

    describe("Custom Operations", () => {
        it("should allow installing custom binary operation", () => {
            const g = new WatchedGraph();

            // Install custom DOUBLE operation
            installIOCompute(
                g,
                "DOUBLE",
                (x, y) => x * 2,
                {
                    arity: "binary",
                    operationType: "arithmetic",
                    doc: "Double the first argument",
                },
            );

            g.add(q(w("calc1"), w("x"), 21));
            g.add(q(w("calc1"), w("y"), 0)); // y is ignored
            g.add(q(w("calc1"), w("handle"), w("DOUBLE"), w("input")));

            expect(getComputeResult(g, w("calc1"))).toBe(42);
        });

        it("should allow installing custom unary operation", () => {
            const g = new WatchedGraph();

            // Install custom TRIPLE operation
            installIOCompute(
                g,
                "TRIPLE",
                (x) => x * 3,
                {
                    arity: "unary",
                    operationType: "arithmetic",
                    doc: "Triple the argument",
                },
            );

            g.add(q(w("calc1"), w("x"), 7));
            g.add(q(w("calc1"), w("handle"), w("TRIPLE"), w("input")));

            expect(getComputeResult(g, w("calc1"))).toBe(21);
        });
    });
});
