# Trajectory: Securing AuthService

## 1. Audit the Original Code

Reviewed the original AuthService and identified critical security weaknesses: weak MD5 password hashing, insecure password comparison, JWT verification bypass via `jwt.decode`, session fixation risk, predictable reset tokens, lack of brute-force protection, user enumeration through distinct errors, and inconsistent email handling due to case-sensitivity.

> Reference: [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

## 2. Define a Security and Reliability Contract

Defined a contract: preserve API functionality and response formats while enforcing security best practices. Passwords must use strong hashing, sessions must not remain fixated, tokens must be properly verified, reset tokens must be unpredictable and ephemeral, login must be rate-limited, and error messages must avoid user enumeration.

> Reference: [Authentication Security Best Practices](https://clerk.com/articles/authentication-security-in-web-applications)

## 3. Replace Weak Hashing with Bcrypt

Replaced insecure MD5 hashing with bcrypt (cost factor 12), introducing salting and computational work that slows brute-force attackers.

> Reference: [Bcrypt Hashing Best Practices](https://moldstud.com/articles/p-avoiding-common-authentication-pitfalls-essential-tips-for-every-web-developer)

## 4. Harden Password Comparison

Used `bcrypt.compare` to prevent timing attacks where attackers infer password characters based on comparison time.

> Reference: [Timing Attack Explanation](https://docs.guardrails.io/docs/vulnerabilities/javascript/insecure_access_control)

## 5. Fix Session Fixation Vulnerability

Introduced `session.regenerate()` to issue a new session ID post-login, preventing session fixation attacks.

> Reference: [Session Fixation Countermeasures](https://en.wikipedia.org/wiki/Session_fixation)

## 6. Enforce Secure JWT Verification

Switched from `jwt.decode` to `jwt.verify()` with explicit HS256 algorithm to prevent forgery and algorithm confusion attacks.

> Reference: [JWT Specification and Risks](https://en.wikipedia.org/wiki/JSON_Web_Token)

## 7. Secure Password Reset Tokens

Replaced predictable reset tokens with cryptographically strong random tokens via `crypto.randomBytes(32)`.

> Reference: [OWASP Token Management](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#session-and-token-management)

## 8. Implement Rate Limiting and Brute-Force Protection

Added tracking of failed login attempts per email with account locking after 5 failures within 15 minutes.

> Reference: [Brute Force & Lockout Best Practices](https://clerk.com/articles/authentication-security-in-web-applications)

## 9. Standardize Error Messages and Normalize Emails

Unified login error messages to prevent user enumeration. Normalized emails to lowercase for case-insensitive account matching.

> Reference: [OWASP Authentication Responses](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#authentication-responses)

## 10. Validate Through Security-Focused Tests

Developed Jest test suite covering hashing integrity, indistinguishable login errors, brute-force lockout, secure reset token generation/expiry, JWT verification, and email normalization.

## 11. Result

Refactored AuthService preserves all API behaviors while improving security: secure hashing, timing-attack resistant comparisons, session fixation prevention, strict JWT verification, strong reset tokens, brute-force throttling, uniform error responses, and case-insensitive email handling.
