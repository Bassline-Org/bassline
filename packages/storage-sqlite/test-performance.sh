#!/bin/bash

echo "=== SQLite Performance Test ==="
echo "Testing 8 SEPARATE Node.js processes with 50K operations each"
echo "Each process gets its own V8 isolate and event loop"
echo ""

cd src/__tests__

# Clean up
rm -rf /tmp/bassline-parallel-test
mkdir -p /tmp/bassline-parallel-test

# Start timer
start_time=$(date +%s%N)

# Store PIDs to wait for them
pids=()

# Spawn 8 SEPARATE Node.js processes
for i in {1..8}; do
  # Each 'node' command creates a new OS process with its own V8 runtime
  node worker.cjs "proc$i" 50000 memory 2>&1 | grep "proc$i" &
  pids+=($!)
done

# Wait for all processes to complete
for pid in ${pids[@]}; do
  wait $pid
done

# End timer
end_time=$(date +%s%N)
duration=$((($end_time - $start_time) / 1000000))

echo ""
echo "=== Summary ==="
echo "Total operations: 400,000 (50K × 8)"
echo "Wall clock time: ${duration}ms"

if [ "$duration" -gt 0 ]; then
  aggregate_ops=$((400000 * 1000 / duration))
  echo "Aggregate throughput: ${aggregate_ops} ops/sec"
  
  # Format with millions
  if [ "$aggregate_ops" -gt 1000000 ]; then
    millions=$(echo "scale=2; $aggregate_ops / 1000000" | bc)
    echo "                     ${millions}M ops/sec"
  fi
fi