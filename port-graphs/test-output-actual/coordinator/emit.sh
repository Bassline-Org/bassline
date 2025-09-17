#!/bin/bash
# Emit script for role: coordinator

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Read from stdin or use provided message
if [ -p /dev/stdin ]; then
    MESSAGE=$(cat)
else
    MESSAGE="$1"
fi

# Add metadata to message
METADATA='{
    "source": "'coordinator'",
    "type": "'coordinator'",
    "timestamp": "'$(date -Iseconds)'"
}'

# Combine message with metadata
FULL_MESSAGE=$(echo "$MESSAGE" | jq '. + '"$METADATA"')

# Emit to stdout (can be piped to other gadgets)
echo "$FULL_MESSAGE"

# Log to file if configured
LOG_FILE="$SCRIPT_DIR/../effects.log"
echo "$(date -Iseconds) [coordinator] $FULL_MESSAGE" >> "$LOG_FILE"