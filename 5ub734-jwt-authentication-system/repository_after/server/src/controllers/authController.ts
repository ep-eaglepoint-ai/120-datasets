import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { query } from "../db";
import { AuthService } from "../services/AuthService";
import { AuthAuditService } from "../services/AuthAuditService";
import { config } from "../config/env";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

const getRequestMeta = (req: Request) => ({
  ip: (req.headers["x-forwarded-for"] as string) || req.ip,
  userAgent: req.headers["user-agent"] as string,
});

const hashPassword = async (password: string) => {
  return bcrypt.hash(password, config.security.bcryptCost);
};

export const register = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { ip, userAgent } = getRequestMeta(req);

  if (!email || !password) {
    await AuthAuditService.record({
      eventType: "register_failed",
      success: false,
      email,
      ip,
      userAgent,
      details: { reason: "invalid_input" },
    });
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const existing = await query("SELECT id FROM users WHERE email = $1", [
      email,
    ]);
    if (existing.rowCount && existing.rowCount > 0) {
      await AuthAuditService.record({
        eventType: "register_failed",
        success: false,
        email,
        ip,
        userAgent,
        details: { reason: "invalid_input" },
      });
      return res.status(400).json({ error: "Invalid input" });
    }

    const passwordHash = await hashPassword(password);
    const created = await query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role",
      [email, passwordHash]
    );
    const user = created.rows[0];

    const refreshTokenData = await AuthService.generateRefreshToken(user.id);
    const accessToken = AuthService.generateAccessToken(
      user,
      refreshTokenData.familyId
    );

    res.cookie("refreshToken", refreshTokenData.tokenString, {
      ...COOKIE_OPTIONS,
      expires: refreshTokenData.expiresAt,
    });

    await AuthAuditService.record({
      eventType: "register_success",
      success: true,
      userId: user.id,
      email: user.email,
      ip,
      userAgent,
    });

    return res.status(201).json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    });
  } catch {
    await AuthAuditService.record({
      eventType: "register_failed",
      success: false,
      email,
      ip,
      userAgent,
      details: { reason: "server_error" },
    });
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { ip, userAgent } = getRequestMeta(req);

  try {
    const result = await query("SELECT * FROM users WHERE email = $1", [email]);

    if (result.rowCount === 0) {
      await AuthAuditService.record({
        eventType: "login_failed",
        success: false,
        email,
        ip,
        userAgent,
        details: { reason: "invalid_credentials" },
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      await AuthAuditService.record({
        eventType: "login_failed",
        success: false,
        email,
        ip,
        userAgent,
        details: { reason: "invalid_credentials" },
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const refreshTokenData = await AuthService.generateRefreshToken(user.id);
    const accessToken = AuthService.generateAccessToken(
      user,
      refreshTokenData.familyId
    );

    res.cookie("refreshToken", refreshTokenData.tokenString, {
      ...COOKIE_OPTIONS,
      expires: refreshTokenData.expiresAt,
    });

    res.json({
      accessToken,
      user: { id: user.id, email: user.email, role: user.role },
    });

    await AuthAuditService.record({
      eventType: "login_success",
      success: true,
      userId: user.id,
      email: user.email,
      ip,
      userAgent,
    });
  } catch (error) {
    await AuthAuditService.record({
      eventType: "login_failed",
      success: false,
      email,
      ip,
      userAgent,
      details: { reason: "server_error" },
    });
    res.status(500).json({ error: "Internal server error" });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const tokenString = req.cookies.refreshToken;
  const { ip, userAgent } = getRequestMeta(req);
  if (!tokenString) return res.status(401).json({ error: "No token provided" });

  try {
    const { accessToken, refreshToken, user } =
      await AuthService.rotateRefreshToken(tokenString);

    res.cookie("refreshToken", refreshToken, {
      ...COOKIE_OPTIONS,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    await AuthAuditService.record({
      eventType: "refresh_success",
      success: true,
      userId: user.id,
      email: user.email,
      ip,
      userAgent,
    });

    res.json({ accessToken, user });
  } catch (error: any) {
    const isReuse =
      typeof error?.message === "string" &&
      error.message.toLowerCase().includes("reuse");

    await AuthAuditService.record({
      eventType: isReuse ? "refresh_reuse_detected" : "refresh_failed",
      success: false,
      ip,
      userAgent,
      details: { reason: "invalid_token" },
    });

    res.clearCookie("refreshToken", COOKIE_OPTIONS);
    return res.status(403).json({ error: "Invalid token" });
  }
};

export const logout = async (req: Request, res: Response) => {
  const tokenString = req.cookies.refreshToken;
  const { ip, userAgent } = getRequestMeta(req);
  if (tokenString) {
    try {
      const decoded = Buffer.from(tokenString, "base64").toString("utf-8");
      const [tokenId] = decoded.split(":");
      if (tokenId) {
        await query(
          "UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1",
          [tokenId]
        );
      }
    } catch (e) {}
  }

  await AuthAuditService.record({
    eventType: "logout",
    success: true,
    ip,
    userAgent,
  });

  res.clearCookie("refreshToken", COOKIE_OPTIONS);
  res.sendStatus(204);
};
