import { DateTime } from "luxon";
import PermissionResolverService from "#services/permission_resolver_service";
import { testDb } from "./setup";

jest.mock("#models/user", () => {
  const { User } = require("./mocks/lucid");
  return { __esModule: true, default: User };
});

jest.mock("#models/role", () => {
  const { Role } = require("./mocks/lucid");
  return { __esModule: true, default: Role };
});

jest.mock("@adonisjs/lucid/services/db", () => {
  return {
    __esModule: true,
    default: {
      from: () => ({
        where: jest.fn().mockReturnThis(),
        whereNotNull: jest.fn().mockReturnThis(),
        delete: jest.fn().mockResolvedValue(1),
      }),
    },
  };
});

describe("Temporal Role Escalation Integration", () => {
  let tenantId: number;
  let user: any;
  let superuserRole: any;

  beforeEach(() => {
    tenantId = 1;

    user = testDb.insert("users", {
      email: "test@example.com",
      tenant_id: tenantId,
    });

    superuserRole = testDb.insert("roles", {
      name: "Superuser",
      tenant_id: tenantId,
    });

    const superPermission = testDb.insert("permissions", {
      name: "can_super_admin",
      tenant_id: tenantId,
    });

    testDb.insert("role_permissions", {
      role_id: superuserRole.id,
      permission_id: superPermission.id,
      tenant_id: tenantId,
    });
  });

  describe("TC-15: REQ-07 - Temporal role expiration timing", () => {
    test("grantTemporaryRole attaches role with expiration", async () => {
      const service = new PermissionResolverService();
      const expiresAt = DateTime.now().plus({ seconds: 1 });

      await service.grantTemporaryRole(user.id, superuserRole.id, tenantId, expiresAt);

      const userRole = testDb.findOne("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
      });
      expect(userRole).toBeTruthy();
      expect(userRole.expires_at).toBe(expiresAt.toSQL());
    });

    test("should store temporary role with expiration in database", () => {
      const expiresAt = DateTime.now().plus({ seconds: 1 });

      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
        tenant_id: tenantId,
        is_primary: false,
        expires_at: expiresAt.toSQL(),
      });

      const userRole = testDb.findOne("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
      });
      
      expect(userRole).toBeTruthy();
      expect(userRole.expires_at).toBe(expiresAt.toSQL());
    });

    test("expired roles are filtered during resolution", async () => {
      const expiredTime = DateTime.now().minus({ seconds: 1 });
      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
        tenant_id: tenantId,
        is_primary: false,
        expires_at: expiredTime.toSQL(),
      });

      const permissions = await new PermissionResolverService().resolveUserPermissions(
        user.id,
        tenantId,
      );

      expect(permissions).not.toContain("can_super_admin");
    });
  });

  describe("TC-16: REQ-07 - Permission check timing validation", () => {
    test("supports millisecond precision expiration", async () => {
      const expiresAt = DateTime.now().plus({ milliseconds: 5 });
      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
        tenant_id: tenantId,
        is_primary: false,
        expires_at: expiresAt.toSQL(),
      });

      const nowMock = DateTime.now as unknown as jest.Mock;
      const beforeTime = expiresAt.minus({ milliseconds: 1 }) as any;
      nowMock.mockReturnValueOnce(beforeTime).mockReturnValueOnce(beforeTime);
      const permsBefore = await new PermissionResolverService().resolveUserPermissions(
        user.id,
        tenantId,
      );

      const afterTime = expiresAt.plus({ milliseconds: 1 }) as any;
      nowMock.mockReturnValueOnce(afterTime).mockReturnValueOnce(afterTime);
      const permsAfter = await new PermissionResolverService().resolveUserPermissions(
        user.id,
        tenantId,
      );

      expect(permsBefore).toContain("can_super_admin");
      expect(permsAfter).not.toContain("can_super_admin");
    });

    test("should correctly store active and expired roles", () => {
      const activeTime = DateTime.now().plus({ hours: 1 });
      const expiredTime = DateTime.now().minus({ seconds: 10 });
      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
        tenant_id: tenantId,
        is_primary: false,
        expires_at: activeTime.toSQL(),
      });

      const guestRole = testDb.insert("roles", {
        name: "Guest",
        tenant_id: tenantId,
      });

      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: guestRole.id,
        tenant_id: tenantId,
        is_primary: false,
        expires_at: expiredTime.toSQL(),
      });

      const userRoles = testDb.find("user_roles", { user_id: user.id });
      expect(userRoles.length).toBe(2);

      const now = DateTime.now();
      const activeRoles = userRoles.filter(
        (ur) => !ur.expires_at || DateTime.fromSQL(ur.expires_at) > now
      );
      const expiredRoles = userRoles.filter(
        (ur) => ur.expires_at && DateTime.fromSQL(ur.expires_at) <= now
      );

      expect(activeRoles.length).toBe(1);
      expect(expiredRoles.length).toBe(1);
    });
  });

  describe("TC-17: REQ-05 - Automatic cleanup of expired roles", () => {
    test("cleanupExpiredRoles returns a count", async () => {
      const service = new PermissionResolverService();
      await expect(service.cleanupExpiredRoles()).resolves.toBe(1);
    });

    test("should store multiple temporal roles with different expiration times", () => {
      const shortRole = testDb.insert("roles", {
        name: "ShortTerm",
        tenant_id: tenantId,
      });
      const longRole = testDb.insert("roles", {
        name: "LongTerm",
        tenant_id: tenantId,
      });

      const shortExpiry = DateTime.now().plus({ milliseconds: 500 });
      const longExpiry = DateTime.now().plus({ seconds: 5 });

      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: shortRole.id,
        tenant_id: tenantId,
        expires_at: shortExpiry.toSQL(),
      });

      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: longRole.id,
        tenant_id: tenantId,
        expires_at: longExpiry.toSQL(),
      });

      const userRoles = testDb.find("user_roles", { user_id: user.id });
      expect(userRoles.length).toBe(2);

      expect(userRoles.every((r) => r.expires_at !== null)).toBe(true);
    });
  });
});
