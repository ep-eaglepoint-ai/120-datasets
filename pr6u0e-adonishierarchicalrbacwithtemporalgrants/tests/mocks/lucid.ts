import { DateTime } from "luxon";
import { testDb } from "../setup";

class UserQuery {
  private conditions: Record<string, any> = {};

  where(key: string, value: any) {
    this.conditions[key] = value;
    return this;
  }

  async first() {
    const user = testDb.findOne("users", {
      id: this.conditions.id,
      tenant_id: this.conditions.tenant_id,
    });
    return user ? new User(user) : null;
  }
}

class RoleQuery {
  private conditions: Record<string, any> = {};

  where(key: string, value: any) {
    this.conditions[key] = value;
    return this;
  }

  async first() {
    const role = testDb.findOne("roles", {
      id: this.conditions.id,
      tenant_id: this.conditions.tenant_id,
    });
    return role ? new Role(role) : null;
  }
}

class UserRolesQuery {
  private conditions: Record<string, any> = {};
  private applyActiveFilter = false;

  constructor(private user: User) {}

  where(arg1: any, arg2?: any) {
    if (typeof arg1 === "function") {
      this.applyActiveFilter = true;
      return this;
    }

    this.conditions[arg1] = arg2;
    return this;
  }

  whereNull(_column: string) {
    return this;
  }

  whereNotNull(_column: string) {
    return this;
  }

  orWhere(arg1: any, arg2?: any) {
    if (typeof arg1 === "function") {
      this.applyActiveFilter = true;
      return this;
    }
    this.conditions[arg1] = arg2;
    return this;
  }

  async first() {
    const roles = await this.exec();
    return roles[0] || null;
  }

  private async exec() {
    const tenantId = this.conditions.tenant_id;
    let userRoles = testDb.find("user_roles", {
      user_id: this.user.id,
      ...(tenantId ? { tenant_id: tenantId } : {}),
      ...(this.conditions.role_id ? { role_id: this.conditions.role_id } : {}),
    });

    if (this.applyActiveFilter) {
      const now = DateTime.now();
      userRoles = userRoles.filter((ur) => {
        const expiresAt = ur.expires_at ? DateTime.fromSQL(ur.expires_at) : null;
        const notExpired = !expiresAt || expiresAt > now;
        if (ur.is_primary) return notExpired;
        if (!expiresAt) return false;
        return expiresAt > now;
      });
    }

    const roles = userRoles
      .map((ur) => testDb.findOne("roles", { id: ur.role_id, tenant_id: ur.tenant_id }))
      .filter(Boolean)
      .map((role) => new Role(role));

    return roles;
  }

  then(resolve: (value: Role[]) => void, reject?: (reason: any) => void) {
    return this.exec().then(resolve, reject);
  }
}

class UserRolesPivotQuery {
  private conditions: Record<string, any> = {};

  constructor(private user: User) {}

  where(key: string, value: any) {
    this.conditions[key] = value;
    return this;
  }

  async update(updates: Record<string, any>) {
    return testDb.update(
      "user_roles",
      {
        user_id: this.user.id,
        ...(this.conditions.role_id ? { role_id: this.conditions.role_id } : {}),
      },
      updates,
    );
  }
}

class UserRolesRelation {
  constructor(private user: User) {}

  query() {
    return new UserRolesQuery(this.user);
  }

  pivotQuery() {
    return new UserRolesPivotQuery(this.user);
  }

  async attach(records: Record<string, any>) {
    for (const [roleId, payload] of Object.entries(records)) {
      testDb.insert("user_roles", {
        user_id: this.user.id,
        role_id: Number(roleId),
        ...payload,
      });
    }
  }
}

export class User {
  declare id: number;
  declare tenantId: number;
  declare email?: string;

  constructor(data: any) {
    this.id = data.id;
    this.tenantId = data.tenantId ?? data.tenant_id;
    this.email = data.email;
  }

  static query() {
    return new UserQuery();
  }

  related(relation: string) {
    if (relation !== "roles") {
      throw new Error(`Unsupported relation: ${relation}`);
    }
    return new UserRolesRelation(this);
  }
}

class RelationQuery {
  private conditions: Record<string, any> = {};

  where(key: string, value: any) {
    this.conditions[key] = value;
    return this;
  }

  get tenantId() {
    return this.conditions.tenant_id;
  }
}

export class Role {
  declare id: number;
  declare tenantId: number;
  declare name?: string;
  permissions: Array<{ name: string }> = [];
  parentRoles: Role[] = [];

  constructor(data: any) {
    this.id = data.id;
    this.tenantId = data.tenantId ?? data.tenant_id;
    this.name = data.name;
  }

  static query() {
    return new RoleQuery();
  }

  async load(relation: string, callback?: (query: RelationQuery) => void) {
    const query = new RelationQuery();
    if (callback) callback(query);
    const tenantId = query.tenantId ?? this.tenantId;

    if (relation === "permissions") {
      const rolePerms = testDb.find("role_permissions", {
        role_id: this.id,
        tenant_id: tenantId,
      });
      this.permissions = rolePerms
        .map((rp) => testDb.findOne("permissions", { id: rp.permission_id, tenant_id: tenantId }))
        .filter(Boolean)
        .map((perm) => ({ name: perm.name }));
      return;
    }

    if (relation === "parentRoles") {
      const parents = testDb.find("role_hierarchy", {
        child_role_id: this.id,
        tenant_id: tenantId,
      });
      this.parentRoles = parents
        .map((h) => testDb.findOne("roles", { id: h.parent_role_id, tenant_id: tenantId }))
        .filter(Boolean)
        .map((role) => new Role(role));
    }
  }
}
