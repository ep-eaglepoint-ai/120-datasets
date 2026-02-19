import requests
import unittest
import uuid
import concurrent.futures
import time
import statistics

import os

BASE_URL = os.getenv("BASE_URL", "http://127.0.0.1:8080/books")

class UltimateTestBookstore(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Ensure server is running
        try:
            requests.get(BASE_URL, timeout=5)
        except Exception:
            raise unittest.SkipTest("Server not running. Start it with 'cargo run' in the backend directory.")

    def _assert_error(self, response, expected_status, expected_error_type):
        self.assertEqual(response.status_code, expected_status, f"Expected status {expected_status}, got {response.status_code}. Body: {response.text}")
        try:
            data = response.json()
        except Exception as e:
            print(f"Failed to decode JSON. Status: {response.status_code}, Body: {response.text}")
            raise e
        self.assertIn("error", data)
        self.assertIn("message", data)
        self.assertEqual(data["error"], expected_error_type, f"Expected error type {expected_error_type}, got {data['error']}")
        return data

    # 1. READ ALL (Empty vs Populated) & Status Codes
    def test_01_read_all_semantics(self):
        # Initial check (might be empty or have leftovers from previous runs)
        r = requests.get(BASE_URL)
        self.assertEqual(r.status_code, 200)
        self.assertIsInstance(r.json(), list)

    # 2. CREATE & Validation & ResponseError Structure
    def test_02_create_and_validation(self):
        payload = {"title": "The Rust Book", "author": "Steve", "price": 40.0, "stock": 10}
        r = requests.post(BASE_URL, json=payload)
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertIn("id", data)
        UltimateTestBookstore.book_id = data["id"]

        # Exhaustive Validation & ResponseError Compliance
        cases = [
            ({"title": "", "author": "A", "price": 10, "stock": 1}, 400, "ValidationError"),
            ({"title": "T", "author": "", "price": 10, "stock": 1}, 400, "ValidationError"),
            ({"title": "T", "author": "A", "price": 0, "stock": 1}, 400, "ValidationError"),
            ({"title": "T", "author": "A", "price": -1, "stock": 1}, 400, "ValidationError"),
            ({"title": "T", "author": "A", "price": 10, "stock": -1}, 400, "ValidationError"),
        ]
        for p, status, err_type in cases:
            r = requests.post(BASE_URL, json=p)
            self._assert_error(r, status, err_type)

    # 3. READ ONE & 404 Semantics
    def test_03_read_one_and_404(self):
        bid = self.book_id
        r = requests.get(f"{BASE_URL}/{bid}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["id"], bid)

        # 404 Check
        bad_uid = str(uuid.uuid4())
        self._assert_error(requests.get(f"{BASE_URL}/{bad_uid}"), 404, "NotFound")
        self._assert_error(requests.patch(f"{BASE_URL}/{bad_uid}", json={"price": 1}), 404, "NotFound")
        self._assert_error(requests.delete(f"{BASE_URL}/{bad_uid}"), 404, "NotFound")

    # 4. PATCH Immutability & Status Codes
    def test_04_patch_immutability_rigorous(self):
        bid = self.book_id
        
        # Valid update
        r = requests.patch(f"{BASE_URL}/{bid}", json={"price": 35.0, "stock": 5})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["price"], 35.0)

        # Rejection of Title
        r_title = requests.patch(f"{BASE_URL}/{bid}", json={"title": "New Title"})
        self._assert_error(r_title, 400, "ImmutableUpdate")

        # Rejection of ID
        r_id = requests.patch(f"{BASE_URL}/{bid}", json={"id": str(uuid.uuid4())})
        self._assert_error(r_id, 400, "ImmutableUpdate")

        # Mixed valid + invalid (Atomic Rejection)
        r_mixed = requests.patch(f"{BASE_URL}/{bid}", json={"stock": 999, "title": "Cheat"})
        self._assert_error(r_mixed, 400, "ImmutableUpdate")
        
        # Verify state was not changed
        check = requests.get(f"{BASE_URL}/{bid}").json()
        self.assertEqual(check["stock"], 5)

    # 5. DELETE Semantics
    def test_05_delete_semantics(self):
        temp = requests.post(BASE_URL, json={"title": "D", "author": "A", "price": 1, "stock": 1}).json()
        tid = temp["id"]
        
        # Success
        self.assertEqual(requests.delete(f"{BASE_URL}/{tid}").status_code, 204)
        # Verify gone
        self.assertEqual(requests.get(f"{BASE_URL}/{tid}").status_code, 404)
        # Double delete
        self._assert_error(requests.delete(f"{BASE_URL}/{tid}"), 404, "NotFound")

    # 6. FAIL -> PASS proof (Duplicate Titles)
    def test_06_duplicate_title_collision(self):
        payload = {"title": "Duplicate", "author": "A", "price": 10, "stock": 1}
        b1 = requests.post(BASE_URL, json=payload).json()
        b2 = requests.post(BASE_URL, json=payload).json()
        
        self.assertNotEqual(b1["id"], b2["id"])
        
        requests.patch(f"{BASE_URL}/{b1['id']}", json={"price": 99.0})
        check2 = requests.get(f"{BASE_URL}/{b2['id']}").json()
        self.assertEqual(check2["price"], 10.0, "Data collision detected: update to one book affected another with same title!")

    # 7. Performance: Single Op (<5ms Logic) & O(1) Random Access
    def test_07_performance_single_and_o1(self):
        latencies = []
        for _ in range(50):
            start = time.perf_counter()
            requests.get(f"{BASE_URL}/{self.book_id}")
            latencies.append((time.perf_counter() - start) * 1000)
        
        avg_ms = statistics.mean(latencies)
        print(f"\nAvg logic+network latency: {avg_ms:.2f}ms")
        self.assertLess(avg_ms, 15, "Performance threshold exceeded")

    # 8. Aggressive Concurrency (100 concurrent requests)
    def test_08_aggressive_concurrency(self):
        def task(i):
            if i % 3 == 0:
                return requests.post(BASE_URL, json={"title": f"C{i}", "author": "A", "price": 1, "stock": 1}).status_code
            elif i % 3 == 1:
                return requests.get(BASE_URL).status_code
            else:
                return requests.get(f"{BASE_URL}/{self.book_id}").status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            status_codes = list(executor.map(task, range(100)))
        
        self.assertTrue(all(s in [200, 201] for s in status_codes))
        print("Aggressive Concurrency (100 requests): OK")

    # 9. 10,000 Book List Performance (< 100ms)
    def test_09_10k_list_performance(self):
        print("\nChecking/Populating 10,000 books...")
        current_count = len(requests.get(BASE_URL).json())
        needed = 10000 - current_count
        
        if needed > 0:
            def bulk(start_idx):
                for i in range(start_idx, start_idx + 500):
                    requests.post(BASE_URL, json={"title": f"B{i}", "author": "A", "price": 1, "stock": 1})
            
            with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
                executor.map(bulk, range(0, needed, 500))
        
        durations = []
        for _ in range(5):
            start = time.perf_counter()
            r = requests.get(BASE_URL)
            durations.append((time.perf_counter() - start) * 1000)
            self.assertEqual(r.status_code, 200)
            self.assertGreaterEqual(len(r.json()), 10000)
            
        avg_10k = statistics.mean(durations)
        print(f"READ ALL 10,000 items latency: {avg_10k:.2f}ms")
        self.assertLess(avg_10k, 100)

if __name__ == "__main__":
    unittest.main()
