// Dynamic import based on TARGET_REPOSITORY environment variable
const targetRepo = process.env.TARGET_REPOSITORY || "repository_after";
const AuthService = require(`../${targetRepo}/authService`);

describe("AuthService Security Tests", () => {
  let auth;
  let fakeSession;

  beforeEach(() => {
    auth = new AuthService("supersecret");
    fakeSession = { regenerate: (cb) => cb() };
  });

  test("register normalizes email and hashes password", async () => {
    const res = await auth.register("User@Email.COM", "password123");
    expect(res.success).toBe(true);

    const stored = auth.users.get("user@email.com");
    expect(stored).toBeDefined();
    expect(stored.password).not.toBe("password123"); // should be hashed
  });

  test("login fails with invalid password without user enumeration", async () => {
    await auth.register("user@example.com", "secret");
    const res = await auth.login("user@example.com", "wrongpass", fakeSession);
    expect(res.error).toBe("Invalid email or password");
  });

  test("account locks after 5 failed attempts", async () => {
    await auth.register("user2@example.com", "secret");
    for (let i = 0; i < 5; i++) {
      await auth.login("user2@example.com", "wrong", fakeSession);
    }
    const res = await auth.login("user2@example.com", "secret", fakeSession);
    expect(res.error).toBe("Account locked. Try again later.");
  });

  test("reset token is secure and expires", async () => {
    await auth.register("user3@example.com", "secret");
    const { token } = auth.generateResetToken("user3@example.com");
    expect(token).toHaveLength(64); // 32 bytes hex

    // simulate expiration
    auth.resetTokens.get(token).expiresAt = Date.now() - 1000;
    const res = await auth.resetPassword(token, "newpass");
    expect(res.error).toBe("Invalid or expired reset token");
  });

  test("JWT verification works and rejects invalid token", async () => {
    await auth.register("user4@example.com", "secret");
    const { token } = await auth.login(
      "user4@example.com",
      "secret",
      fakeSession,
    );
    const valid = auth.verifyToken(token);
    expect(valid.valid).toBe(true);

    const invalid = auth.verifyToken(token + "tampered");
    expect(invalid.valid).toBe(false);
  });

  test("emails are case-insensitive", async () => {
    await auth.register("Case@Test.com", "pass");
    const loginRes = await auth.login("case@test.com", "pass", fakeSession);
    expect(loginRes.success).toBe(true);
  });
});
