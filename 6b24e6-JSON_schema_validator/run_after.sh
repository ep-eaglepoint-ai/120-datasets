#!/bin/sh

set -e

echo "=== Running Tests on AFTER (Fixed) Version ==="
echo ""

cd tests
node test_all.js after

echo ""
echo "✅ After version test completed!"

