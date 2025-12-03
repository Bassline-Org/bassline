#!/bin/bash
#
# BL/T Protocol Client - Pure Bash
#
# A simple BL/T client using netcat.
# Zero dependencies beyond bash and nc.
#
# Usage:
#   ./client.sh                    # Interactive mode
#   ./client.sh read counter       # Read bl:///cell/counter
#   ./client.sh write counter 42   # Write 42 to bl:///cell/counter
#   ./client.sh fold sum a,b,c     # Read sum fold over cells a, b, c

HOST="${BLT_HOST:-localhost}"
PORT="${BLT_PORT:-9000}"

# Send a single command and get response
blt_cmd() {
    printf '%s\n' "$1" | nc "$HOST" "$PORT" | head -1
}

# Read a cell value
blt_read() {
    local ref="$1"
    if [[ "$ref" != bl://* ]]; then
        ref="bl:///cell/$ref"
    fi
    local resp
    resp=$(blt_cmd "READ <$ref>")
    if [[ "$resp" == OK* ]]; then
        echo "${resp#OK }"
    else
        echo "$resp" >&2
        return 1
    fi
}

# Write a cell value
blt_write() {
    local ref="$1"
    local value="$2"
    if [[ "$ref" != bl://* ]]; then
        ref="bl:///cell/$ref"
    fi
    local resp
    resp=$(blt_cmd "WRITE <$ref> $value")
    if [[ "$resp" == OK* ]]; then
        echo "ok"
    else
        echo "$resp" >&2
        return 1
    fi
}

# Read a fold
blt_fold() {
    local type="$1"
    local sources="$2"
    # Convert comma-separated names to full refs
    local refs=""
    IFS=',' read -ra parts <<< "$sources"
    for part in "${parts[@]}"; do
        if [[ "$part" != bl://* ]]; then
            part="bl:///cell/$part"
        fi
        if [[ -n "$refs" ]]; then
            refs="$refs,$part"
        else
            refs="$part"
        fi
    done
    blt_read "bl:///fold/$type?sources=$refs"
}

# Get mirror info
blt_info() {
    local ref="$1"
    if [[ "$ref" != bl://* ]]; then
        ref="bl:///cell/$ref"
    fi
    local resp
    resp=$(blt_cmd "INFO <$ref>")
    if [[ "$resp" == OK* ]]; then
        echo "${resp#OK }"
    else
        echo "$resp" >&2
        return 1
    fi
}

# Interactive mode
interactive() {
    echo "BL/T Client - $HOST:$PORT"
    echo "Commands: read <ref>, write <ref> <value>, fold <type> <sources>, info <ref>, quit"
    echo ""

    while true; do
        read -r -p "> " cmd args
        case "$cmd" in
            read)
                blt_read "$args"
                ;;
            write)
                local ref value
                read -r ref value <<< "$args"
                blt_write "$ref" "$value"
                ;;
            fold)
                local type sources
                read -r type sources <<< "$args"
                blt_fold "$type" "$sources"
                ;;
            info)
                blt_info "$args"
                ;;
            quit|exit|q)
                exit 0
                ;;
            "")
                ;;
            *)
                echo "Unknown command: $cmd"
                ;;
        esac
    done
}

# Main
case "$1" in
    read)
        blt_read "$2"
        ;;
    write)
        blt_write "$2" "$3"
        ;;
    fold)
        blt_fold "$2" "$3"
        ;;
    info)
        blt_info "$2"
        ;;
    "")
        interactive
        ;;
    *)
        echo "Usage: $0 [read|write|fold|info] [args...]"
        echo ""
        echo "Commands:"
        echo "  read <ref>              Read a value"
        echo "  write <ref> <value>     Write a value"
        echo "  fold <type> <sources>   Read a fold (sum, max, min, avg)"
        echo "  info <ref>              Get mirror capabilities"
        echo ""
        echo "Environment:"
        echo "  BLT_HOST  Server host (default: localhost)"
        echo "  BLT_PORT  Server port (default: 9000)"
        echo ""
        echo "Examples:"
        echo "  $0 write counter 42"
        echo "  $0 read counter"
        echo "  $0 fold sum a,b,c"
        echo "  $0 info counter"
        exit 1
        ;;
esac
