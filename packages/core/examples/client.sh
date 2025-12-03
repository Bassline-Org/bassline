#!/bin/bash
# Bassline HTTP Client - Bash
#
# Minimal client using only curl.
#
# Usage:
#   source client.sh
#   BL_BASE=http://localhost:8080 BL_TOKEN=secret
#   bl_read cell/counter
#   bl_write cell/counter 42

BL_BASE="${BL_BASE:-http://localhost:8080}"
BL_TOKEN="${BL_TOKEN:-}"

bl_read() {
    local path="$1"
    local auth_header=""
    [[ -n "$BL_TOKEN" ]] && auth_header="-H \"Authorization: Bearer $BL_TOKEN\""
    eval curl -s $auth_header "$BL_BASE/bl/$path"
}

bl_write() {
    local path="$1"
    local value="$2"
    local auth_header=""
    [[ -n "$BL_TOKEN" ]] && auth_header="-H \"Authorization: Bearer $BL_TOKEN\""
    eval curl -s -X PUT -d "'$value'" $auth_header "$BL_BASE/bl/$path"
}

# Demo if run directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    echo "Bassline Shell Client"
    echo "Base: $BL_BASE"
    echo

    echo "Writing counter = 42"
    bl_write cell/counter 42
    echo

    echo "Reading counter:"
    bl_read cell/counter
    echo

    echo "Writing name = alice"
    bl_write cell/name alice
    echo

    echo "Reading name:"
    bl_read cell/name
    echo
fi
