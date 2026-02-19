#!/bin/sh

set -e

echo "=== Running Evaluation ==="
echo ""

node evaluation/evaluation.js

echo ""
echo "✅ Evaluation completed!"
