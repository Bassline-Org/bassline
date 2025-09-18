#!/usr/bin/env zsh

# Shell gadget client - connects to Rust gadget server
# Usage: ./gadget-shell.sh [gadget_name] [command] [data]

GADGET_SERVER="127.0.0.1"
GADGET_PORT="9999"

# Simple netcat-based gadget interaction
gadget_send() {
    local cmd="$1"
    echo "$cmd" | nc -w 1 $GADGET_SERVER $GADGET_PORT
}

# Counter gadget wrapper
counter() {
    local action="${1:-current}"

    case "$action" in
        inc|increment)
            gadget_send "counter receive increment"
            ;;
        dec|decrement)
            gadget_send "counter receive decrement"
            ;;
        reset)
            gadget_send "counter receive reset"
            ;;
        current|get)
            gadget_send "counter current"
            ;;
        *)
            echo "Usage: counter [inc|dec|reset|current]"
            return 1
            ;;
    esac
}

# MaxCell gadget wrapper
maxcell() {
    local action="${1:-current}"

    case "$action" in
        set)
            local value="${2}"
            if [[ -z "$value" ]]; then
                echo "Usage: maxcell set VALUE"
                return 1
            fi
            gadget_send "maxcell receive $value"
            ;;
        current|get)
            gadget_send "maxcell current"
            ;;
        *)
            echo "Usage: maxcell [set VALUE|current]"
            return 1
            ;;
    esac
}

# List all available gadgets
list_gadgets() {
    gadget_send "gadgets list"
}

# Create a custom gadget chain in shell
# This demonstrates composing gadgets
gadget_pipeline() {
    local input="$1"

    # Send to counter
    echo "Incrementing counter..."
    counter inc

    # Get counter value and use as maxcell input
    local count=$(counter get)
    echo "Counter is at: $count"

    # Update maxcell if counter is higher
    echo "Updating maxcell with counter value..."
    maxcell set "$count"

    echo "MaxCell value: $(maxcell get)"
}

# Interactive gadget REPL
gadget_repl() {
    echo "Gadget Shell REPL"
    echo "Commands: counter [inc|dec|reset|current], maxcell [set N|current], list, pipeline, quit"
    echo ""

    while true; do
        print -n "gadget> "
        read -r cmd args

        case "$cmd" in
            counter)
                counter $args
                ;;
            maxcell)
                maxcell $args
                ;;
            list)
                list_gadgets
                ;;
            pipeline)
                gadget_pipeline
                ;;
            quit|exit)
                echo "Goodbye!"
                break
                ;;
            "")
                continue
                ;;
            *)
                echo "Unknown command: $cmd"
                ;;
        esac
    done
}

# Main entry point
main() {
    if [[ $# -eq 0 ]]; then
        # Start REPL if no arguments
        gadget_repl
    elif [[ "$1" == "repl" ]]; then
        gadget_repl
    elif [[ "$1" == "counter" ]]; then
        shift
        counter "$@"
    elif [[ "$1" == "maxcell" ]]; then
        shift
        maxcell "$@"
    elif [[ "$1" == "list" ]]; then
        list_gadgets
    elif [[ "$1" == "pipeline" ]]; then
        gadget_pipeline
    else
        # Direct command to server
        gadget_send "$*"
    fi
}

main "$@"