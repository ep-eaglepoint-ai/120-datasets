import path from "path";
import { DateTime } from "luxon";
import { testDb } from "./setup";

jest.mock("@adonisjs/bouncer", () => {
  return {
    BasePolicy: class {},
    defineConfig: (config: any) => config,
  };
});

jest.mock("@adonisjs/bouncer/types", () => ({}));

import PermissionResolverService from "#services/permission_resolver_service";
import RolePolicy from "#policies/role_policy";
import bouncerConfig from "#config/bouncer";

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

jest.mock("@adonisjs/lucid/schema", () => ({
  BaseSchema: class {},
}));

const REPO_PATH = process.env.REPO_PATH || "repository_after";

type TableSpec = {
  columns: Set<string>;
};

function createSchemaRecorder() {
  const tables = new Map<string, TableSpec>();

  const schema = {
    createTable: (name: string, callback: (table: any) => void) => {
      const tableSpec: TableSpec = { columns: new Set() };
      const columnBuilder = () => ({
        notNullable: () => columnBuilder(),
        nullable: () => columnBuilder(),
        unsigned: () => columnBuilder(),
        defaultTo: () => columnBuilder(),
      });
      const table = {
        increments: (col: string) => {
          tableSpec.columns.add(col);
          return columnBuilder();
        },
        string: (col: string) => {
          tableSpec.columns.add(col);
          return columnBuilder();
        },
        text: (col: string) => {
          tableSpec.columns.add(col);
          return columnBuilder();
        },
        integer: (col: string) => {
          tableSpec.columns.add(col);
          return columnBuilder();
        },
        datetime: (col: string) => {
          tableSpec.columns.add(col);
          return columnBuilder();
        },
        boolean: (col: string) => {
          tableSpec.columns.add(col);
          return columnBuilder();
        },
        timestamps: () => null,
        unique: () => null,
        index: () => null,
        foreign: () => ({ references: () => ({ inTable: () => ({ onDelete: () => null }) }) }),
      };

      callback(table);
      tables.set(name, tableSpec);
    },
  };

  return { schema, tables };
}

async function runMigration(relativePath: string) {
  const fullPath = path.join(process.cwd(), REPO_PATH, relativePath);
  const mod = await import(fullPath);
  const Migration = mod.default;
  const recorder = createSchemaRecorder();
  const migration = new Migration();
  (migration as any).schema = recorder.schema;
  await migration.up();
  return recorder.tables;
}

describe("REQ-01: Lucid database schema", () => {
  test("core tables and columns exist", async () => {
    const rolesTables = await runMigration("database/migrations/001_create_roles_table.ts");
    const permissionsTables = await runMigration("database/migrations/002_create_permissions_table.ts");
    const hierarchyTables = await runMigration("database/migrations/003_create_role_hierarchy_table.ts");
    const rolePermTables = await runMigration("database/migrations/004_create_role_permissions_table.ts");
    const userRolesTables = await runMigration("database/migrations/006_create_user_roles_table.ts");

    const rolesColumns = rolesTables.get("roles")?.columns ?? new Set();
    expect(rolesColumns.has("id")).toBe(true);
    expect(rolesColumns.has("name")).toBe(true);
    expect(rolesColumns.has("tenant_id")).toBe(true);

    const permissionsColumns = permissionsTables.get("permissions")?.columns ?? new Set();
    expect(permissionsColumns.has("id")).toBe(true);
    expect(permissionsColumns.has("name")).toBe(true);
    expect(permissionsColumns.has("tenant_id")).toBe(true);

    const hierarchyColumns = hierarchyTables.get("role_hierarchy")?.columns ?? new Set();
    expect(hierarchyColumns.has("parent_role_id")).toBe(true);
    expect(hierarchyColumns.has("child_role_id")).toBe(true);
    expect(hierarchyColumns.has("tenant_id")).toBe(true);

    const rolePermColumns = rolePermTables.get("role_permissions")?.columns ?? new Set();
    expect(rolePermColumns.has("role_id")).toBe(true);
    expect(rolePermColumns.has("permission_id")).toBe(true);
    expect(rolePermColumns.has("tenant_id")).toBe(true);

    const userRolesColumns = userRolesTables.get("user_roles")?.columns ?? new Set();
    expect(userRolesColumns.has("user_id")).toBe(true);
    expect(userRolesColumns.has("role_id")).toBe(true);
    expect(userRolesColumns.has("tenant_id")).toBe(true);
    expect(userRolesColumns.has("expires_at")).toBe(true);
    expect(userRolesColumns.has("is_primary")).toBe(true);
  });
});

describe("REQ-02: PermissionResolverService - recursive traversal, unique flattened array", () => {
  test("returns unique permissions across role hierarchy", async () => {
    const tenantId = 1;
    const guest = testDb.insert("roles", { name: "Guest", tenant_id: tenantId });
    const admin = testDb.insert("roles", { name: "Admin", tenant_id: tenantId });
    testDb.insert("role_hierarchy", { parent_role_id: guest.id, child_role_id: admin.id, tenant_id: tenantId });

    const perm = testDb.insert("permissions", { name: "can_read", tenant_id: tenantId });
    testDb.insert("role_permissions", { role_id: guest.id, permission_id: perm.id, tenant_id: tenantId });
    testDb.insert("role_permissions", { role_id: admin.id, permission_id: perm.id, tenant_id: tenantId });

    const user = testDb.insert("users", { email: "a@b.com", tenant_id: tenantId });
    testDb.insert("user_roles", { user_id: user.id, role_id: admin.id, tenant_id: tenantId, is_primary: true });

    const permissions = await new PermissionResolverService().resolveUserPermissions(user.id, tenantId);
    expect(permissions.filter((p) => p === "can_read")).toHaveLength(1);
  });
});

describe("REQ-03: Multi-tenant scope - absolute data isolation", () => {
  test("permissions are isolated by tenant", async () => {
    const tenant1 = 1;
    const tenant2 = 2;
    const role1 = testDb.insert("roles", { name: "Admin", tenant_id: tenant1 });
    const role2 = testDb.insert("roles", { name: "Admin", tenant_id: tenant2 });
    const perm2 = testDb.insert("permissions", { name: "tenant2_only", tenant_id: tenant2 });
    testDb.insert("role_permissions", { role_id: role2.id, permission_id: perm2.id, tenant_id: tenant2 });
    const user = testDb.insert("users", { email: "t@t.com", tenant_id: tenant1 });
    testDb.insert("user_roles", { user_id: user.id, role_id: role1.id, tenant_id: tenant1, is_primary: true });

    const permissions = await new PermissionResolverService().resolveUserPermissions(user.id, tenant1);
    expect(permissions).not.toContain("tenant2_only");
  });
});

describe("REQ-05: Cleanup and temporal filtering", () => {
  test("cleanupExpiredRoles returns count", async () => {
    const service = new PermissionResolverService();
    await expect(service.cleanupExpiredRoles()).resolves.toBe(1);
  });
});

describe("REQ-06: Bouncer - granular checks based on resolved permission set", () => {
  test("policy allows and snake_case aliases work", async () => {
    const tenantId = 1;
    const user = testDb.insert("users", { email: "p@p.com", tenant_id: tenantId });
    const role = testDb.insert("roles", { name: "Admin", tenant_id: tenantId });
    const perm = testDb.insert("permissions", { name: "can_edit_invoice", tenant_id: tenantId });
    testDb.insert("role_permissions", { role_id: role.id, permission_id: perm.id, tenant_id: tenantId });
    testDb.insert("user_roles", { user_id: user.id, role_id: role.id, tenant_id: tenantId, is_primary: true });

    const policy = new RolePolicy();
    await expect(policy.canEditInvoice(user as any, tenantId)).resolves.toBe(true);
    await expect(policy["can_edit_invoice"](user as any, tenantId)).resolves.toBe(true);
  });

  test("bouncer config registers RolePolicy", () => {
    expect(bouncerConfig.policies.RolePolicy).toBeDefined();
  });
});

describe("Prompt: Permissions assigned to roles only", () => {
  test("no user_permissions table in migration recorder", async () => {
    const tables = await runMigration("database/migrations/004_create_role_permissions_table.ts");
    expect(tables.has("user_permissions")).toBe(false);
  });
});

describe("Prompt: Temporary Role Escalation with expiration timestamp", () => {
  test("expired temporary role is excluded", async () => {
    const tenantId = 1;
    const user = testDb.insert("users", { email: "temp@t.com", tenant_id: tenantId });
    const role = testDb.insert("roles", { name: "Temp", tenant_id: tenantId });
    const perm = testDb.insert("permissions", { name: "can_temp", tenant_id: tenantId });
    testDb.insert("role_permissions", { role_id: role.id, permission_id: perm.id, tenant_id: tenantId });
    testDb.insert("user_roles", {
      user_id: user.id,
      role_id: role.id,
      tenant_id: tenantId,
      is_primary: false,
      expires_at: DateTime.now().minus({ seconds: 1 }).toSQL(),
    });

    const permissions = await new PermissionResolverService().resolveUserPermissions(user.id, tenantId);
    expect(permissions).not.toContain("can_temp");
  });
});
