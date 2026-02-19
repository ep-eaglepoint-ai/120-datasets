// Implement your security fixes here
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

class AuthService {
  constructor(secret) {
    this.secret = secret;
    this.users = new Map();
    this.resetTokens = new Map();
    this.failedLoginAttempts = new Map();
  }

  normalizeEmail(email) {
    return email.trim().toLowerCase();
  }

  async register(email, password) {
    email = this.normalizeEmail(email);
    if (this.users.has(email)) {
      return { error: "User already exists" };
    }

    const hash = await bcrypt.hash(password, 12);

    this.users.set(email, {
      email,
      password: hash,
      createdAt: new Date(),
    });

    return { success: true, message: "User registered" };
  }

  async login(email, password, session) {
    email = this.normalizeEmail(email);
    const user = this.users.get(email);

    // using the same error message for both cases to prevent user enumeration
    const invalidMsg = { error: "Invalid email or password" };

    // Rate limiting / brute-force checks
    const now = Date.now();
    const attempt = this.failedLoginAttempts.get(email) || {
      count: 0,
      firstAttempt: now,
      lockedUntil: null,
    };

    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      return { error: "Account locked. Try again later." };
    }

    if (!user) {
      return invalidMsg;
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      // increment failed attempts
      if (now - attempt.firstAttempt > 15 * 60 * 1000) {
        // reset after 15 minutes
        attempt.count = 1;
        attempt.firstAttempt = now;
      } else {
        attempt.count += 1;
        if (attempt.count >= 5) {
          attempt.lockedUntil = now + 15 * 60 * 1000; // lock 15 minutes
        }
      }
      this.failedLoginAttempts.set(email, attempt);
      return invalidMsg;
    }

    this.failedLoginAttempts.delete(email);

    // Session fixation prevention
    if (typeof session.regenerate === "function") {
      await new Promise((resolve) => session.regenerate(resolve));
    }

    session.userId = email;
    session.loggedInAt = Date.now();

    const token = jwt.sign(
      { email, iat: Math.floor(Date.now() / 1000) },
      this.secret,
      { expiresIn: "24h", algorithm: "HS256" },
    );

    return { success: true, token };
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ["HS256"] });
      return { valid: true, user: decoded };
    } catch (error) {
      return { valid: false, error: "Token verification failed" };
    }
  }

  generateResetToken(email) {
    email = this.normalizeEmail(email);
    if (!this.users.has(email)) {
      return { error: "Invalid email or password" }; // prevent enumeration
    }

    const token = crypto.randomBytes(32).toString("hex");

    this.resetTokens.set(token, {
      email,
      createdAt: Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    });

    return { success: true, token };
  }

  async resetPassword(token, newPassword) {
    const resetData = this.resetTokens.get(token);

    if (!resetData || Date.now() > resetData.expiresAt) {
      this.resetTokens.delete(token);
      return { error: "Invalid or expired reset token" };
    }

    const user = this.users.get(resetData.email);
    if (!user) {
      this.resetTokens.delete(token);
      return { error: "Invalid or expired reset token" };
    }

    const hash = await bcrypt.hash(newPassword, 12);
    user.password = hash;
    this.resetTokens.delete(token);

    return { success: true, message: "Password reset successful" };
  }

  logout(session) {
    session.userId = null;
    session.loggedInAt = null;
    return { success: true };
  }

  getUser(email) {
    email = this.normalizeEmail(email);
    const user = this.users.get(email);
    if (!user) return null;

    return {
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}

module.exports = AuthService;
