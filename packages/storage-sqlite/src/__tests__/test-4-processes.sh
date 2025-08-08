#!/bin/bash

echo "=== 4 Process Performance Test (Fully Optimized) ==="
echo "Configuration:"
echo "  - Operations per process: 500,000"
echo "  - Batch size: 2000 (optimal)"
echo "  - Page size: 16KB (optimal)"
echo "  - Mode: In-memory"
echo ""
echo "Starting 4 parallel processes..."
echo ""

# Start timer
start_time=$(date +%s%N)

# Run 4 processes in parallel and capture their output
(
  node src/__tests__/worker-batch-test.cjs proc1 500000 2000 16384 2>&1 | grep opsPerSec &
  node src/__tests__/worker-batch-test.cjs proc2 500000 2000 16384 2>&1 | grep opsPerSec &
  node src/__tests__/worker-batch-test.cjs proc3 500000 2000 16384 2>&1 | grep opsPerSec &
  node src/__tests__/worker-batch-test.cjs proc4 500000 2000 16384 2>&1 | grep opsPerSec &
  wait
) | while read line; do
  echo "$line"
  # Extract ops/sec from each line
  ops=$(echo "$line" | grep -oE '"opsPerSec":[0-9.]+' | cut -d: -f2)
  if [ ! -z "$ops" ]; then
    total_ops=$(echo "${total_ops:-0} + $ops" | bc)
  fi
done

# End timer
end_time=$(date +%s%N)
duration=$((($end_time - $start_time) / 1000000))

echo ""
echo "=== Summary ==="
echo "Total operations: 2,000,000 (500K × 4)"
echo "Wall clock time: ${duration}ms"

# Calculate aggregate throughput
if [ "$duration" -gt 0 ]; then
  aggregate_ops=$((2000000 * 1000 / duration))
  echo "Aggregate throughput: ~${aggregate_ops} ops/sec"
fi