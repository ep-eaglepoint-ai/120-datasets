// @ts-nocheck
import { DateTime } from 'luxon'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import Role from './role.js'

export default class User extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare fullName: string

  @column()
  declare tenantId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Many-to-many relationship with roles
  @manyToMany(() => Role, {
    pivotTable: 'user_roles',
    pivotForeignKey: 'user_id',
    pivotRelatedForeignKey: 'role_id',
    pivotColumns: ['tenant_id', 'is_primary', 'expires_at'],
  })
  declare roles: ManyToMany<typeof Role>

  /**
   * Scope to filter users by tenant
   */
  static byTenant(query: any, tenantId: number) {
    return query.where('tenant_id', tenantId)
  }

  /**
   * Get active roles (non-expired temporal roles)
   */
  async getActiveRoles(): Promise<Role[]> {
    const now = DateTime.now()
    
    await this.load('roles', (query) => {
      query
        .where('tenant_id', this.tenantId)
        .where((subQuery) => {
          subQuery
            .whereNull('user_roles.expires_at')
            .orWhere('user_roles.expires_at', '>', now.toSQL())
        })
    })
    
    return this.roles
  }

  /**
   * Get primary role
   */
  async getPrimaryRole(): Promise<Role | null> {
    await this.load('roles', (query) => {
      query
        .where('tenant_id', this.tenantId)
        .where('user_roles.is_primary', true)
        .where((subQuery) => {
          subQuery
            .whereNull('user_roles.expires_at')
            .orWhere('user_roles.expires_at', '>', DateTime.now().toSQL())
        })
    })
    
    return this.roles[0] || null
  }
}