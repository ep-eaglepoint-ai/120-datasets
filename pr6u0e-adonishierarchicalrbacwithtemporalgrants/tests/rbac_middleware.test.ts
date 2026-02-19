import RbacMiddleware from "#middleware/rbac_middleware";
import { testDb } from "./setup";

jest.mock("#services/permission_resolver_service", () => {
  return {
    __esModule: true,
    default: class PermissionResolverService {
      resolveUserPermissions = jest.fn().mockResolvedValue(["can_read", "can_edit_invoice"]);
    },
  };
});

describe("RbacMiddleware", () => {
  let tenantId: number;
  let user: any;

  beforeEach(() => {
    tenantId = 1;
    user = testDb.insert("users", {
      email: "test@example.com",
      tenant_id: tenantId,
    });
  });

  const makeCtx = (overrides: any = {}) => {
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const request = {
      header: jest.fn().mockReturnValue(null),
      qs: jest.fn().mockReturnValue({}),
    };
    return {
      auth: { user: { id: user.id, tenantId } },
      request,
      response,
      ...overrides,
    };
  };

  describe("TC-07: REQ-04 - Middleware tenant validation", () => {
    test("should skip when unauthenticated", async () => {
      const middleware = new RbacMiddleware();
      const ctx = makeCtx({ auth: { user: null } });
      const next = jest.fn();

      await middleware.handle(ctx as any, next);

      expect(next).toHaveBeenCalled();
      expect(ctx.response.status).not.toHaveBeenCalled();
    });

    test("should validate tenant ID is present", async () => {
      const middleware = new RbacMiddleware();
      const ctx = makeCtx();
      const next = jest.fn();

      await middleware.handle(ctx as any, next);

      expect(ctx.response.status).toHaveBeenCalledWith(400);
      expect(ctx.response.json).toHaveBeenCalledWith({ error: "Tenant ID is required" });
      expect(next).not.toHaveBeenCalled();
    });

    test("should validate user tenant matches request tenant", async () => {
      const middleware = new RbacMiddleware();
      const ctx = makeCtx({
        request: { header: jest.fn().mockReturnValue("999"), qs: jest.fn().mockReturnValue({}) },
      });
      const next = jest.fn();

      await middleware.handle(ctx as any, next);

      expect(ctx.response.status).toHaveBeenCalledWith(403);
      expect(ctx.response.json).toHaveBeenCalledWith({ error: "Access denied: Invalid tenant" });
    });

    test("should attach permissions and helper to context", async () => {
      const middleware = new RbacMiddleware();
      const ctx = makeCtx({
        request: { header: jest.fn().mockReturnValue(String(tenantId)), qs: jest.fn().mockReturnValue({}) },
      });
      const next = jest.fn();

      await middleware.handle(ctx as any, next);

      expect(ctx.permissions).toEqual(["can_read", "can_edit_invoice"]);
      expect(ctx.tenantId).toBe(tenantId);
      expect(typeof ctx.hasPermission).toBe("function");
      expect(ctx.hasPermission("can_read")).toBe(true);
      expect(ctx.hasPermission("missing")).toBe(false);
      expect(next).toHaveBeenCalled();
    });

    test("should extract tenant ID from header", async () => {
      const middleware = new RbacMiddleware();
      const ctx = makeCtx({
        request: { header: jest.fn().mockReturnValue(String(tenantId)), qs: jest.fn().mockReturnValue({}) },
      });
      const next = jest.fn();

      await middleware.handle(ctx as any, next);

      expect(ctx.response.status).not.toHaveBeenCalledWith(400);
      expect(next).toHaveBeenCalled();
    });

    test("should extract tenant ID from query parameter", async () => {
      const middleware = new RbacMiddleware();
      const ctx = makeCtx({
        request: { header: jest.fn().mockReturnValue(null), qs: jest.fn().mockReturnValue({ tenant_id: String(tenantId) }) },
      });
      const next = jest.fn();

      await middleware.handle(ctx as any, next);

      expect(ctx.response.status).not.toHaveBeenCalledWith(400);
      expect(next).toHaveBeenCalled();
    });
  });

  describe("TC-08: REQ-04 - Error handling", () => {
    test("should handle permission resolution errors", async () => {
      const middleware = new RbacMiddleware();
      (middleware as any).permissionResolver.resolveUserPermissions = jest
        .fn()
        .mockRejectedValue(new Error("boom"));

      const ctx = makeCtx({
        request: { header: jest.fn().mockReturnValue(String(tenantId)), qs: jest.fn().mockReturnValue({}) },
      });
      const next = jest.fn();

      await middleware.handle(ctx as any, next);

      expect(ctx.response.status).toHaveBeenCalledWith(500);
      expect(ctx.response.json).toHaveBeenCalledWith({
        error: "Failed to resolve user permissions",
        details: "boom",
      });
    });
  });
});
