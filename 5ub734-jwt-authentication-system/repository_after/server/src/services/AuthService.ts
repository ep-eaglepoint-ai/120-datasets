import bcrypt from "bcrypt";
import jwt, { Secret, SignOptions } from "jsonwebtoken";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { query } from "../db";
import { config } from "../config/env";

interface User {
  id: string;
  email: string;
  role: string;
}

export class AuthService {
  static generateAccessToken(user: User, sessionId: string): string {
    const payload = {
      sub: user.id,
      role: user.role,
      sid: sessionId,
    };

    const options: SignOptions = {
      algorithm: "RS256",
      expiresIn: config.jwt.accessExpiry as SignOptions["expiresIn"],
    };

    return jwt.sign(payload, config.jwt.privateKey as Secret, options);
  }

  static async generateRefreshToken(
    userId: string,
    familyId: string | null = null
  ) {
    const tokenId = uuidv4();
    const secret = crypto.randomBytes(32).toString("hex");
    const tokenString = Buffer.from(`${tokenId}:${secret}`).toString("base64");
    const tokenHash = await bcrypt.hash(secret, 12);
    const newFamilyId = familyId || uuidv4();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + config.jwt.refreshExpiryDays);

    await query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, family_id, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
      [tokenId, userId, tokenHash, newFamilyId, expiresAt]
    );

    return { tokenString, familyId: newFamilyId, expiresAt };
  }

  static async rotateRefreshToken(tokenString: string) {
    let tokenId: string, secret: string;
    try {
      const decoded = Buffer.from(tokenString, "base64").toString("utf-8");
      [tokenId, secret] = decoded.split(":");
      if (!tokenId || !secret) throw new Error();
    } catch {
      throw new Error("Invalid token format");
    }

    const result = await query("SELECT * FROM refresh_tokens WHERE id = $1", [
      tokenId,
    ]);
    if (result.rowCount === 0) throw new Error("Invalid token");

    const tokenRecord = result.rows[0];

    if (tokenRecord.is_revoked) {
      await query("DELETE FROM refresh_tokens WHERE family_id = $1", [
        tokenRecord.family_id,
      ]);
      throw new Error("Token reuse detected - Session terminated");
    }

    const isValid = await bcrypt.compare(secret, tokenRecord.token_hash);
    if (!isValid) throw new Error("Invalid token signature");

    if (new Date() > new Date(tokenRecord.expires_at)) {
      await query("DELETE FROM refresh_tokens WHERE id = $1", [tokenId]);
      throw new Error("Token expired");
    }

    await query("UPDATE refresh_tokens SET is_revoked = TRUE WHERE id = $1", [
      tokenId,
    ]);

    const newToken = await this.generateRefreshToken(
      tokenRecord.user_id,
      tokenRecord.family_id
    );
    const userRes = await query(
      "SELECT id, email, role FROM users WHERE id = $1",
      [tokenRecord.user_id]
    );

    return {
      accessToken: this.generateAccessToken(userRes.rows[0], newToken.familyId),
      refreshToken: newToken.tokenString,
      user: userRes.rows[0],
    };
  }
}
