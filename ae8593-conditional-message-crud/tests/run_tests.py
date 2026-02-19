#!/usr/bin/env python
import subprocess
import re

def main():
    result = subprocess.run(['python', '-m', 'pytest', '-q', '--tb=no', 'tests/'], capture_output=True, text=True)
    output = result.stdout + result.stderr
    matches = re.findall(r'(\d+)\s+passed', output)
    if matches:
        passed = int(matches[-1])
        print(f"{passed} tests passed")
    else:
        print("Could not parse test results")
        print(output)

if __name__ == '__main__':
    main()