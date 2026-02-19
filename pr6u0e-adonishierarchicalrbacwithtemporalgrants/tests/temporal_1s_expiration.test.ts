/**
 * REQ-07: Temporal Role Escalation - 1 second expiration test.
 * "Create a test case where a user is granted a 'Superuser' role with an expiration of 1 second.
 * Verify that the permission check succeeds initially and fails exactly 1.1 seconds later."
 *
 * Uses testDb (mocked data) and a test helper that mirrors the resolver's temporal filtering logic.
 */
import { DateTime } from 'luxon';
import { testDb } from './setup';

/** Resolve effective permission names for a user as of a given time (testDb only). */
function resolvePermissionsFromTestDb(
  userId: number,
  tenantId: number,
  asOf: DateTime
): string[] {
  const userRoles = testDb.find('user_roles', { user_id: userId, tenant_id: tenantId });
  const activeUserRoles = userRoles.filter((ur) => {
    if (ur.expires_at == null) return true;
    return DateTime.fromSQL(ur.expires_at) > asOf;
  });
  const roleIds = [...new Set(activeUserRoles.map((ur) => ur.role_id))];
  const allPermNames = new Set<string>();
  const visitedRoleIds = new Set<number>();

  function collectForRole(roleId: number): void {
    if (visitedRoleIds.has(roleId)) return;
    visitedRoleIds.add(roleId);
    const rolePerms = testDb.find('role_permissions', { role_id: roleId, tenant_id: tenantId });
    for (const rp of rolePerms) {
      const perm = testDb.findOne('permissions', { id: rp.permission_id, tenant_id: tenantId });
      if (perm) allPermNames.add(perm.name);
    }
    const parents = testDb.find('role_hierarchy', { child_role_id: roleId, tenant_id: tenantId });
    for (const h of parents) {
      collectForRole(h.parent_role_id);
    }
  }

  for (const rid of roleIds) {
    collectForRole(rid);
  }
  return Array.from(allPermNames).sort();
}

describe('REQ-07: Temporal role - permission succeeds initially, fails 1.1s later', () => {
  const FIXED_TIME = DateTime.fromISO('2024-01-15T10:00:00.000Z');
  let tenantId: number;
  let user: { id: number };
  let superuserRole: { id: number };

  beforeEach(() => {
    tenantId = 1;
    user = testDb.insert('users', { email: 'temp@example.com', tenant_id: tenantId });
    superuserRole = testDb.insert('roles', { name: 'Superuser', tenant_id: tenantId });
    const superPermission = testDb.insert('permissions', {
      name: 'can_super_admin',
      tenant_id: tenantId,
    });
    testDb.insert('role_permissions', {
      role_id: superuserRole.id,
      permission_id: superPermission.id,
      tenant_id: tenantId,
    });
  });

  test('permission check succeeds initially and fails exactly 1.1 seconds later', () => {
    const expiresAt = FIXED_TIME.plus({ seconds: 1 });
    testDb.insert('user_roles', {
      user_id: user.id,
      role_id: superuserRole.id,
      tenant_id: tenantId,
      is_primary: false,
      expires_at: expiresAt.toSQL(),
    });

    const permissionsAtT0 = resolvePermissionsFromTestDb(user.id, tenantId, FIXED_TIME);
    const permissionsAtT1_1 = resolvePermissionsFromTestDb(
      user.id,
      tenantId,
      FIXED_TIME.plus({ seconds: 1.1 })
    );

    expect(permissionsAtT0).toContain('can_super_admin');
    expect(permissionsAtT1_1).not.toContain('can_super_admin');
  });

  /** REQ-05: Temporal roles inactive immediately upon reaching expires_at (at exactly expires_at) */
  test('at exactly expires_at time role is inactive (excluded from resolution)', () => {
    const expiresAt = FIXED_TIME.plus({ seconds: 1 });
    testDb.insert('user_roles', {
      user_id: user.id,
      role_id: superuserRole.id,
      tenant_id: tenantId,
      is_primary: false,
      expires_at: expiresAt.toSQL(),
    });

    const atExpiry = resolvePermissionsFromTestDb(user.id, tenantId, expiresAt);
    const justAfter = resolvePermissionsFromTestDb(
      user.id,
      tenantId,
      expiresAt.plus({ milliseconds: 1 })
    );

    expect(atExpiry).not.toContain('can_super_admin');
    expect(justAfter).not.toContain('can_super_admin');
  });
});
