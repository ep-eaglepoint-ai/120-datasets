// @ts-nocheck
import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany, hasMany, belongsTo } from '@adonisjs/lucid/orm'
import type { ManyToMany, HasMany, BelongsTo } from '@adonisjs/lucid/types/relations'
import Permission from './permission.js'
import User from './user.js'

export default class Role extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare description: string | null

  @column()
  declare tenantId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Many-to-many relationship with permissions
  @manyToMany(() => Permission, {
    pivotTable: 'role_permissions',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'permission_id',
    pivotColumns: ['tenant_id'],
  })
  declare permissions: ManyToMany<typeof Permission>

  // Many-to-many relationship with users
  @manyToMany(() => User, {
    pivotTable: 'user_roles',
    pivotForeignKey: 'role_id',
    pivotRelatedForeignKey: 'user_id',
    pivotColumns: ['tenant_id', 'is_primary', 'expires_at'],
  })
  declare users: ManyToMany<typeof User>

  // Self-referencing relationship for hierarchy - parent roles
  @manyToMany(() => Role, {
    pivotTable: 'role_hierarchy',
    pivotForeignKey: 'child_role_id',
    pivotRelatedForeignKey: 'parent_role_id',
    pivotColumns: ['tenant_id'],
  })
  declare parentRoles: ManyToMany<typeof Role>

  // Self-referencing relationship for hierarchy - child roles
  @manyToMany(() => Role, {
    pivotTable: 'role_hierarchy',
    pivotForeignKey: 'parent_role_id',
    pivotRelatedForeignKey: 'child_role_id',
    pivotColumns: ['tenant_id'],
  })
  declare childRoles: ManyToMany<typeof Role>

  /**
   * Scope to filter roles by tenant
   */
  static byTenant(query: any, tenantId: number) {
    return query.where('tenant_id', tenantId)
  }

  /**
   * Get all ancestor roles recursively
   */
  async getAncestorRoles(): Promise<Role[]> {
    const ancestors: Role[] = []
    const visited = new Set<number>()
    
    const collectAncestors = async (role: Role) => {
      if (visited.has(role.id)) return
      visited.add(role.id)
      
      await role.load('parentRoles', (query) => {
        query.where('tenant_id', role.tenantId)
      })
      
      for (const parent of role.parentRoles) {
        ancestors.push(parent)
        await collectAncestors(parent)
      }
    }
    
    await collectAncestors(this)
    return ancestors
  }

  /**
   * Get all permissions including inherited from parent roles
   */
  async getAllPermissions(): Promise<string[]> {
    const allPermissions = new Set<string>()
    
    // Get direct permissions
    await this.load('permissions', (query) => {
      query.where('tenant_id', this.tenantId)
    })
    
    for (const permission of this.permissions) {
      allPermissions.add(permission.name)
    }
    
    // Get inherited permissions from ancestor roles
    const ancestors = await this.getAncestorRoles()
    for (const ancestor of ancestors) {
      await ancestor.load('permissions', (query) => {
        query.where('tenant_id', this.tenantId)
      })
      
      for (const permission of ancestor.permissions) {
        allPermissions.add(permission.name)
      }
    }
    
    return Array.from(allPermissions).sort()
  }
}