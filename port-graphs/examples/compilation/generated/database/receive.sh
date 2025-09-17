#!/bin/bash
# Receive script for role: database

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gadget.sh"

MESSAGE="$1"
MESSAGE_TYPE="$2"

# Load current state
CURRENT_STATE=$(load_state)

# Handle different message types based on role capabilities
case "$MESSAGE_TYPE" in
    "store")
        # Handle store messages
        echo "Processing $MESSAGE_TYPE: $MESSAGE"
        # Update state based on capability
        NEW_STATE=$(echo "$CURRENT_STATE" | jq '. + {"last_'store'": "'$MESSAGE'", "timestamp": "'$(date -Iseconds)'"}')
        save_state "$NEW_STATE"
        ;;
    "retrieve")
        # Handle retrieve messages
        echo "Processing $MESSAGE_TYPE: $MESSAGE"
        # Update state based on capability
        NEW_STATE=$(echo "$CURRENT_STATE" | jq '. + {"last_'retrieve'": "'$MESSAGE'", "timestamp": "'$(date -Iseconds)'"}')
        save_state "$NEW_STATE"
        ;;
    *)
        echo "Unknown message type: $MESSAGE_TYPE"
        exit 1
        ;;
esac

# Emit response if needed
if [ ! -z "$NEW_STATE" ]; then
    echo "$NEW_STATE" | ./emit
fi