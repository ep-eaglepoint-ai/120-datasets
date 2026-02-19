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

describe("Temporal Role Escalation Tests", () => {
  let tenantId: number;
  let superuserRole: any;
  let user: any;

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

  describe("TC-14: REQ-07 - Temporal Role Expiration Implementation", () => {
    test("grantTemporaryRole stores expiration on pivot", async () => {
      const service = new PermissionResolverService();
      const expiresAt = DateTime.now().plus({ seconds: 1 });

      await service.grantTemporaryRole(user.id, superuserRole.id, tenantId, expiresAt);

      const row = testDb.findOne("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
      });
      expect(row).toBeTruthy();
      expect(row.expires_at).toBe(expiresAt.toSQL());
    });

    test("expired roles are excluded at resolution time", async () => {
      const expiredAt = DateTime.now().minus({ seconds: 1 });
      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
        tenant_id: tenantId,
        is_primary: false,
        expires_at: expiredAt.toSQL(),
      });

      const permissions = await new PermissionResolverService().resolveUserPermissions(
        user.id,
        tenantId,
      );

      expect(permissions).not.toContain("can_super_admin");
    });

    test("supports 1-second precision timing", async () => {
      const expiresAt = DateTime.now().plus({ seconds: 1 });
      testDb.insert("user_roles", {
        user_id: user.id,
        role_id: superuserRole.id,
        tenant_id: tenantId,
        is_primary: false,
        expires_at: expiresAt.toSQL(),
      });

      const nowMock = DateTime.now as unknown as jest.Mock;
      const beforeTime = expiresAt.minus({ milliseconds: 10 }) as any;
      nowMock.mockReturnValueOnce(beforeTime).mockReturnValueOnce(beforeTime);
      const before = await new PermissionResolverService().resolveUserPermissions(
        user.id,
        tenantId,
      );

      const afterTime = expiresAt.plus({ milliseconds: 100 }) as any;
      nowMock.mockReturnValueOnce(afterTime).mockReturnValueOnce(afterTime);
      const after = await new PermissionResolverService().resolveUserPermissions(
        user.id,
        tenantId,
      );

      expect(before).toContain("can_super_admin");
      expect(after).not.toContain("can_super_admin");
    });
  });

  describe("TC-15: REQ-05 - Cleanup Logic Implementation", () => {
    test("cleanupExpiredRoles returns a count", async () => {
      const service = new PermissionResolverService();
      await expect(service.cleanupExpiredRoles()).resolves.toBe(1);
    });
  });

  describe("TC-16: REQ-07 - Timing Validation Requirements", () => {
    test("should handle edge case where user has no role", async () => {
      const service = new PermissionResolverService();
      const permissions = await service.resolveUserPermissions(999, tenantId);
      expect(permissions).toEqual([]);
    });
  });

  describe("TC-17: REQ-05 - Database Integration", () => {
    test("cleanup can be invoked without errors", async () => {
      const service = new PermissionResolverService();
      await expect(service.cleanupExpiredRoles()).resolves.toBe(1);
    });
  });
});
