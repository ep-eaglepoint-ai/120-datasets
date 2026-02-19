#!/bin/sh

set -e

echo "=== Running Tests on BEFORE (Buggy) Version ==="
echo ""

cd tests
node test_all.js before

echo ""
echo "✅ Before version test completed!"

