// @ts-nocheck
import { DateTime } from "luxon";
import User from "#models/user";
import Role from "#models/role";

export default class PermissionResolverService {
  async resolveUserPermissions(
    userId: number,
    tenantId: number,
  ): Promise<string[]> {
    const user = await User.query()
      .where("id", userId)
      .where("tenant_id", tenantId)
      .first();

    if (!user) {
      return [];
    }

    const effectiveTenantId = tenantId ?? user.tenantId;
    const activeRoles = await this.getActiveUserRoles(user, effectiveTenantId);
    const allPermissions = new Set<string>();

    for (const role of activeRoles) {
      const rolePermissions = await this.resolveRolePermissions(role, effectiveTenantId);
      rolePermissions.forEach((permission) => allPermissions.add(permission));
    }

    return Array.from(allPermissions).sort();
  }

  /**
   * Get active roles for a user scoped to tenant.
   * Includes the primary role (non-expired) and active temporary roles only.
   */
  private async getActiveUserRoles(user: User, tenantId: number): Promise<Role[]> {
    const now = DateTime.now();
    const roles = await user
      .related("roles")
      .query()
      .where("tenant_id", tenantId)
      .where((roleQuery) => {
        // Primary role (non-expired) OR temporary role (expires_at in future)
        roleQuery
          .where((primaryQuery) => {
            primaryQuery
              .where("user_roles.is_primary", true)
              .where((expQuery) => {
                expQuery
                  .whereNull("user_roles.expires_at")
                  .orWhere("user_roles.expires_at", ">", now.toSQL());
              });
          })
          .orWhere((tempQuery) => {
            tempQuery
              .where("user_roles.is_primary", false)
              .whereNotNull("user_roles.expires_at")
              .where("user_roles.expires_at", ">", now.toSQL());
          });
      });

    return roles;
  }

  async resolveRolePermissions(
    role: Role,
    tenantId: number,
  ): Promise<string[]> {
    const allPermissions = new Set<string>();
    const visitedRoles = new Set<number>();

    await this.collectRolePermissions(
      role,
      tenantId,
      allPermissions,
      visitedRoles,
    );

    return Array.from(allPermissions).sort();
  }

  private async collectRolePermissions(
    role: Role,
    tenantId: number,
    allPermissions: Set<string>,
    visitedRoles: Set<number>,
  ): Promise<void> {
    if (visitedRoles.has(role.id)) {
      return;
    }
    visitedRoles.add(role.id);

    await role.load("permissions", (query) => {
      query.where("tenant_id", tenantId);
    });

    for (const permission of role.permissions) {
      allPermissions.add(permission.name);
    }

    await role.load("parentRoles", (query) => {
      query.where("tenant_id", tenantId);
    });

    for (const parentRole of role.parentRoles) {
      await this.collectRolePermissions(
        parentRole,
        tenantId,
        allPermissions,
        visitedRoles,
      );
    }
  }

  async userHasPermission(
    userId: number,
    tenantId: number,
    permission: string,
  ): Promise<boolean> {
    const userPermissions = await this.resolveUserPermissions(userId, tenantId);
    return userPermissions.includes(permission);
  }

  async grantTemporaryRole(
    userId: number,
    roleId: number,
    tenantId: number,
    expiresAt: DateTime,
  ): Promise<void> {
    const user = await User.query()
      .where("id", userId)
      .where("tenant_id", tenantId)
      .first();

    const role = await Role.query()
      .where("id", roleId)
      .where("tenant_id", tenantId)
      .first();

    if (!user || !role) {
      throw new Error("User or role not found");
    }

    // Check if user already has this role
    const existingRole = await user
      .related("roles")
      .query()
      .where("role_id", roleId)
      .first();

    if (existingRole) {
      // Update expiration if role already exists
      await user
        .related("roles")
        .pivotQuery()
        .where("role_id", roleId)
        .update({ expires_at: expiresAt.toSQL() });
    } else {
      // Attach new temporary role
      await user.related("roles").attach({
        [roleId]: {
          tenant_id: tenantId,
          is_primary: false,
          expires_at: expiresAt.toSQL(),
        },
      });
    }
  }

  /**
   * Cleanup expired temporal roles
   */
  async cleanupExpiredRoles(): Promise<number> {
    const now = DateTime.now();

    // Use raw query to delete expired role assignments
    const db = (await import("@adonisjs/lucid/services/db")).default;

    const result = await db.from("user_roles")
      .where("expires_at", "<=", now.toSQL())
      .whereNotNull("expires_at")
      .delete();

    return result;
  }

  /**
   * Grant temporary role with duration
   */
  async grantTemporaryRoleWithDuration(
    userId: number,
    roleId: number,
    tenantId: number,
    durationInSeconds: number,
  ): Promise<void> {
    const expiresAt = DateTime.now().plus({ seconds: durationInSeconds });
    await this.grantTemporaryRole(userId, roleId, tenantId, expiresAt);
  }
}
