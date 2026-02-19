import unittest
import ast
import os

class MetaTestCase(unittest.TestCase):
    def get_test_methods(self, path):
        """Parse a python file and return a set of test method names."""
        if not os.path.exists(path):
            return set()
            
        with open(path, 'r', encoding='utf-8') as f:
            tree = ast.parse(f.read())
            
        test_methods = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                for item in node.body:
                    if isinstance(item, ast.FunctionDef) and item.name.startswith('test_'):
                        test_methods.add(item.name)
        return test_methods

    def test_test_coverage_parity(self):
        """Verify that the new test suite covers the same scenarios as the old one."""
        before_tests = self.get_test_methods('repository_before/tests/test_webhook.py')
        after_tests = self.get_test_methods('repository_after/tests/test_webhook.py')
        
        print(f"\nTests found in repository_before: {sorted(list(before_tests))}")
        print(f"Tests found in repository_after:  {sorted(list(after_tests))}")

        # We expect at least the same tests to verify functionality is preserved
        missing_tests = before_tests - after_tests
        
        # Allow for some renaming if it makes sense, but for this strict refactor 
        # where we want to "preserve all existing functionality", checking for same test names
        # is a good heuristic for ensuring we didn't drop a test case.
        # If names changed, we might need a mapping, but let's assume strict parity for now.
        
        if missing_tests:
            self.fail(f"The following test cases from the original suite are missing in the refactored suite: {missing_tests}")
        
        # Also check that we haven't added unnecessary tests if the requirement was "New tests should not be added unless strictly required"
        extra_tests = after_tests - before_tests
        # This is just a warning or info, not necessarily a failure unless strict.
        # The user said "New tests should not be added unless strictly required".
        # So it's good to know.
        if extra_tests:
            print(f"Note: New tests found in refactored suite: {extra_tests}")
        else:
            print("No extra tests added.")

if __name__ == '__main__':
    unittest.main(verbosity=2)
