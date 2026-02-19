// @ts-nocheck
import type { HttpContext } from '@adonisjs/core/http'
import { inject } from '@adonisjs/core'
import PermissionResolverService from '#services/permission_resolver_service'
import { DateTime } from 'luxon'

@inject()
export default class RbacController {
  constructor(private permissionResolver: PermissionResolverService) {}

  /**
   * Get user permissions
   */
  async getUserPermissions({ auth, response, params }: HttpContext) {
    const user = auth.user!
    const tenantId = user.tenantId

    try {
      const permissions = await this.permissionResolver.resolveUserPermissions(
        user.id,
        tenantId
      )

      return response.json({
        user_id: user.id,
        tenant_id: tenantId,
        permissions
      })
    } catch (error) {
      return response.status(500).json({
        error: 'Failed to resolve permissions',
        details: error.message
      })
    }
  }

  /**
   * Grant temporary role to user
   */
  async grantTemporaryRole({ auth, request, response }: HttpContext) {
    const user = auth.user!
    const { role_id, expires_in_seconds } = request.only(['role_id', 'expires_in_seconds'])

    if (!role_id || !expires_in_seconds) {
      return response.status(400).json({
        error: 'role_id and expires_in_seconds are required'
      })
    }

    try {
      const expiresAt = DateTime.now().plus({ seconds: expires_in_seconds })
      
      await this.permissionResolver.grantTemporaryRole(
        user.id,
        role_id,
        user.tenantId,
        expiresAt
      )

      return response.json({
        message: 'Temporary role granted successfully',
        expires_at: expiresAt.toISO()
      })
    } catch (error) {
      return response.status(500).json({
        error: 'Failed to grant temporary role',
        details: error.message
      })
    }
  }

  /**
   * Check specific permission
   */
  async checkPermission({ auth, response, params }: HttpContext) {
    const user = auth.user!
    const { permission } = params

    try {
      const hasPermission = await this.permissionResolver.userHasPermission(
        user.id,
        user.tenantId,
        permission
      )

      return response.json({
        user_id: user.id,
        permission,
        has_permission: hasPermission
      })
    } catch (error) {
      return response.status(500).json({
        error: 'Failed to check permission',
        details: error.message
      })
    }
  }

  /**
   * Cleanup expired roles
   */
  async cleanupExpiredRoles({ response }: HttpContext) {
    try {
      const deletedCount = await this.permissionResolver.cleanupExpiredRoles()

      return response.json({
        message: 'Cleanup completed',
        deleted_roles: deletedCount
      })
    } catch (error) {
      return response.status(500).json({
        error: 'Failed to cleanup expired roles',
        details: error.message
      })
    }
  }
}