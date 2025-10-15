#!/bin/bash

set -e

# The files that, when changed, trigger an install.
LOCK_FILES="package.json package-lock.json"

# The file into which the latest install hash is stored.
HASH_FILE="node_modules/.deps-lock_hash"

# The file that marks the node version that was used for the latest install.
NODE_MARKER_FILE="node_modules/.deps-node_$(node -v)"

# Compute the hash of the current and latest dependencies.
current_hash="$(cat $LOCK_FILES 2>/dev/null | sha256sum | awk '{print $1}')"
stored_hash="$(cat "$HASH_FILE" 2>/dev/null || true)"

if [[ ! -d node_modules || "$current_hash" != "$stored_hash" || ! -f "$NODE_MARKER_FILE" ]]; then
  # Reinstall if the lock files or node version changed, or if there simply is no `node_modules` directory.
  echo "Dependencies out of date -> running install"
  npm ci
  printf "%s" "$current_hash" > "$HASH_FILE"
  : > "$NODE_MARKER_FILE"
else
  echo "Dependencies up of date -> skipping install"
fi
