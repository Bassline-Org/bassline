#!/bin/bash
# Update state script for role: api

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gadget.sh"

NEW_STATE="$1"

if [ -z "$NEW_STATE" ]; then
    echo "Error: New state required"
    exit 1
fi

# Validate JSON
if ! echo "$NEW_STATE" | jq empty 2>/dev/null; then
    echo "Error: Invalid JSON state"
    exit 1
fi

# Save new state
save_state "$NEW_STATE"
echo "State updated successfully"