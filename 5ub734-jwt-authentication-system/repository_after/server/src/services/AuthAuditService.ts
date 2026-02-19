import { query } from "../db";

export type AuthAuditEventType =
  | "register_success"
  | "register_failed"
  | "login_success"
  | "login_failed"
  | "refresh_success"
  | "refresh_failed"
  | "refresh_reuse_detected"
  | "logout";

export interface AuthAuditEvent {
  eventType: AuthAuditEventType;
  success: boolean;
  userId?: string | null;
  email?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, any> | null;
}

export class AuthAuditService {
  static async record(event: AuthAuditEvent): Promise<void> {
    try {
      await query(
        `INSERT INTO auth_audit_events (event_type, user_id, email, ip, user_agent, success, details)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          event.eventType,
          event.userId ?? null,
          event.email ?? null,
          event.ip ?? null,
          event.userAgent ?? null,
          event.success,
          event.details ?? null,
        ]
      );
    } catch {
      // Fail-open: audit logging must not break auth.
    }
  }
}
