# Trajectory (Thinking Process)
@bd_datasets_002/ab6da3-java-contact-list/

## 🧭 Step 1: Codebase Audit (Before vs After)

### 1.1 Original Code Review (BEFORE)

**Primary implementation:** `repository_before/Contacts.java`

**Observed behavior / issues:**
- **Runtime exception risk (null dereferences)**:
  - `TrieNode root = null;` in `main()` causes `addWord(root, ...)` / `findWord(root, ...)` to dereference `null`.
  - `TrieNode.children` is set to `null` in `TrieNode` constructor, so `current.getChildren().get(c)` dereferences `null`.
- **Broken input parsing / loop control**:
  - Reads `n` with `in.nextInt()` but then consumes commands using `nextLine()` twice per iteration and loops `for (int i = 0; i <= n; i++)` (off-by-one).
- **Incorrect command comparison**:
  - Uses `if (op == "add")` (reference comparison) instead of content equality.
- **Trie never becomes traversable**:
  - When a missing node is created (`next = new TrieNode(c);`), it is not inserted into the parent map, so inserts do not build a reachable trie.
- **Incorrect `find` results**:
  - `findWord()` returns `current.getN()` but `n` is never incremented during insertion.

**Problem metadata note (observable):**
- `instances/instance.json` contains `instance_id` set to `"a2b5c8-Cart_Service_Performance_Fix"`, which does not match the folder name `ab6da3-java-contact-list`.

### 1.2 Updated Code Review (AFTER)

**Primary implementation:** `repository_after/Contacts.java`

**Implemented fixes (file + logic mapping):**
- **Initialize the trie root** (`repository_after/Contacts.java: main`):
  - `TrieNode root = new TrieNode();` prevents null root dereferences.
- **Ensure every node has an initialized `children` map** (`repository_after/Contacts.java: TrieNode`):
  - `private final HashMap<Character, TrieNode> children = new HashMap<>();` removes the `children == null` failure mode.
- **Correct input parsing and command loop** (`repository_after/Contacts.java: main`):
  - Loops exactly `n` operations: `for (int i = 0; i < n; i++)`.
  - Reads exactly two tokens per command: `op = in.next()` and `contact = in.next()`.
- **Correct string comparisons for dispatch** (`repository_after/Contacts.java: main`):
  - Uses `"add".equals(op)` and `"find".equals(op)`.
- **Correct trie construction + prefix counting** (`repository_after/Contacts.java: addWord`):
  - Links newly created child nodes via `current.children.put(c, next)`.
  - Introduces `prefixCount` and increments it on every node along the insertion path, including root.
- **Correct `find` semantics** (`repository_after/Contacts.java: findWord`):
  - Returns `0` on first missing edge; otherwise returns `current.prefixCount` for the prefix node.

---

## 🧾 Step 2: Define the Contract (Correctness & Constraints)

The correctness contract is enforced by `tests/RunTests.java`:

- **Input format**:
  - First token: integer `n`
  - Then `n` commands, each as two tokens: `add <word>` or `find <prefix>`
  - Commands may be newline-separated or fully tokenized (space-separated), and must still parse correctly.
- **Output format**:
  - For each `find <prefix>`, print exactly one line containing an integer.
- **Correctness definition**:
  - `find <prefix>` returns the number of previously added words that start with `<prefix>`.
  - Repeated `add` operations increase counts accordingly.
  - Missing prefixes return `0`.
- **Constraints**:
  - `add` and `find` perform work proportional to the length of the word/prefix \(O(L)\) via trie traversal (no scanning of all stored contacts).
- **Explicit exclusions (not implemented)**:
  - No delete operation.
  - No persistence; in-memory only.

---

## 🧠 Step 3: Design & Implementation Rationale

**Design choice:** trie with a per-node `prefixCount`.

**Why it satisfies the contract:**
- Each node corresponds to a prefix; `prefixCount` equals “number of inserted words that share this prefix”.
- Insert increments counts along the path; find traverses the prefix and returns the terminal node’s count (or `0` if missing).

**Structure / maintainability improvements:**
- `TrieNode` is a `private static final` nested class in `Contacts` (`repository_after/Contacts.java`), keeping state and invariants close to the algorithm.
- Parsing is token-based with `Scanner.next()`, matching the test suite’s supported input shapes.

---

## 🧪 Step 4: Testing Review

**Tests:** `tests/RunTests.java`

- **Compilation**: uses `javac` to compile `Contacts.java` into a temporary classes directory.
- **Execution**: runs `java -cp <classes> Contacts` with controlled stdin and checks exact stdout.
- **Cases**:
  - **`hackerrank_sample`**: validates basic add/find behavior.
  - **`repeated_inserts_and_prefix_counts`**: validates repeated adds and correct prefix propagation.
  - **`tokenized_input_format`**: validates tokenized input parsing independent of newlines.

**Evaluation:** `evaluation/Evaluation.java`
- Runs `RunTests.runForRepo(...)` against `repository_before` (expected fail) and `repository_after` (expected pass).
- Writes reports under `evaluation/reports/` (mounted by `docker-compose.yml` and ignored by `.gitignore`).

---

## 📈 Step 5: Result & Measurable Improvements

- ✅ **Correctness**: prefix counts are correct for sample input, repeated inserts, missing prefixes, and tokenized input.
- ✅ **Runtime stability**: removes null dereference paths by initializing root and children maps.
- ✅ **Data structure integrity**: inserts actually link nodes into the trie.
- ✅ **Deterministic verification**: tests compile and run the program end-to-end and assert exact stdout.
- ✅ **Measurable gate**: `evaluation/Evaluation.java` encodes “before fails / after passes” and emits structured reports (ignored by git).

---

## 🔗 Step 6: Reference Links (ONLY if Valid)

- Java `String.equals(Object)` specification: `https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/lang/String.html#equals(java.lang.Object)`
