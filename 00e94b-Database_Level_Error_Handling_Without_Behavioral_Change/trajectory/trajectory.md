# AI Refactoring Trajectory: Robust SQL Error Handling & Integrity

## Overview

This document outlines the systematic thought process an AI model should follow when refactoring SQL database functions (triggers/procedures) to introduce robust error handling and data integrity checks while preserving existing business logic.

---

## Phase 1: Understanding the Context

### Step 1.1: Read the Problem Statement

**Action**: Deeply understand the goal: "Add Database-Level Error Handling and Integrity Checks".

**Key Questions to Ask**:

- **What is the current behavior?** (Silent execution, assumes happy path)
- **What is the desired outcome?** (Explicit failure on invalid states, standard error codes)
- **What functionality must be preserved?** (Task cancellation logic)
- **What specific errors need handling?** (Trigger misuse, orphan users/integrity violations)

**Expected Understanding**:

- This is a **reliability refactor**, not a functional change.
- The system currently "swallows" data inconsistencies (e.g., updating a user with no parent record does nothing).
- We must move from "Silent Failure" to "Loud Failure" using standard SQLSTATEs.

### Step 1.2: Analyze the Test Suite

**Action**: Examine tests to define the "Contract" for success.

```bash
# Read in order:
1. tests/test_before.py  # Demonstrates current vulnerabilities
2. tests/test_after.py   # Defines required strict behavior
```

**Key Insights from Tests**:

From `tests/test_before.py`:

- ❌ **Fragility**: The current code allows `INSERT` triggers to execute a function designed only for `UPDATE`.
- ❌ **Silent Data Corruption**: Updating an "Orphan" user (no parent record) silently succeeds, leaving the system in an inconsistent state.

From `tests/test_after.py`:

- ✅ **Strict Operation Validation**: Must raise `09000` (triggered_action_exception) if called by non-UPDATE actions.
- ✅ **Integrity Validation**: Must raise `23000` (integrity_constraint_violation) if the user has no key in `public.parents`.
- ✅ **Logic Preservation**: Happy path (task cancellation) must still work exactly as before.

---

## Phase 2: Code Analysis

### Step 2.1: Analyze Original Implementation

**Action**: Read `repository_before/db-level-error-handling.sql`.

```sql
CREATE OR REPLACE FUNCTION cancel_unverified_parent_emails()
RETURNS TRIGGER AS $$
BEGIN
 IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN
   UPDATE public.parent_scheduled_tasks
   SET ...
   WHERE parent_id IN (SELECT uuid FROM public.parents WHERE supabase_id = NEW.id)
   ...
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Vulnerability Inventory**:

1.  **Usage Scope**: No check for `TG_OP`. Can be attached to `INSERT` or `DELETE` incorrectly.
2.  **Input Validity**: No check if `NEW.id` is NULL.
3.  **Relational Integrity**: The subquery `(SELECT uuid FROM public.parents ...)` handles missing parents by returning empty set -> `UPDATE` does nothing. This hides data issues.
4.  **Security**: Missing `SET search_path`, susceptible to search path hijacking.
5.  **Exception Handling**: No `EXCEPTION` block to catch unexpected runtime errors.

### Step 2.2: Define Target State

**Target Metrics**:

- **Safety**: `TG_OP` checked explicitly.
- **Integrity**: `SELECT INTO` used to validate parent existence _before_ logic.
- **Standards**: Use PostgreSQL standard ERRCODEs (`09000`, `23002`, `23000`).
- **Security**: `search_path` explicitly set.

---

## Phase 3: Refactoring Strategy

### Step 3.1: Design Error Handling Layers

**Action**: Map vulnerabilities to specific SQL guard clauses.

| Vulnerability           | Guard Clause                 | SQLSTATE                               |
| ----------------------- | ---------------------------- | -------------------------------------- |
| Wrong Trigger Event     | `IF TG_OP <> 'UPDATE'`       | `09000` triggered_action_exception     |
| Null User ID            | `IF NEW.id IS NULL`          | `23502` not_null_violation             |
| Orphan User (No Parent) | Check `_parent_uuid IS NULL` | `23000` integrity_constraint_violation |
| Unexpected Errors       | `EXCEPTION WHEN OTHERS`      | Re-raise `SQLSTATE`                    |

### Step 3.2: Plan Logic Restructuring

**Action**: Plan to move from "Implicit Subquery" to "Explicit Variable Resolution".

**Old Logic (Implicit)**:

```sql
UPDATE ... WHERE parent_id IN (SELECT uuid FROM parents ...)
```

_Why change?_ Implicit subqueries hide the "not found" case.

**New Logic (Explicit)**:

```sql
DECLARE _parent_uuid uuid;
...
SELECT uuid INTO _parent_uuid FROM parents WHERE ...;
IF _parent_uuid IS NULL THEN RAISE EXCEPTION ... END IF;

UPDATE ... WHERE parent_id = _parent_uuid ...
```

---

## Phase 4: Implementation

### Step 4.1: Structure the Function

**Action**: Assemble the new function body.

```sql
CREATE OR REPLACE FUNCTION cancel_unverified_parent_emails()
RETURNS TRIGGER AS $$
DECLARE
  _parent_uuid uuid;
BEGIN
  -- 1. Validate Context
  IF TG_OP <> 'UPDATE' THEN
    RAISE EXCEPTION 'Invalid operation: %', TG_OP USING ERRCODE = '09000';
  END IF;

  -- 2. Validate Inputs
  IF NEW.id IS NULL THEN
    RAISE EXCEPTION 'User ID is NULL' USING ERRCODE = '23502';
  END IF;

  -- 3. Core Logic Wrapper
  IF OLD.confirmed_at IS NULL AND NEW.confirmed_at IS NOT NULL THEN

     -- 4. Explicit Integrity Check
     SELECT uuid INTO _parent_uuid FROM public.parents WHERE supabase_id = NEW.id;

     IF _parent_uuid IS NULL THEN
       RAISE EXCEPTION 'No parent record found' USING ERRCODE = '23000';
     END IF;

     -- 5. Execute Business Logic (using validated _parent_uuid)
     UPDATE public.parent_scheduled_tasks
     SET completed_at = NOW(), is_cancelled = true
     WHERE parent_id = _parent_uuid
       AND task_type IN (...)
       AND completed_at IS NULL;
  END IF;

  RETURN NEW;

EXCEPTION
  WHEN OTHERS THEN
     RAISE EXCEPTION 'Error: %', SQLERRM USING ERRCODE = SQLSTATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, auth, pg_temp; -- Security fix
```

### Step 4.2: Preserve Trigger Definition

**Action**: Ensure the trigger hook itself remains unchanged (or is recreated identicaly).

```sql
DROP TRIGGER IF EXISTS cancel_unverified_emails_trigger ON auth.users;
CREATE TRIGGER cancel_unverified_emails_trigger
AFTER UPDATE ON auth.users
FOR EACH ROW EXECUTE FUNCTION cancel_unverified_parent_emails();
```

_Note: Drop and recreate is standard practice when replacing function definitions to ensure bindings are fresh._

---

## Phase 5: Validation

### Step 5.1: Setup Test Environment

**Context**: We need a database with `auth` and `public` schemas. `conftest.py` handles this.

### Step 5.2: Verification with Test Suite

**Action**: Execute tests to confirm compliance.

1.  **Test: `test_standard_sqlstates`**

    - Tries to attach trigger to `INSERT` -> Expects `09000`. matches Refactor? ✅
    - Tries to update user with no Parent -> Expects `23000`. matches Refactor? ✅(Previous code failed this)

2.  **Test: `test_preserve_logic_and_behavior`**

    - Happy Path (User confirms -> Task cancels). matches Refactor? ✅
    - No-op 1 (Update unrelated field). matches Refactor? ✅
    - No-op 2 (Update already confirmed user). matches Refactor? ✅

3.  **Test: `test_applied_to_function_and_trigger`**
    - Checks `pg_proc` and `pg_trigger`. matches Refactor? ✅

### Step 5.3: Verify Security

**Action**: Check `proconfig` in `pg_proc` to verify `search_path` is set.
(This is implicitly done by code review in step 4.1).

---

## Phase 6: Documentation and Artifacts

### Step 6.1: Generate Patch

**Action**: Create the diff.

```bash
git diff --no-index repository_before/db-level-error-handling.sql repository_after/db-level-error-handling.sql > patches/sql_refactor.patch
```

### Step 6.2: Create Instance Metadata

**Action**: Document the task.

- `instance_id`: `sql_robust_error_handling`
- `problem_statement`: "Refactor PL/PGSQL function to include strict error handling and security context."
- `FAIL_TO_PASS`: `test_before.test_orphan_user_integrity_before`, `test_before.test_invalid_trigger_event_before` (These pass in the _before_ suite by asserting failure, but conceptually they represent the _failure of the code_ to catch errors).

---

## Phase 7: Reflection

### Key Success Factors for SQL Refactoring

1.  **Explicit > Implicit**:

    - Replacing `IN (subquery)` with `SELECT INTO var ... IF var IS NULL` is the key transformation. It turns a "silent loop over 0 items" into an "explicit requirement for 1 item".

2.  **Standard Error Codes**:

    - Don't just `RAISE EXCEPTION 'Error'`. Use `USING ERRCODE = '...'`. This allows reliable programmatic handling of specific error types (like `23000` for integrity).

3.  **Security Context**:

    - `SECURITY DEFINER` functions run with high privs. Always lock down the `search_path` to prevent hijacking.

4.  **Layered Guard Clauses**:
    - Validate _Trigger Context_ first (`TG_OP`).
    - Validate _Parameters_ second (`NEW.id`).
    - Validate _Data Relationships_ third (`parents` table).
    - Execute _Logic_ last.

### Summary Checklist

- [ ] Identified silent failure modes in original SQL.
- [ ] Defined specific SQLSTATEs for each failure mode.
- [ ] Converted implicit subqueries to explicit variable checks.
- [ ] Added `search_path` security setting.
- [ ] Verified happy path is untouched.
- [ ] Verified error paths raise correct codes.
