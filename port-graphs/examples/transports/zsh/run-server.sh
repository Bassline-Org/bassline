#!/bin/bash

# Run the zsh maxCell gadget as a TCP server using socat
# socat handles the TCP networking, zsh script handles the gadget logic

PORT=3002

echo "[launcher] Starting zsh MaxCell gadget on port $PORT"
echo "[launcher] Connect with: npm run zsh-client"
echo ""

# Check if socat is installed
if ! command -v socat &> /dev/null; then
    echo "Error: socat is required but not installed"
    echo "Install with: brew install socat"
    exit 1
fi

# Make the script executable
chmod +x maxcell.zsh

# Use socat to create TCP server that runs our zsh script for each connection
# TCP-LISTEN:3002 - listen on TCP port 3002
# EXEC:./maxcell.zsh - execute our script for each connection
# fork - handle multiple connections
# reuseaddr - allow rapid restart
socat TCP-LISTEN:$PORT,fork,reuseaddr EXEC:./maxcell.zsh