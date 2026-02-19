# Hardened Zero-Knowledge Authentication Module

## 🐳 Quick Start (Docker)

If you prefer to run commands manually, use the following steps:

# run before tests (quick validation)

```bash
docker compose run --rm app npm run test:before
```

# run after tests (quick validation)

```bash

docker compose run --rm app npm run test:after

```

# Run evaluation script

```bash
docker compose run --rm app npm run evaluate
```

This project demonstrates the refactoring of a legacy, insecure authentication system into a **Hardened Zero-Knowledge Authentication Module**.

The goal is to transition from a vulnerable implementation (plain-text passwords, mutable arrays) to a secure architecture using the **Web Crypto API**, **Immutability**, and **Constant-Time comparisons**, while adhering to strict coding constraints.

## 🛡️ Security Features & Constraints

The **Secure Implementation** (`repository_after`) adheres to the following requirements:

1.  **Zero-Knowledge Proof:** Passwords are never stored. Instead, they are hashed using **SHA-256** (Web Crypto API) with unique **Salts**.
2.  **Immutability:** User records are frozen (`Object.freeze`) to prevent tampering.
3.  **Prototype Pollution Protection:** All objects are created using `Object.create(null)` to ensure they have no prototype.
4.  **Secure Storage:** The user collection is managed exclusively with a `Map`. Array literals (`[]`) and `new Array()` are forbidden.
5.  **Timing Attack Protection:** Authentication uses **Constant-Time Comparison** to prevent side-channel attacks.
6.  **Safe Logging:** Sensitive data (passwords, hashes) is never logged to the console.

---

## 📂 Project Structure

```text
.
├── repository_before/    # ❌ Legacy Insecure Implementation
│   └── index.js          # (Plain text passwords, Arrays, Sync)
├── repository_after/     # ✅ Secure Hardened Implementation
│   └── index.js          # (SHA-256, Maps, WebCrypto, Async)
├── tests/                # 🧪 Universal Test Suite
│   ├── test_shared.js    # Shared logic (Functionality + Security Checks)
│   ├── test_before.test.js
│   └── test_after.test.js
├── evaluation/           # 📊 Evaluation System
│   └── evaluation.js     # Script to compare Before vs After
├── docker-compose.yml    # Docker configuration
├── Dockerfile            # Container build instructions
└── package.json          # Dependencies and Scripts
```

---

## 🚀 Getting Started

This project is containerized using Docker to ensure a consistent environment.

### Prerequisites

- Docker & Docker Compose

### 1. Build the Environment

Build the Docker image which installs Node.js dependencies and sets up the workspace.

```bash
docker compose build
```

---

## 🧪 Running Tests

The test suite runs the **same functional tests** against both implementations, but applies **strict security assertions** (like requiring Asynchronous Crypto) that the legacy code will fail.

### Run Legacy Tests (Expected to FAIL Security Checks)

The legacy code works functionally (you can log in), but it fails the security architecture check because it is Synchronous and Insecure.

```bash
docker compose run --rm app npm run test:before
```

### Run Secure Tests (Expected to PASS)

The hardened code passes all functional tests and satisfies the asynchronous Web Crypto security requirement.

```bash
docker compose run --rm app npm run test:after
```

---

## 📊 Running the Evaluation

The evaluation script runs both test suites and generates a JSON report comparing the results. It considers the run a **Success** only if the Secure implementation passes all checks.

```bash
docker compose run --rm app npm run evaluate
```

**Output:**

- Evaluates `repository_before` (fails security check).
- Evaluates `repository_after` (passes all checks).
- Generates a report at `evaluation/reports/latest.json`.
- Prints **PASS** or **FAIL** to the console.

---

## 📝 License

ISC

```

```
