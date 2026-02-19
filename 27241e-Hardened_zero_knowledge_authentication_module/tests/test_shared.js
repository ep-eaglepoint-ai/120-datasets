/**
 * SHARED TEST LOGIC (Requirements-driven)
 *
 * Important: These tests are written against the REQUIREMENTS only.
 * They intentionally include "architecture" assertions that will fail for the legacy implementation.
 */
const fs = require("fs");

function readSource(modulePath) {
  return fs.readFileSync(modulePath, "utf8");
}

function expectNoSensitiveLogging(fn, { secret }) {
  const calls = [];
  const original = console.log;
  console.log = (...args) => {
    calls.push(args.map(String).join(" "));
  };

  return Promise.resolve()
    .then(fn)
    .finally(() => {
      console.log = original;
      const leaked = calls.some((line) => line.includes(secret));
      expect(leaked).toBe(false);
    });
}

function runUniversalTests({ authModule, modulePath }) {
  describe("Authentication module (requirements)", () => {
    const TEST_USER = `user_${Date.now()}_42`;
    const TEST_PASS = "SecurePass123!";
    const TEST_PASS_2 = "AnotherPass456!";

    test("1. Provides required public functions", () => {
      expect(typeof authModule.registerUser).toBe("function");
      expect(typeof authModule.authenticate).toBe("function");
    });

    test("2. Register works without throwing", async () => {
      await authModule.registerUser(TEST_USER, TEST_PASS);
    });

    test("3. Authenticate resolves true with correct credentials", async () => {
      await authModule.registerUser(TEST_USER, TEST_PASS);
      await expect(authModule.authenticate(TEST_USER, TEST_PASS)).resolves.toBe(true);
    });

    test("4. Authenticate resolves false for wrong password", async () => {
      await authModule.registerUser(TEST_USER, TEST_PASS);
      await expect(authModule.authenticate(TEST_USER, "WrongPass")).resolves.toBe(false);
    });

    test("5. Authenticate resolves false for unknown user", async () => {
      await expect(authModule.authenticate("ghost_user", TEST_PASS)).resolves.toBe(false);
    });

    test("6. authenticate() is async (Promise-returning)", async () => {
      // Requirement: "Implement zero-knowledge password storage using the SubtleCrypto API"
      // SubtleCrypto digest is async, so both operations should be Promise-based.
      await authModule.registerUser(TEST_USER, TEST_PASS);
      const authResult = authModule.authenticate(TEST_USER, TEST_PASS);
      expect(authResult).toBeInstanceOf(Promise);
      await expect(authResult).resolves.toBe(true);
    });

    test("7. registerUser() is async (Promise-returning)", async () => {
      const result = authModule.registerUser(TEST_USER, TEST_PASS);
      expect(result).toBeInstanceOf(Promise);
      await expect(result).resolves.toBeUndefined();
    });

    test("8. Module uses SubtleCrypto (source requirement)", () => {
      const src = readSource(modulePath);
      expect(src).toMatch(/crypto\.subtle\./);
    });

    test("9. Module uses an async crypto primitive (digest/importKey/deriveKey/deriveBits)", () => {
      const src = readSource(modulePath);
      expect(src).toMatch(/subtle\.(digest|importKey|deriveBits|deriveKey)\s*\(/);
    });

    test("10. Does not store plain-text passwords (source requirement)", () => {
      // Black-box storage inspection isn't available; enforce via requirement-oriented source checks.
      const src = readSource(modulePath);

      // Must not store plaintext password fields.
      // (Requirement-based: storing `password` as a property is disallowed.)
      expect(src).not.toMatch(/\bpassword\s*:\s*password\b/);
      expect(src).not.toMatch(/\bpassword\s*:\s*['"`]/);
    });

    test("11. User collection is managed with Map/Set (source requirement)", () => {
      const src = readSource(modulePath);

      // Positive requirement: Map or Set.
      expect(src).toMatch(/\bnew\s+(Map|Set)\s*\(/);
    });

    test("12. User collection is not managed with arrays (source requirement)", () => {
      const src = readSource(modulePath);

      // Negative requirement: do not manage users with arrays.
      // (Allow array-like usage for typed arrays / Uint8Array and function arguments.)
      expect(src).not.toMatch(/\bnew\s+Array\s*\(/);
      expect(src).not.toMatch(/\bconst\s+\w+\s*=\s*\[\s*\]\s*;?/); // e.g. const USERS = [];
      expect(src).not.toMatch(/\bpush\s*\(/);
    });

    test("13. Uses Object.create(null) for user records (prototype pollution defense)", () => {
      const src = readSource(modulePath);

      // Requirement: "Use Object.create(null) for all objects" + immutability.
      // Interpreted as: user records must be created with a null prototype and made immutable.
      expect(src).toMatch(/Object\.create\s*\(\s*null\s*\)/);
    });

    test("14. User records are immutable (Object.freeze)", () => {
      const src = readSource(modulePath);
      expect(src).toMatch(/Object\.freeze\s*\(/);
    });

    test("15. Authentication uses constant-time comparison (source requirement)", () => {
      const src = readSource(modulePath);

      // Requirement: constant-time comparison to prevent timing attacks.
      // Enforce that a constant-time style compare is present and used.
      // (Implementation-agnostic: accept either a custom XOR-accumulator loop or Node's timingSafeEqual.)
      const hasXorAccumulator =
        /\|\=/.test(src) && /\^/.test(src) && /for\s*\(\s*let\s+\w+\s*=/.test(src);
      const hasTimingSafeEqual = /\btimingSafeEqual\s*\(/.test(src);

      expect(hasXorAccumulator || hasTimingSafeEqual).toBe(true);
    });

    test("16. Does not do direct string password equality checks (source requirement)", () => {
      const src = readSource(modulePath);

      // Also ensure we don't do direct plaintext string password compare in authenticate.
      expect(src).not.toMatch(/password\s*===\s*/);
      expect(src).not.toMatch(/===\s*password\b/);
    });

    test("17. Logs registration/auth events without exposing the password (runtime)", async () => {
      await expectNoSensitiveLogging(
        async () => {
          await authModule.registerUser(TEST_USER, TEST_PASS);
          await authModule.authenticate(TEST_USER, TEST_PASS);
          await authModule.authenticate(TEST_USER, "WrongPass");
        },
        { secret: TEST_PASS }
      );
    });

    test("18. Logging does not mention 'password' or 'hash' literals (source requirement)", () => {
      const src = readSource(modulePath);
      // Requirement: safe logging without exposing sensitive data.
      // Guardrail: logs should not explicitly log password/hash fields.
      const logLines = src
        .split("\n")
        .filter((line) => line.includes("console.log"))
        .join("\n");
      expect(logLines).not.toMatch(/\bpassword\b/i);
      expect(logLines).not.toMatch(/\bhash\b/i);
      expect(logLines).not.toMatch(/\bsalt\b/i);
    });

    test("19. Multiple users authenticate independently (functional requirement)", async () => {
      const u1 = `user_${Date.now()}_a`;
      const u2 = `user_${Date.now()}_b`;
      await authModule.registerUser(u1, TEST_PASS);
      await authModule.registerUser(u2, TEST_PASS_2);

      await expect(authModule.authenticate(u1, TEST_PASS)).resolves.toBe(true);
      await expect(authModule.authenticate(u2, TEST_PASS_2)).resolves.toBe(true);

      await expect(authModule.authenticate(u1, TEST_PASS_2)).resolves.toBe(false);
      await expect(authModule.authenticate(u2, TEST_PASS)).resolves.toBe(false);
    });

    test("20. Public API does not return sensitive material from registerUser/authenticate", async () => {
      const regResult = await authModule.registerUser(TEST_USER, TEST_PASS);
      expect(regResult).toBeUndefined();

      const authResult = await authModule.authenticate(TEST_USER, TEST_PASS);
      expect(typeof authResult).toBe("boolean");
    });
  });
}

module.exports = { runUniversalTests };
