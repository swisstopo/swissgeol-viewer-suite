#!/bin/bash

# Install latest dependencies.
npm ci --no-audit

# Remove previous build output.
rm -r dist/*

rm -r /app/ui/node_modules/@swissgeol
cp -r /app/ui/node_modules_bkp/@swissgeol /app/ui/node_modules/@swissgeol

# Start the development server.
npm run start
