# Baseline Performance Metrics

**Date**: 2025-11-02T07:15:20.288Z
**Node Version**: v22.17.1
**Platform**: darwin arm64

## Key Metrics

### 1. Literal Pattern Selectivity (1000 patterns, 100 edges)
- **Average**: 2.017ms
- **Per edge**: ~0.020ms
- **Expected after optimization**: ~0.002ms (10x improvement)

### 2. Wildcard Patterns (1000 patterns, 100 edges)
- **Average**: 2.712ms
- **Per edge**: ~0.027ms
- **Expected after optimization**: No change (still need to check all)

### 3. Mixed Patterns (800 literal + 200 wildcard)
- **Average**: 3.914ms
- **Per edge**: ~0.039ms
- **Expected after optimization**: ~0.8ms (5x improvement)

### 4. Scaling Analysis

| Patterns | Time per Edge | Scaling Factor |
|----------|--------------|----------------|
| 10       | 0.0003ms     | -              |
| 100      | 0.0020ms     | 6.64x          |
| 500      | 0.0120ms     | 6.00x          |
| 1000     | 0.0235ms     | 1.96x          |
| 2000     | 0.0471ms     | 2.01x          |

**Conclusion**: Clear O(P) scaling - time increases linearly with pattern count

### 5. Complex Multi-Triple Patterns (100 patterns with 3 triples each)
- **Average**: 32.933ms
- **This is the slowest case** - partial matches create many intermediate states

### 6. NAC Performance (100 patterns with NAC)
- **Average**: 2.520ms
- NAC checking adds ~25% overhead vs simple patterns

## Problems Identified

1. ✅ **O(P) scaling**: Every pattern checked for every edge
2. ✅ **No selectivity**: Literal patterns have no advantage
3. ✅ **Linear cost growth**: 2000 patterns = 157x slower than 10 patterns
4. ✅ **Complex patterns slow**: Multi-triple patterns create combinatorial explosion

## Expected Improvements

After selective pattern activation:

1. **Literal patterns**: 10-100x faster (only check matching patterns)
2. **Mixed patterns**: 5-10x faster (skip non-matching literals)
3. **Scaling**: O(log P + M) instead of O(P)
4. **No regression**: Wildcard patterns remain same speed

## Verification Criteria

The optimization is successful if:
- Benchmark 1 (literals) improves by >10x
- Benchmark 3 (mixed) improves by >5x
- Benchmark 7 scaling becomes sub-linear
- Benchmark 2 (wildcards) doesn't regress