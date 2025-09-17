#!/bin/bash
# Wiring script for relationship: worker -> database
# Protocol: tcp

FROM_GADGET="../worker"
TO_GADGET="../database"
PROTOCOL="tcp"

# Check if gadgets exist
if [ ! -d "$FROM_GADGET" ]; then
    echo "Error: Source gadget $FROM_GADGET not found"
    exit 1
fi

if [ ! -d "$TO_GADGET" ]; then
    echo "Error: Target gadget $TO_GADGET not found"
    exit 1
fi

# Set up the connection
echo "Connecting $FROM_GADGET to $TO_GADGET via $PROTOCOL"

# Create named pipe for communication if needed
PIPE_NAME="/tmp/worker_to_database_$PROTOCOL"
if [ ! -p "$PIPE_NAME" ]; then
    mkfifo "$PIPE_NAME"
fi

# Start monitoring loop
monitor_connection() {
    while true; do
        # Read from source gadget
        if [ -p "$FROM_GADGET/output" ]; then
            MESSAGE=$(cat "$FROM_GADGET/output")
            if [ ! -z "$MESSAGE" ]; then
                # Forward to target gadget
                echo "$MESSAGE" | "$TO_GADGET/receive" "$PROTOCOL"
            fi
        fi
        sleep 0.1
    done
}

case "$1" in
    "start")
        echo "Starting relationship monitoring..."
        monitor_connection &
        echo $! > "/tmp/wire_worker_database.pid"
        ;;
    "stop")
        if [ -f "/tmp/wire_worker_database.pid" ]; then
            kill $(cat "/tmp/wire_worker_database.pid")
            rm "/tmp/wire_worker_database.pid"
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop}"
        exit 1
        ;;
esac