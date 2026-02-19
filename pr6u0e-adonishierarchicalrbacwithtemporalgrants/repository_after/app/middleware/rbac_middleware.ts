// @ts-nocheck
import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import PermissionResolverService from '#services/permission_resolver_service'

export default class RbacMiddleware {
  private permissionResolver = new PermissionResolverService()

  async handle(ctx: HttpContext, next: NextFn) {
    const { auth, request } = ctx

    // Skip if user is not authenticated
    if (!auth.user) {
      return next()
    }

    const user = auth.user
    const tenantId = this.extractTenantId(request)

    if (!tenantId) {
      ctx.response.status(400).json({ error: 'Tenant ID is required' })
      return
    }

    // Ensure user belongs to the tenant
    if (user.tenantId !== tenantId) {
      ctx.response.status(403).json({ error: 'Access denied: Invalid tenant' })
      return
    }

    try {
      // Resolve user permissions and attach to context
      const permissions = await this.permissionResolver.resolveUserPermissions(
        user.id, 
        tenantId
      )

      // Attach permissions to HTTP context for downstream use
      ctx.permissions = permissions
      ctx.tenantId = tenantId

      // Add helper method to check permissions
      ctx.hasPermission = (permission: string): boolean => {
        return permissions.includes(permission)
      }

      return next()
    } catch (error) {
      ctx.response.status(500).json({
        error: 'Failed to resolve user permissions',
        details: error instanceof Error ? error.message : String(error),
      })
      return
    }
  }

  /**
   * Extract tenant ID from request headers or query parameters
   */
  private extractTenantId(request: any): number | null {
    // Try header first
    const headerTenantId = request.header('x-tenant-id')
    if (headerTenantId) {
      const parsed = parseInt(headerTenantId, 10)
      return isNaN(parsed) ? null : parsed
    }

    // Try query parameter
    const queryTenantId = request.qs().tenant_id
    if (queryTenantId) {
      const parsed = parseInt(queryTenantId, 10)
      return isNaN(parsed) ? null : parsed
    }

    return null
  }
}

// Extend HttpContext type to include our custom properties
declare module '@adonisjs/core/http' {
  interface HttpContext {
    permissions?: string[]
    tenantId?: number
    hasPermission?: (permission: string) => boolean
  }
}