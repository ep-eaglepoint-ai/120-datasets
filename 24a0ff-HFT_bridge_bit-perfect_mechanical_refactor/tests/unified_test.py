import os
import sys
import unittest
import importlib.util
import inspect

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH_BEFORE = os.path.join(BASE_DIR, "repository_before", "hft_parity_refactor.py")
PATH_AFTER = os.path.join(BASE_DIR, "repository_after", "hft_parity_refactor.py")

TARGET = os.environ.get("TEST_TARGET", "after")

def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module

class UnifiedHFTTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Load the version under test
        target_path = PATH_AFTER if TARGET == "after" else PATH_BEFORE
        cls.target = load_module("hft_target", target_path)
        
        ref_path = PATH_BEFORE if TARGET == "after" else PATH_AFTER
        cls.ref = load_module("hft_reference", ref_path)

    def test_api_integrity(self):
        """1. API Integrity: Parameters and Docstrings must match the reference."""
        funcs = ["validate_and_log", "calculate_tier_bonus", "process_transaction_chain"]
        for name in funcs:
            t_func = getattr(self.target, name)
            r_func = getattr(self.ref, name)
            self.assertEqual(inspect.signature(t_func), inspect.signature(r_func), f"Signature mismatch: {name}")
            self.assertEqual(t_func.__doc__, r_func.__doc__, f"Docstring mismatch: {name}")

    def test_structural_compliance_and_fix(self):
        """2. Redundancy Reduction: Verify if logic is consolidated into TIER_MAP."""
        source = inspect.getsource(self.target.process_transaction_chain)
        
        has_map = "TIER_MAP" in source
        has_chain = "elif uid.startswith" in source
        has_lambda = "lambda" in source and ".upper().strip()" in source
        
        # This is where 'before' fails and 'after' passes
        reason = f"Testing {TARGET.upper()} environment: "
        self.assertTrue(has_map, reason + "Missing TIER_MAP consolidation")
        self.assertFalse(has_chain, reason + "Redundant if/elif chain detected")
        self.assertTrue(has_lambda, reason + "Missing consolidated parsing pattern")

    def test_behavioral_parity(self):
        """4, 5, 6, 7. Parity: Results must be bit-perfect with the reference."""
        data = ["TXN_A:100.5", "sys_b:200.7", "usr_c:300.2", "TXN_D:400.9999999"]
        
        for mod in [self.target, self.ref]:
            mod.SYSTEM_STATE = {"auth_hits": 0, "last_checksum": 0}
            mod.LOG_BUFFER.clear()
            
        res_t = self.target.process_transaction_chain(data)
        res_r = self.ref.process_transaction_chain(data)
        
        self.assertEqual(res_t, res_r, f"Output mismatch between {TARGET} and reference")
        self.assertEqual(self.target.SYSTEM_STATE, self.ref.SYSTEM_STATE, "Internal state mismatch")
        self.assertEqual(self.target.LOG_BUFFER, self.ref.LOG_BUFFER, "Log buffer mismatch")

    def test_legacy_bug_preservation(self):
        """3. Mutable Default: Verify 'load-bearing' bug is still there."""
        self.target.LOG_BUFFER.clear()
        self.target.validate_and_log("user_x", 123)
        self.target.validate_and_log("user_y", 456)
        
        # Verify it persisted (SESS should increment)
        count1 = int(self.target.LOG_BUFFER[0].split("SESS:")[1])
        count2 = int(self.target.LOG_BUFFER[1].split("SESS:")[1])
        self.assertEqual(count2, count1 + 1, "Mutable default bug (session tracking) was fixed/removed!")

    def test_negative_constraints(self):
        """Negative Constraints: No try/except or prime optimization."""
        source = inspect.getsource(self.target)
        self.assertNotIn("try:", source, "Unauthorized error handling (try/except) detected")
        self.assertIn("range(2, int(SYSTEM_STATE[\"auth_hits\"]**0.5) + 1)", source, "Prime check was optimized (unauthorized)")

    def test_line_count(self):
        """Line Count: Final output must be within +3 of original."""
        with open(PATH_BEFORE, 'r') as f:
            lines_b = len(f.readlines())
        with open(PATH_AFTER, 'r') as f:
            lines_a = len(f.readlines())
        
        if TARGET == "after":
            self.assertLessEqual(lines_a, lines_b + 3, f"Refactored line count is too high: {lines_a}")

if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(UnifiedHFTTest)
    result = unittest.TextTestRunner(verbosity=0).run(suite)
    
    print("\n" + "="*40)
    print(f"UNIFIED TEST SUMMARY FOR: {TARGET.upper()}")
    print(f"Total Tests Run: {result.testsRun}")
    print(f"Total Passed: {result.testsRun - len(result.failures) - len(result.errors)}")
    print(f"Total Failed: {len(result.failures) + len(result.errors)}")
    print("="*40 + "\n")
    
    sys.exit(0 if result.wasSuccessful() else 1)
