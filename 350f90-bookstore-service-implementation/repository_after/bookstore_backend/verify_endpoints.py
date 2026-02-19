import requests
import time

BASE_URL = "http://127.0.0.1:8080/books"

def test_crud():
    # 1. Create a book
    payload = {
        "title": "The Rust Programming Language",
        "author": "Steve Klabnik",
        "price": 42.0,
        "stock": 100
    }
    r = requests.post(BASE_URL, json=payload)
    assert r.status_code == 201
    book = r.json()
    book_id = book['id']
    assert book['title'] == payload['title']
    print(f"CREATED: {book_id}")

    # 2. Get all books
    r = requests.get(BASE_URL)
    assert r.status_code == 200
    assert len(r.json()) >= 1
    print("READ ALL: OK")

    # 3. Get single book
    r = requests.get(f"{BASE_URL}/{book_id}")
    assert r.status_code == 200
    assert r.json()['id'] == book_id
    print("READ ONE: OK")

    # 4. Partial Update (PATCH)
    update_payload = {
        "price": 39.99,
        "stock": 95
    }
    r = requests.patch(f"{BASE_URL}/{book_id}", json=update_payload)
    assert r.status_code == 200
    updated_book = r.json()
    assert updated_book['price'] == 39.99
    assert updated_book['stock'] == 95
    assert updated_book['title'] == payload['title'] # Should remain unchanged
    print("UPDATE (PATCH): OK")

    # 5. Invalid Update (Try to update title)
    bad_payload = {"title": "New Title"}
    r = requests.patch(f"{BASE_URL}/{book_id}", json=bad_payload)
    assert r.status_code == 400
    assert "Immutable" in r.json()['error']
    print("IMMUTABILITY CHECK: OK")

    # 6. Validation Check (Negative price)
    bad_payload = {"price": -10.0}
    r = requests.patch(f"{BASE_URL}/{book_id}", json=bad_payload)
    assert r.status_code == 400
    print("VALIDATION CHECK: OK")

    # 7. Delete book
    r = requests.delete(f"{BASE_URL}/{book_id}")
    assert r.status_code == 204
    print("DELETE: OK")

    # 8. Verify 404
    r = requests.get(f"{BASE_URL}/{book_id}")
    assert r.status_code == 404
    print("404 CHECK: OK")

if __name__ == "__main__":
    try:
        test_crud()
        print("\nALL INTEGRATION TESTS PASSED")
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
