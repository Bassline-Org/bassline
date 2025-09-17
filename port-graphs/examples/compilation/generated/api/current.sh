#!/bin/bash
# Current state script for role: api

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/gadget.sh"

# Return current state
load_state