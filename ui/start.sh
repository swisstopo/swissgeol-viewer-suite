#!/bin/bash

set -e

# Install latest dependencies.
scripts/install-dependencies.sh

# Remove previous build output.
rm -rf dist/*

# Start the development server.
npm run start
