#!/usr/bin/env zsh

# Integration script that demonstrates Rust, TypeScript, and Shell gadgets working together

echo "=== Gadget Integration Demo ==="
echo "Demonstrating Rust, TypeScript, and Shell gadgets interoperating via TCP"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Rust server is already running
check_server() {
    nc -z 127.0.0.1 9999 2>/dev/null
    return $?
}

# Start Rust server in background
start_server() {
    echo "${BLUE}[RUST]${NC} Building and starting gadget server..."

    # Build the Rust project
    (cd gadgets-rust && cargo build 2>/dev/null)

    # Start server in background
    (cd gadgets-rust && cargo run > /tmp/gadget-server.log 2>&1 &)
    SERVER_PID=$!

    # Wait for server to start
    sleep 2

    if check_server; then
        echo "${GREEN}✓${NC} Rust server started (PID: $SERVER_PID)"
    else
        echo "${RED}✗${NC} Failed to start server"
        exit 1
    fi
}

# Demo shell gadgets
demo_shell() {
    echo ""
    echo "${YELLOW}[SHELL]${NC} Demonstrating shell gadget operations..."

    # Use the shell script
    ./gadgets-rust/gadget-shell.sh counter reset
    echo "  Reset counter: $(./gadgets-rust/gadget-shell.sh counter get)"

    ./gadgets-rust/gadget-shell.sh counter inc
    echo "  Increment: $(./gadgets-rust/gadget-shell.sh counter get)"

    ./gadgets-rust/gadget-shell.sh counter inc
    echo "  Increment: $(./gadgets-rust/gadget-shell.sh counter get)"

    local count=$(./gadgets-rust/gadget-shell.sh counter get)
    ./gadgets-rust/gadget-shell.sh maxcell set $count
    echo "  Set maxcell to counter value: $(./gadgets-rust/gadget-shell.sh maxcell get)"
}

# Demo TypeScript gadgets
demo_typescript() {
    echo ""
    echo "${BLUE}[TYPESCRIPT]${NC} Running TypeScript gadget demo..."

    # Run the TypeScript demo
    npx tsx gadgets-rust/gadget-client.ts demo
}

# Demo cross-language pipeline
demo_pipeline() {
    echo ""
    echo "${GREEN}[INTEGRATION]${NC} Cross-language gadget pipeline..."
    echo ""

    # Shell increments counter
    echo "1. Shell increments counter 5 times:"
    for i in {1..5}; do
        ./gadgets-rust/gadget-shell.sh counter inc > /dev/null
    done
    local shell_count=$(./gadgets-rust/gadget-shell.sh counter get)
    echo "   Counter (via shell): $shell_count"

    # TypeScript reads counter and doubles it
    echo ""
    echo "2. TypeScript reads counter and updates maxcell with doubled value:"
    npx tsx -e "
        import * as net from 'net';

        async function sendCommand(cmd) {
            return new Promise((resolve) => {
                const client = new net.Socket();
                client.connect(9999, '127.0.0.1', () => {
                    client.write(cmd + '\\n');
                });
                client.on('data', (data) => {
                    resolve(data.toString().trim());
                    client.destroy();
                });
            });
        }

        (async () => {
            const count = await sendCommand('counter current');
            console.log('   Counter value read by TypeScript:', count);
            const doubled = parseInt(count) * 2;
            console.log('   Doubled value:', doubled);
            const max = await sendCommand('maxcell receive ' + doubled);
            console.log('   MaxCell updated to:', max);
        })();
    " 2>/dev/null

    # Shell verifies the result
    echo ""
    echo "3. Shell verifies final state:"
    echo "   Counter: $(./gadgets-rust/gadget-shell.sh counter get)"
    echo "   MaxCell: $(./gadgets-rust/gadget-shell.sh maxcell get)"

    # Try to set maxcell to lower value (should stay the same)
    echo ""
    echo "4. Shell tries to set MaxCell to 1 (should stay at higher value):"
    ./gadgets-rust/gadget-shell.sh maxcell set 1 > /dev/null
    echo "   MaxCell: $(./gadgets-rust/gadget-shell.sh maxcell get)"
}

# Cleanup function
cleanup() {
    echo ""
    echo "Cleaning up..."
    if [[ -n "$SERVER_PID" ]]; then
        kill $SERVER_PID 2>/dev/null
        echo "Stopped Rust server"
    fi
    rm -f /tmp/gadget-server.log
}

# Set up trap for cleanup
trap cleanup EXIT INT TERM

# Main execution
main() {
    # Check if server is already running
    if check_server; then
        echo "${GREEN}✓${NC} Gadget server already running"
    else
        start_server
    fi

    # Run demos
    demo_shell
    demo_typescript
    demo_pipeline

    echo ""
    echo "${GREEN}=== Integration Demo Complete ===${NC}"
    echo ""
    echo "The demo showed:"
    echo "  • Rust gadgets running as a TCP server"
    echo "  • Shell scripts interacting with gadgets via netcat"
    echo "  • TypeScript clients using the same gadget network"
    echo "  • All three languages operating on shared gadget state"
    echo ""
    echo "Key insight: Gadgets are language-agnostic - the protocol is what matters!"
}

main "$@"