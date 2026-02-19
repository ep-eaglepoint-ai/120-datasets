import { Request, Response, NextFunction } from 'express';

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const adminKey = req.headers['x-admin-key'] as string | undefined;
  const secret = process.env.ADMIN_SECRET || '';

  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : adminKey;
  if (!secret || token !== secret) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}
