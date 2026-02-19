# Trajectory: Hierarchical RBAC with Temporal Grants

## Purpose
Summarize how the implementation in repository_after satisfies the prompt, including the key design decisions, invariants, and validation points. This is a high-level execution narrative, not step-by-step reasoning.

## Requirements Summary
- Resolve effective permissions across a role hierarchy.
- Enforce strict tenant isolation for all reads/writes.
- Support temporal role escalation with immediate expiry at `expires_at`.
- Integrate with middleware and Bouncer for policy checks.

## System Components
- **Schema**: `roles`, `permissions`, `role_hierarchy`, `role_permissions`, `user_roles` (with `expires_at`, `is_primary`, `tenant_id`).
- **Models**: `User`, `Role`, `Permission` with tenant-scoped relations and pivots.
- **Service**: `PermissionResolverService` centralizes permission aggregation and temporal filtering.
- **Middleware**: resolves permissions and attaches them to HTTP context.
- **Policy**: `RolePolicy` with granular checks and snake_case aliases for bouncer actions.

## Data and Control Flow
1. Request enters middleware.
2. Tenant is extracted and validated against `auth.user.tenantId`.
3. Resolver loads only active roles:
	- **Primary role** (non-expired) and
	- **Temporary roles** (with `expires_at` in the future).
4. For each active role, permissions are collected recursively through parent roles.
5. Unique permission names are returned (sorted) and attached to the context.

## Key Invariants
- **Tenant isolation**: every query includes `tenant_id`.
- **Temporal correctness**: roles are inactive at or after `expires_at`.
- **Hierarchy safety**: traversal uses a visited set to prevent cycles.
- **No direct user permissions**: permissions are only assigned via roles.

## Validation Map (REQ → Tests)
- **REQ-01 (Schema)** → `tests/database_schema.test.ts`, `tests/rbac_structure.test.ts`, `tests/requirements_coverage.test.ts`
- **REQ-02 (Hierarchy)** → `tests/permission_resolver_service.test.ts`, `tests/rbac_functionality.test.ts`
- **REQ-03 (Tenant isolation)** → `tests/rbac_functionality.test.ts`, `tests/requirements_coverage.test.ts`
- **REQ-04 (Middleware)** → `tests/rbac_middleware.test.ts`
- **REQ-05 (Temporal)** → `tests/temporal_1s_expiration.test.ts`, `tests/temporal_role_escalation.test.ts`, `tests/temporal_validation.test.ts`
- **REQ-06 (Bouncer/Policy)** → `tests/role_policy.test.ts`
- **REQ-07 (1s expiration)** → `tests/temporal_1s_expiration.test.ts`
- **REQ-08 (3-level hierarchy)** → `tests/permission_resolver_service.test.ts`

## Completion Criteria
- Jest suite passes.
- Resolver returns a flattened, unique, tenant-scoped permission set.
- Expired temporal roles are excluded immediately at `expires_at`.
- Bouncer supports `allows('can_edit_invoice')` via policy aliases.

## References
- AdonisJS Bouncer: https://docs.adonisjs.com/guides/authorization
- Luxon DateTime: https://moment.github.io/luxon/
