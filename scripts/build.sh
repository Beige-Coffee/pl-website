#!/bin/bash
set -e
npm run build
cp dist/index.js dist/index.cjs
