#!/bin/bash
# Wrapper script to run expo commands from the root directory
# This ensures that expo always runs from the mobile directory context

# Change to the project root (one level up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

# Check if we're in the mobile directory already
if [[ "$(basename "$PWD")" == "mobile" ]]; then
    # Already in mobile directory, run expo directly
    npx expo "$@"
else
    # In root directory, change to mobile and run expo
    cd mobile && npx expo "$@"
fi
