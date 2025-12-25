#!/bin/bash
# Code Buddy Snap Wrapper

# Set up environment
export HOME="${SNAP_USER_DATA}"
export NODE_ENV="${NODE_ENV:-production}"

# Run the application
exec "${SNAP}/bin/node" "${SNAP}/dist/index.js" "$@"
