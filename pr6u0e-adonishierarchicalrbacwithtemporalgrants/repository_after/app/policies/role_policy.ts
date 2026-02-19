// @ts-nocheck
import User from '#models/user'
import { BasePolicy } from '@adonisjs/bouncer'
import type { AuthorizerResponse } from '@adonisjs/bouncer/types'
import PermissionResolverService from '#services/permission_resolver_service'

export default class RolePolicy extends BasePolicy {
  private permissionResolver = new PermissionResolverService()

  /**
   * Check if user has a specific permission
   */
  async allows(user: User, permission: string, tenantId?: number): Promise<AuthorizerResponse> {
    const effectiveTenantId = tenantId || user.tenantId
    
    const hasPermission = await this.permissionResolver.userHasPermission(
      user.id,
      effectiveTenantId,
      permission
    )

    return hasPermission
  }

  /**
   * Check if user can edit invoices
   */
  async canEditInvoice(user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.allows(user, 'can_edit_invoice', tenantId)
  }

  /**
   * Snake_case alias for bouncer.with('RolePolicy').allows('can_edit_invoice')
   */
  async ['can_edit_invoice'](user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.canEditInvoice(user, tenantId)
  }

  /**
   * Check if user can view reports
   */
  async canViewReports(user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.allows(user, 'can_view_reports', tenantId)
  }

  /**
   * Snake_case alias for bouncer.with('RolePolicy').allows('can_view_reports')
   */
  async ['can_view_reports'](user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.canViewReports(user, tenantId)
  }

  /**
   * Check if user can manage users
   */
  async canManageUsers(user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.allows(user, 'can_manage_users', tenantId)
  }

  /**
   * Snake_case alias for bouncer.with('RolePolicy').allows('can_manage_users')
   */
  async ['can_manage_users'](user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.canManageUsers(user, tenantId)
  }

  /**
   * Check if user can access admin panel
   */
  async canAccessAdmin(user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.allows(user, 'can_access_admin', tenantId)
  }

  /**
   * Snake_case alias for bouncer.with('RolePolicy').allows('can_access_admin')
   */
  async ['can_access_admin'](user: User, tenantId?: number): Promise<AuthorizerResponse> {
    return this.canAccessAdmin(user, tenantId)
  }

  /**
   * Check multiple permissions at once
   */
  async hasAnyPermission(
    user: User, 
    permissions: string[], 
    tenantId?: number
  ): Promise<AuthorizerResponse> {
    const effectiveTenantId = tenantId || user.tenantId
    
    const userPermissions = await this.permissionResolver.resolveUserPermissions(
      user.id,
      effectiveTenantId
    )

    const hasAny = permissions.some(permission => userPermissions.includes(permission))
    return hasAny
  }

  /**
   * Check if user has all specified permissions
   */
  async hasAllPermissions(
    user: User, 
    permissions: string[], 
    tenantId?: number
  ): Promise<AuthorizerResponse> {
    const effectiveTenantId = tenantId || user.tenantId
    
    const userPermissions = await this.permissionResolver.resolveUserPermissions(
      user.id,
      effectiveTenantId
    )

    const hasAll = permissions.every(permission => userPermissions.includes(permission))
    return hasAll
  }
}