# Trajectory (Thinking Process)

@bd_datasets_002/e2484c-Refactor_Odoo_JSON-RPC_Employee_Creation_Payload/
@bd_datasets_002/e2484c-Refactor_Odoo_JSON_RPC_Employee_Creation_Payload/

## 🧭 Step 1: Codebase Audit (Before vs After)

### 1.1 Original Code Review (BEFORE)

**Primary artifact:** `repository_before/rpc-payload.json`

**Observed behavior / issues (code-observable):**
- **Odoo `object.execute` positional args are in the wrong order**:
  - `params.args` begins with the **employee dict**, then `"create"`, `"hr.employee"`, `"password"`, `2`, `"rd-demo"`.
  - This violates the positional signature asserted by tests: `execute(db, uid, password, model, method, *args)` for `hr.employee.create`.
- **`mobile_phone` is not in international (E.164-like) format**:
  - Value is `"4522245546"` (no leading `+`).

### 1.2 Updated Code Review (AFTER)

**Primary artifact:** `repository_after/rpc-payload.json`

**What changed (mapped to files):**
- **Fix args ordering to match Odoo `execute(...)` expectations** (`repository_after/rpc-payload.json`):
  - `params.args` is now: `["rd-demo", 2, "password", "hr.employee", "create", {employee_dict}]`
  - This matches the test contract for `hr.employee.create` where the employee dict is the first method argument after `"create"`.
- **Normalize `mobile_phone` to international format** (`repository_after/rpc-payload.json`):
  - `"mobile_phone"` changed from `"4522245546"` to `"+4522245546"` (digits preserved; `+` added).

---

## 🧾 Step 2: Define the Contract (Correctness & Constraints)

The correctness contract is enforced by `tests/test_payload_requirements.py`:

- **JSON-RPC envelope**:
  - `jsonrpc == "2.0"`
  - top-level `method == "call"`
  - top-level `params` is a dict
  - top-level `id` exists
- **Odoo wrapper**:
  - `params.service == "object"`
  - `params.method == "execute"`
  - `params.args` is a list
- **Odoo execute args order (first 6 positional elements)**:
  - `[db: str, uid: int, password: str, "hr.employee", "create", employee_dict]`
  - Where `employee_dict` is a dict (the payload for `hr.employee.create`)
- **Employee payload stability (must preserve existing valid values)**:
  - `name == "Solomon"`
  - `job_title == "Engineer"`
  - `work_phone == "905"`
  - `company_id == 3`
  - `work_email == "solomon@example.com"`
  - `mobile_phone` must exist
- **Phone formatting constraint**:
  - `mobile_phone` must match the regex `^\+\d{7,15}$`

**Explicit exclusions (observable by absence):**
- No runtime call to Odoo is made; validation is structural only.
- No changes to fields other than ordering and `mobile_phone` formatting are required/implemented.

---

## 🧠 Step 3: Design & Implementation Rationale

**Design choice:** minimal, reviewable JSON payload correction.

Why it’s correct:
- The test suite defines the required positional signature and field invariants; reordering `params.args` and normalizing `mobile_phone` are the smallest changes that satisfy those assertions.
- Keeping other employee fields unchanged reduces risk of unintended data changes and aligns with “preserve existing values” checks in `tests/test_payload_requirements.py`.

Where the change lives:
- `repository_after/rpc-payload.json` only (see `patches/diff.patch` for the exact diff).

---

## 🧪 Step 4: Testing Review

**Tests:** `tests/test_payload_requirements.py`
- Validates JSON-RPC envelope structure and Odoo wrapper fields.
- Validates the first 6 `execute(...)` args positions/types and exact `"hr.employee"` / `"create"` values.
- Validates required employee fields are present and unchanged.
- Validates `mobile_phone` via deterministic regex (no network).

**Evaluation harness:** `evaluation/evaluation.py`
- Runs pytest against `repository_before` and `repository_after` by setting `TEST_REPO_PATH`.
- Writes a JSON report with payload metrics (e.g., `execute_args_order_ok`, `mobile_phone_is_international`) and test summaries to `evaluation/reports/` (ignored via `.gitignore`).

---

## 📈 Step 5: Result & Measurable Improvements

- ✅ Payload now conforms to the test-defined Odoo `object.execute` argument ordering for `hr.employee.create`.
- ✅ `mobile_phone` now satisfies the international format constraint.
- ✅ Tests provide a deterministic before/after gate: `repository_before` fails; `repository_after` passes.
- ✅ Change is minimal and localized to `repository_after/rpc-payload.json` (reviewable, low risk).

---

## 🔗 Step 6: Reference Links (ONLY if Valid)

- JSON-RPC 2.0 specification: `https://www.jsonrpc.org/specification`
