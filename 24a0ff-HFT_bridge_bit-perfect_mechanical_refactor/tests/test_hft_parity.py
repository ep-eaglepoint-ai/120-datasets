import os
import sys
import unittest
import importlib.util
import math
import inspect
import subprocess

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH_BEFORE = os.path.join(BASE_DIR, "repository_before", "hft_parity_refactor.py")
PATH_AFTER = os.path.join(BASE_DIR, "repository_after", "hft_parity_refactor.py")

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

class TestHFTParity(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Load both versions
        cls.before = load_module("hft_before", PATH_BEFORE)
        cls.after = load_module("hft_after", PATH_AFTER)

    def test_api_integrity(self):
        """1. Preserve all existing function signatures and parameter names."""
        funcs = ["validate_and_log", "calculate_tier_bonus", "process_transaction_chain"]
        for name in funcs:
            with self.subTest(function=name):
                f_before = getattr(self.before, name)
                f_after = getattr(self.after, name)
                
                # Check signature
                sig_before = inspect.signature(f_before)
                sig_after = inspect.signature(f_after)
                self.assertEqual(sig_before, sig_after, f"Signature mismatch for {name}")
                
                # Check docstrings byte-for-byte
                self.assertEqual(f_before.__doc__, f_after.__doc__, f"Docstring mismatch for {name}")

    def test_global_state_existence(self):
        """9. Keep SYSTEM_STATE and LOG_BUFFER as global variables."""
        self.assertTrue(hasattr(self.after, "SYSTEM_STATE"))
        self.assertTrue(hasattr(self.after, "LOG_BUFFER"))
        self.assertIsInstance(self.after.SYSTEM_STATE, dict)
        self.assertIsInstance(self.after.LOG_BUFFER, list)

    def test_behavioral_parity(self):
        """4, 5, 6, 7. Verify logic, rounding, prime-check, and state updates."""
        test_data = [
            "TXN_A:100.5",
            "sys_b:200.7",
            "usr_c:300.2",
            "TXN_D:400.9999999", # Threshold rounding test
            "SYS_E:500.0"
        ]

        # Fresh state for both
        self.before.SYSTEM_STATE = {"auth_hits": 0, "last_checksum": 0}
        self.before.LOG_BUFFER.clear()
        self.after.SYSTEM_STATE = {"auth_hits": 0, "last_checksum": 0}
        self.after.LOG_BUFFER.clear()

        # Run both
        results_before = self.before.process_transaction_chain(test_data)
        results_after = self.after.process_transaction_chain(test_data)

        # Compare results
        self.assertEqual(results_before, results_after, "Batch results mismatch")
        
        # Compare global state
        self.assertEqual(self.before.SYSTEM_STATE, self.after.SYSTEM_STATE, "SYSTEM_STATE mismatch")
        self.assertEqual(self.before.LOG_BUFFER, self.after.LOG_BUFFER, "LOG_BUFFER mismatch")

    def test_mutable_default_session_tracking(self):
        """3. Retain the 'mutable default' session tracking."""

        self.before.LOG_BUFFER.clear()
        self.after.LOG_BUFFER.clear()
        
        # Call both 3 times
        for i in range(3):
            self.before.validate_and_log(f"user_{i}", 100 * i)
            self.after.validate_and_log(f"user_{i}", 100 * i)
            
        # The logs must be identical, proving they both persist at the same rate
        self.assertEqual(self.before.LOG_BUFFER, self.after.LOG_BUFFER, "Session tracking parity mismatch")
        
        # Verify that session count is actually increasing (not always 1)
        count_0 = int(self.after.LOG_BUFFER[0].split("SESS:")[1])
        count_1 = int(self.after.LOG_BUFFER[1].split("SESS:")[1])
        self.assertEqual(count_1, count_0 + 1, "Session count did not increment")

    def test_redundancy_reduction_compliance(self):
        """2. Consolidate parsing logic and remove code duplication."""

        
        def check_compliance(module):
            source = inspect.getsource(module.process_transaction_chain)
            # Must have a mapping for multipliers
            has_map = "TIER_MAP" in source or "{" in source and ":" in source and "1.15" in source
            # Must NOT have the repetitive if/elif chain
            has_chain = "elif uid.startswith" in source or "elif" in source and "SYS" in source
            # Must have a consolidated parsing helper/lambda
            has_helper = "parse =" in source or "lambda" in source and ".upper().strip()" in source
            
            return has_map and not has_chain and has_helper

        # The 'after' version MUST be compliant
        self.assertTrue(check_compliance(self.after), "The refactored code (after) is not compliant with redundancy reduction requirements")
        
        # The 'before' version MUST NOT be compliant (this confirms it would 'fail' the fix requirement)
        self.assertFalse(check_compliance(self.before), "The original code (before) incorrectly passes the compliance check")

    def test_line_count(self):
        """Line Count: Final output must not exceed original lines by more than 3."""
        with open(PATH_BEFORE, 'r') as f:
            lines_before = len(f.readlines())
        with open(PATH_AFTER, 'r') as f:
            lines_after = len(f.readlines())
        
        self.assertLessEqual(lines_after, lines_before + 3, f"Line count too high: {lines_after} > {lines_before + 3}")

if __name__ == "__main__":
    unittest.main()
