# Algebra Performance Benchmarks

This directory contains performance benchmarks for the algebra-based pattern matching system.

## Available Benchmarks

### Core Performance

**`algebra-simple-throughput.js`** - Main throughput benchmarks
```bash
node benchmarks/algebra-simple-throughput.js
```

Measures:
- Raw graph operations (400K edges/sec)
- Single pattern matching (405K edges/sec)
- 1000 patterns with selective activation (304K edges/sec)
- Multi-quad patterns (8K edges/sec)
- Cascading rules (115K edges/sec)
- Batch stress test (311K edges/sec)

**`algebra-multiprocess.js`** - Multi-process scaling
```bash
node benchmarks/algebra-multiprocess.js
```

Tests parallel performance across 1-8 processes for:
- Raw graph operations
- Pattern matching
- Cascading rules

Peak aggregate throughput: **939K edges/sec** (8 processes)

### NAC Performance

**`nac-performance.js`** - NAC indexing performance
```bash
node benchmarks/nac-performance.js
```

Compares indexed vs unindexed NAC:
- Selective NAC (indexed): **393K edges/sec** (14x faster)
- Wildcard NAC (full scan): **28K edges/sec**
- Multi-literal NAC: **415K edges/sec**

Demonstrates O(N) → O(C) improvement via selective activation.

### Memory Analysis

**`memory-footprint.js`** - Overall memory usage
```bash
node --expose-gc benchmarks/memory-footprint.js
```

Measures memory for:
- Base Graph (~500 bytes/quad)
- WatchedGraph with indexes (~800 bytes/quad)
- Real-world social graph patterns

**`quad-index-overhead.js`** - Isolated quad index cost
```bash
node --expose-gc benchmarks/quad-index-overhead.js
```

Isolates quad index overhead:
- +116% memory overhead
- ~50 MB for 100K quads
- ~500 bytes per quad

## Performance Summary

| Metric | Value |
|--------|-------|
| **Peak throughput** | 405K edges/sec |
| **With 1000 patterns** | 304K edges/sec |
| **Multi-process (8x)** | 939K edges/sec |
| **Indexed NAC** | 393K edges/sec |
| **Wildcard NAC** | 28K edges/sec |
| **Memory per quad** | ~800 bytes |

## Key Insights

1. **Selective activation works**: 1000 patterns ≈ 1 pattern performance
2. **NAC indexing essential**: 14x faster than full scan
3. **Memory overhead acceptable**: +116% for 10-1000x performance gain
4. **Multi-process scales**: 3.64x speedup on 8 cores (45% efficiency)

## Running All Benchmarks

```bash
# Quick suite (no memory analysis)
node benchmarks/algebra-simple-throughput.js
node benchmarks/nac-performance.js

# Full suite (with memory)
node --expose-gc benchmarks/memory-footprint.js
node --expose-gc benchmarks/quad-index-overhead.js

# Multi-process (slower)
node benchmarks/algebra-multiprocess.js
```
