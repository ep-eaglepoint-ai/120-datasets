import request from "supertest";
import app from "@server/app";
import * as db from "@server/db";
import bcrypt from "bcrypt";

// Mock the Database Module
jest.mock("@server/db");

describe("Backend Integration: Auth Controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("hashes passwords with bcrypt cost >= 12 and returns tokens", async () => {
      const hashSpy = jest
        .spyOn(bcrypt as any, "hash")
        .mockImplementation(
          async () =>
            "$2b$12$aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        );

      (db.query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("auth_audit_events")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("SELECT id FROM users")) {
          return Promise.resolve({ rowCount: 0, rows: [] });
        }
        if (sql.includes("INSERT INTO users")) {
          return Promise.resolve({
            rowCount: 1,
            rows: [{ id: "uuid-123", email: "test@example.com", role: "user" }],
          });
        }
        if (sql.includes("INSERT INTO refresh_tokens")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      const res = await request(app)
        .post("/api/auth/register")
        .set("X-Forwarded-For", "10.0.0.11")
        .send({ email: "test@example.com", password: "password123" });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.headers["set-cookie"]).toBeDefined();

      const costArg = (hashSpy.mock.calls[0] as any[])[1];
      expect(typeof costArg).toBe("number");
      expect(costArg).toBeGreaterThanOrEqual(12);

      hashSpy.mockRestore();
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns 200 and token on success", async () => {
      const mockUser = {
        id: "uuid-123",
        email: "test@example.com",
        password_hash: await bcrypt.hash("password123", 12),
        role: "user",
      };

      (db.query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("auth_audit_events")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("SELECT * FROM users")) {
          return Promise.resolve({ rowCount: 1, rows: [mockUser] });
        }
        if (sql.includes("INSERT INTO refresh_tokens")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "10.0.0.12")
        .send({ email: "test@example.com", password: "password123" });

      // If this fails with 500, the server crashed (likely JWT signing)
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("returns 401 on bad password", async () => {
      const mockUser = {
        id: "uuid-123",
        email: "test@example.com",
        password_hash: await bcrypt.hash("realpass", 12),
        role: "user",
      };

      (db.query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("auth_audit_events")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("SELECT * FROM users")) {
          return Promise.resolve({ rowCount: 1, rows: [mockUser] });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      const res = await request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", "10.0.0.13")
        .send({ email: "test@example.com", password: "wrongpass" });

      expect(res.status).toBe(401);
    });

    it("returns 429 after too many attempts", async () => {
      const mockUser = {
        id: "uuid-123",
        email: "test@example.com",
        password_hash: await bcrypt.hash("password123", 12),
        role: "user",
      };

      (db.query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("auth_audit_events")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("SELECT * FROM users")) {
          return Promise.resolve({ rowCount: 1, rows: [mockUser] });
        }
        if (sql.includes("INSERT INTO refresh_tokens")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      });

      const ip = "10.0.0.99";
      const attempts: number[] = [];

      for (let i = 0; i < 6; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .set("X-Forwarded-For", ip)
          .send({ email: "test@example.com", password: "password123" });
        attempts.push(res.status);
      }

      expect(attempts.slice(0, 5).every((s) => s === 200)).toBe(true);
      expect(attempts[5]).toBe(429);
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("rotates refresh token and returns new access token", async () => {
      const tokenId = "token-uuid-123";
      const secret = "refresh-secret";
      const tokenHash = await bcrypt.hash(secret, 12);
      const tokenString = Buffer.from(`${tokenId}:${secret}`).toString(
        "base64"
      );

      (db.query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("auth_audit_events")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("SELECT * FROM refresh_tokens")) {
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                id: tokenId,
                user_id: "uuid-123",
                token_hash: tokenHash,
                family_id: "family-uuid-1",
                is_revoked: false,
                expires_at: new Date(Date.now() + 60_000).toISOString(),
              },
            ],
          });
        }
        if (sql.includes("UPDATE refresh_tokens")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("INSERT INTO refresh_tokens")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("SELECT id, email, role FROM users")) {
          return Promise.resolve({
            rowCount: 1,
            rows: [{ id: "uuid-123", email: "test@example.com", role: "user" }],
          });
        }
        return Promise.resolve({ rowCount: 0, rows: [] });
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("X-Forwarded-For", "10.0.0.21")
        .set("Cookie", [`refreshToken=${tokenString}`]);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("accessToken");
      expect(res.body).toHaveProperty("user");
      expect(res.headers["set-cookie"]).toBeDefined();
    });

    it("detects reuse and invalidates session family", async () => {
      const tokenId = "token-uuid-reused";
      const tokenString = Buffer.from(`${tokenId}:whatever`).toString("base64");

      (db.query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("auth_audit_events")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        if (sql.includes("SELECT * FROM refresh_tokens")) {
          return Promise.resolve({
            rowCount: 1,
            rows: [
              {
                id: tokenId,
                user_id: "uuid-123",
                family_id: "family-uuid-reused",
                is_revoked: true,
                token_hash: "does-not-matter",
                expires_at: new Date(Date.now() + 60_000).toISOString(),
              },
            ],
          });
        }
        if (sql.includes("DELETE FROM refresh_tokens")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .set("X-Forwarded-For", "10.0.0.22")
        .set("Cookie", [`refreshToken=${tokenString}`]);

      expect(res.status).toBe(403);
      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/DELETE FROM refresh_tokens/),
        expect.any(Array)
      );
      expect(
        (JSON.stringify(res.headers["set-cookie"]) || "").toLowerCase()
      ).toMatch(/refreshtoken/);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears cookie and revokes token in DB", async () => {
      (db.query as jest.Mock).mockImplementation((sql: string) => {
        if (sql.includes("auth_audit_events")) {
          return Promise.resolve({ rowCount: 1, rows: [] });
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      });

      // Create a fake refresh token string: base64(id:secret)
      const fakeTokenId = "token-uuid-123";
      const fakeTokenStr = Buffer.from(`${fakeTokenId}:some-secret`).toString(
        "base64"
      );

      const res = await request(app)
        .post("/api/auth/logout")
        .set("X-Forwarded-For", "10.0.0.31")
        .set("Cookie", [`refreshToken=${fakeTokenStr}`]);

      expect(res.status).toBe(204);

      // Verify Cookie is cleared (Max-Age=0 or expires in past)
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      expect(JSON.stringify(cookies)).toMatch(/Expires|Max-Age=0/);

      // Verify DB was called to revoke the specific token ID
      expect(db.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE refresh_tokens/),
        expect.arrayContaining([fakeTokenId])
      );
    });
  });
});
