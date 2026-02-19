# Trajectory (Thinking Process for Refactoring)

## 1. Audit the Original Code (Identify Scaling & correctness Problems)
I audited the proposed/original architecture (as described in the problem statement). It relied on a `Vec<Book>` for storage, which implies **O(n)** linear scans for every lookup. It used `title` as the primary identifier, meaning books could not be renamed and identical titles would cause collisions. Input validation was nonexistent, allowing negative prices or empty authors.

*   Learn about `Vec` vs `HashMap` performance: [Rust std::collections Performance](https://doc.rust-lang.org/std/collections/index.html#performance)
*   Understanding Time Complexity: [Big O Notation](https://en.wikipedia.org/wiki/Big_O_notation)

## 2. Define a Performance & Safety Contract First
I defined the requirements before writing code:
*   **Storage**: Must use `HashMap<Uuid, Book>` for **O(1)** access.
*   **Concurrency**: Must use `Arc<Mutex<...>>` for thread safety.
*   **Validation**: All inputs must be validated (Price > 0, Stock >= 0).
*   **Errors**: Must use typed, structured JSON errors, not plain strings.

## 3. Rework the Data Model for Efficiency
I shifted the core identity of a `Book` from its `title` to a `Uuid`. This decouples the "identity" of the data from its "content", adhering to database normalization principles even in memory.

*   Rust `uuid` crate: [uuid documentation](https://docs.rs/uuid/latest/uuid/)
*   Database Normalization Basics: [Database Normalization](https://en.wikipedia.org/wiki/Database_normalization)

## 4. Rebuild the API as a CRUD Pipeline
I established a standard CRUD pipeline using Actix Web. Instead of ad-hoc endpoint logic, I defined a clear mapping:
*   `POST` -> Create (with ID generation)
*   `GET` -> Read (Collection or Single)
*   `PATCH` -> Update (Partial, Idempotent-ish)
*   `DELETE` -> Remove

## 5. Move Validation to the Domain (Server-Side)
I moved validation logic out of the handler body and into declarative structures using the `validator` crate. This ensures that invalid data is rejected *before* it typically even reaches the lock acquisition stage, protecting the shared state from pollution.

*   Rust `validator` crate: [validator documentation](https://docs.rs/validator/latest/validator/)

## 6. Use UUIDs Instead of Mutable Keys
By switching to UUIDs, we avoid the "Mutable Key" problem. If we used `title` as a key, updating a title would require removing the old key and inserting a new one, breaking references. UUIDs provide substantial identity stability.

## 7. Thread-Safe Concurrency
I implemented `Arc<Mutex<HashMap...>>`. This ensures that multiple requests can access the store concurrently without data races.
*   `Arc`: Atomic Reference Counted smart pointer.
*   `Mutex`: Mutual Exclusion primitive.

*   Rust Concurrency: [Shared State Concurrency](https://doc.rust-lang.org/book/ch16-03-shared-state.html)

## 8. Eliminate O(n) Scans for Lookups
I eliminated existing or potential linear scans. Instead of `vec.iter().find(|b| b.id == id)`, we use `map.get(&id)`. This prevents the service from degrading as the dataset grows to 10,000+ items.

## 9. Standardize Error Handling
I implemented `ResponseError` for a custom `BookError` enum. This maps internal failure states (NotFound, Validation) to standard HTTP 404/400 codes automatically, ensuring the API behaves predictably for clients.

*   Actix Web Errors: [Error Handling](https://actix.rs/docs/errors/)

## 10. Result: Measurable Performance & Correctness
The solution now provides:
*   **O(1)** Lookups.
*   Safe concurrent mutations.
*   Impossible-to-represent invalid states (mostly).
*   Correct HTTP semantics.

---

## Trajectory Transferability Notes

The above trajectory is designed for **Refactoring Legacy State**.

The nodes can be reused:
*   **Audit** -> Analyze current bottlenecks.
*   **Contract** -> Define the "To-Be" state strictness.
*   **Data Model** -> Optimize the storage layout (SQL or Memory).
*   **Validation** -> Shift checks left (earlier in the pipeline).
*   **Verification** -> Assert the contract is met.
