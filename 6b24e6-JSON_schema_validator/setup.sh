#!/bin/sh

set -e

echo "=== Schema Validator Task Setup ==="
echo ""

echo "Verifying Node.js version..."
node --version

echo ""
echo "No external dependencies required (pure Node.js)"
echo ""

echo "Verifying file structure..."

check_file() {
  if [ -f "$1" ]; then
    echo "  ✓ $1"
  else
    echo "  ✗ $1 (missing)"
    exit 1
  fi
}

check_file "repository_before/SchemaValidator.js"
check_file "repository_after/SchemaValidator.js"
check_file "tests/test_all.js"
check_file "evaluation/evaluation.js"
check_file "trajectory/trajectory.md"

echo ""
echo "✅ Setup complete!"

