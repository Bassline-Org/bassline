#!/bin/bash
# Current state script for role: coordinator

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gadget.sh"

# Return current state
load_state