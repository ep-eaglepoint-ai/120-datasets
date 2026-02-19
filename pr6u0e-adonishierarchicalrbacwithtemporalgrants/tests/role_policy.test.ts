import { testDb } from "./setup";

jest.mock("@adonisjs/bouncer", () => {
  return { BasePolicy: class {} };
});

jest.mock("@adonisjs/bouncer/types", () => ({}));

import RolePolicy from "#policies/role_policy";

jest.mock("#services/permission_resolver_service", () => {
  return {
    __esModule: true,
    default: class PermissionResolverService {
      userHasPermission = jest.fn().mockResolvedValue(true);
      resolveUserPermissions = jest
        .fn()
        .mockResolvedValue(["can_edit_invoice", "can_view_reports"]);
    },
  };
});

describe("RolePolicy", () => {
  let tenantId: number;
  let user: any;

  beforeEach(() => {
    tenantId = 1;
    user = testDb.insert("users", {
      email: "test@example.com",
      tenant_id: tenantId,
    });
  });

  describe("TC-09: REQ-06 - Bouncer integration allows method", () => {
    test("allows returns true for permission", async () => {
      const policy = new RolePolicy();
      const result = await policy.allows(user as any, "can_edit_invoice", tenantId);
      expect(result).toBe(true);
    });
  });

  describe("TC-10: REQ-06 - Specific permission methods", () => {
    test("canEditInvoice returns true", async () => {
      const policy = new RolePolicy();
      await expect(policy.canEditInvoice(user as any, tenantId)).resolves.toBe(true);
    });

    test("canViewReports returns true", async () => {
      const policy = new RolePolicy();
      await expect(policy.canViewReports(user as any, tenantId)).resolves.toBe(true);
    });

    test("canManageUsers returns true", async () => {
      const policy = new RolePolicy();
      await expect(policy.canManageUsers(user as any, tenantId)).resolves.toBe(true);
    });

    test("canAccessAdmin returns true", async () => {
      const policy = new RolePolicy();
      await expect(policy.canAccessAdmin(user as any, tenantId)).resolves.toBe(true);
    });
  });

  describe("TC-11: REQ-06 - Bouncer granular check (e.g. allows('can_edit_invoice'))", () => {
    test("snake_case aliases resolve to the correct checks", async () => {
      const policy = new RolePolicy();
      await expect(policy["can_edit_invoice"](user as any, tenantId)).resolves.toBe(true);
      await expect(policy["can_view_reports"](user as any, tenantId)).resolves.toBe(true);
      await expect(policy["can_manage_users"](user as any, tenantId)).resolves.toBe(true);
      await expect(policy["can_access_admin"](user as any, tenantId)).resolves.toBe(true);
    });
  });

  describe("TC-12: REQ-06 - Multiple permission checks", () => {
    test("hasAnyPermission returns true when any permission matches", async () => {
      const policy = new RolePolicy();
      await expect(
        policy.hasAnyPermission(user as any, ["missing", "can_edit_invoice"], tenantId),
      ).resolves.toBe(true);
    });

    test("hasAllPermissions returns false when any permission missing", async () => {
      const policy = new RolePolicy();
      await expect(
        policy.hasAllPermissions(user as any, ["can_edit_invoice", "missing"], tenantId),
      ).resolves.toBe(false);
    });
  });
});
