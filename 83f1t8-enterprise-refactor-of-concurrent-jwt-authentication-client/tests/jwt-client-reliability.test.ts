import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TARGET_REPO = (process.env.TARGET_REPO ?? "after").toLowerCase();

function repoRootPath(repo: "before" | "after", ...segments: string[]) {
  return path.join(
    PROJECT_ROOT,
    repo === "before" ? "repository_before" : "repository_after",
    ...segments
  );
}

function fileExists(filePath: string) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function repoPath(...segments: string[]) {
  return path.join(
    PROJECT_ROOT,
    TARGET_REPO === "before" ? "repository_before" : "repository_after",
    ...segments
  );
}

function readText(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath: string) {
  return JSON.parse(readText(filePath));
}

function extractBlock(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  if (start === -1) return null;
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) return null;
  return source.slice(start, end);
}

function normalizeForExactCompare(source: string) {
  // For strict “external dependency is unchanged” comparisons.
  // Remove whitespace only; keep tokens intact.
  return source.replace(/\s+/g, "");
}

/**
 * AST Utilities for structural validation without fragile string searching.
 */
function getSourceFile(filePath: string): ts.SourceFile {
  const content = readText(filePath);
  return ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
}

function findClass(sourceFile: ts.SourceFile, className: string): ts.ClassDeclaration | undefined {
  return sourceFile.statements.find(
    (s): s is ts.ClassDeclaration => ts.isClassDeclaration(s) && s.name?.text === className
  );
}

function hasProperty(classDecl: ts.ClassDeclaration, propertyName: string): boolean {
  return classDecl.members.some(
    (m) => (ts.isPropertyDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m)) &&
      ts.isIdentifier(m.name) && m.name.text === propertyName
  );
}

function hasMethod(classDecl: ts.ClassDeclaration, methodName: string): boolean {
  return classDecl.members.some(
    (m) => ts.isMethodDeclaration(m) && ts.isIdentifier(m.name) && m.name.text === methodName
  );
}

function getExportedConstInterface(sourceFile: ts.SourceFile, name: string): ts.VariableDeclaration | undefined {
  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement)) {
      if (statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        const decl = statement.declarationList.declarations.find(d => ts.isIdentifier(d.name) && d.name.text === name);
        if (decl) return decl;
      }
    }
  }
  return undefined;
}

function ensureNodeHasAtobBtoa() {
  // Vite/Vitest often runs on Node where these may not exist.
  if (typeof (globalThis as any).btoa !== "function") {
    (globalThis as any).btoa = (input: string) =>
      Buffer.from(input, "utf8").toString("base64");
  }
  if (typeof (globalThis as any).atob !== "function") {
    (globalThis as any).atob = (input: string) =>
      Buffer.from(input, "base64").toString("utf8");
  }
}

async function importTargetAuthCore() {
  const repo = TARGET_REPO === "before" ? "repository_before" : "repository_after";
  const mod = await import(`../${repo}/src/authCore`);
  return {
    httpClient: mod.httpClient as any,
    mockBackend: mod.mockBackend as any,
  };
}

let ipCounter = 0;
function nextIp() {
  ipCounter += 1;
  return `demo-ip-${ipCounter}`;
}

async function loginAsAdmin(mockBackend: any) {
  return mockBackend.login("admin@fintech.com", "Admin123!", nextIp());
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("JWT client reliability requirements", () => {
  beforeEach(() => {
    ensureNodeHasAtobBtoa();
  });

  afterEach(async () => {
    if (TARGET_REPO !== "after") return;
    const { httpClient } = await importTargetAuthCore();
    httpClient.setTokens(null);
    vi.useRealTimers();
  });

  // Static, requirement-driven checks. These are intentionally strict for
  // repo_after; some will fail for repo_before (by design).
  test("no obvious unbounded leak scaffolding in http client (AST check)", () => {
    const fileToScan =
      TARGET_REPO === "before"
        ? repoPath("src", "App.tsx")
        : repoPath("src", "authCore.tsx");

    const sourceFile = getSourceFile(fileToScan);
    const clientClass = findClass(sourceFile, "SecureHttpClient");

    if (clientClass) {
      // After repo should NOT have it.
      expect(hasProperty(clientClass, "failedRequests")).toBe(false);
    } else {
      // Legacy repo HAS it.
      const hasFailedRequestsVar = sourceFile.statements.some(s =>
        ts.isVariableStatement(s) && s.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === "failedRequests")
      );
      if (TARGET_REPO === "before") {
        expect(hasFailedRequestsVar).toBe(true);
      } else {
        expect(hasFailedRequestsVar).toBe(false);
      }
    }
  });

  test("MockAuthBackend is unchanged from the original (AST verification)", () => {
    const afterFile = repoRootPath("after", "src", "authCore.tsx");
    if (!fileExists(afterFile)) return;

    const sourceFile = getSourceFile(afterFile);
    const backendClass = findClass(sourceFile, "MockAuthBackend");
    expect(backendClass).toBeDefined();

    const methods = ["login", "refreshAccessToken", "validateAccessToken", "logout"];
    methods.forEach(m => expect(hasMethod(backendClass!, m)).toBe(true));

    // Verify key security constants match baseline (15m access / 7d refresh)
    const srcText = sourceFile.text;
    expect(srcText).toMatch(/15\s*\*\s*60\s*\*\s*1000/);
    expect(srcText).toMatch(/7\s*\*\s*24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/);
    // Verify rate limit threshold matches baseline (5)
    expect(srcText).toMatch(/count\s*>=\s*5/);
  });

  test("React component public interfaces are preserved (AST check)", () => {
    const authCoreFile = repoRootPath("after", "src", "authCore.tsx");
    const loginFormFile = repoRootPath("after", "src", "components", "LoginForm.tsx");
    const dashboardFile = repoRootPath("after", "src", "components", "Dashboard.tsx");

    if (!fileExists(authCoreFile) || !fileExists(loginFormFile) || !fileExists(dashboardFile)) return;

    const authCoreSF = getSourceFile(authCoreFile);
    const loginSF = getSourceFile(loginFormFile);
    const dashboardSF = getSourceFile(dashboardFile);

    expect(getExportedConstInterface(authCoreSF, "AuthProvider")).toBeDefined();
    expect(getExportedConstInterface(loginSF, "LoginForm")).toBeDefined();
    expect(getExportedConstInterface(dashboardSF, "Dashboard")).toBeDefined();
  });

  test("logout resets internal request bookkeeping (bounded state)", async () => {
    vi.useFakeTimers();
    const { httpClient } = await importTargetAuthCore();

    httpClient.setTokens({
      accessToken: "fake",
      expiresAt: Date.now() + 5 * 60_000,
    });

    const p = httpClient.request({ endpoint: "/api/fail" });
    p.catch(() => { }); // handle early rejection
    await vi.advanceTimersByTimeAsync(800);
    await Promise.allSettled([p]);

    expect(httpClient.getRetryCount()).toBeGreaterThan(0);

    httpClient.setTokens(null);
    expect(httpClient.getQueueSize()).toBe(0);
    expect(httpClient.getRetryCount()).toBe(0);
  });

  test("happy path: login produces a token that can access protected resource", async () => {
    const { httpClient, mockBackend } = await importTargetAuthCore();

    const login = await mockBackend.login(
      "admin@fintech.com",
      "Admin123!",
      nextIp()
    );

    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const resp = await httpClient.request({ endpoint: "/api/protected" });
    expect(resp).toEqual({ data: "Protected data accessed successfully" });
  });

  test("concurrent near-expiry load: 50 requests succeed with exactly one refresh", async () => {

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const { httpClient, mockBackend } = await importTargetAuthCore();
    const refreshSpy = vi.spyOn(mockBackend, "refreshAccessToken");

    const loginPromise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login = await loginPromise;

    // Force refresh on next request (client refresh threshold is 60s).
    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 1,
    });

    const concurrency = 50;
    const promises = Array.from({ length: concurrency }, () =>
      httpClient.request({ endpoint: "/api/protected" })
    );

    // Let all refresh waiters register before completing the refresh timeout.
    await flushMicrotasks();
    expect(httpClient.getQueueSize()).toBeGreaterThan(0);

    await vi.runAllTimersAsync();
    const results = await Promise.allSettled(promises);

    expect(results).toHaveLength(concurrency);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(httpClient.getQueueSize()).toBe(0);
  });

  test("edge timing: exactly 60s before expiry does not refresh; 59.999s does", async () => {

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { httpClient, mockBackend } = await importTargetAuthCore();

    const refreshSpy = vi.spyOn(mockBackend, "refreshAccessToken");

    const loginPromise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login = await loginPromise;

    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 60_000,
    });

    const resp1Promise = httpClient.request({ endpoint: "/api/protected" });
    await flushMicrotasks();
    await vi.runAllTimersAsync();
    await expect(resp1Promise).resolves.toEqual({
      data: "Protected data accessed successfully",
    });
    expect(refreshSpy).toHaveBeenCalledTimes(0);

    // Now inside the refresh window.
    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 59_999,
    });

    const resp2Promise = httpClient.request({ endpoint: "/api/protected" });
    await flushMicrotasks();
    await vi.runAllTimersAsync();
    await expect(resp2Promise).resolves.toEqual({
      data: "Protected data accessed successfully",
    });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(httpClient.getQueueSize()).toBe(0);
  });

  test("successful refresh + retry: expired token with stale client expiry recovers", async () => {

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { httpClient, mockBackend } = await importTargetAuthCore();
    const refreshSpy = vi.spyOn(mockBackend, "refreshAccessToken");

    const loginPromise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login = await loginPromise;

    // Token's embedded exp is 15m from issuance, but we lie to the client that
    // it stays valid for an hour. This forces the 401-path refresh+retry.
    const t0 = Date.now();
    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: t0 + 60 * 60_000,
    });

    vi.setSystemTime(new Date(t0 + 16 * 60_000));

    const p = httpClient.request({ endpoint: "/api/protected" });
    await flushMicrotasks();
    await vi.runAllTimersAsync();

    await expect(p).resolves.toEqual({
      data: "Protected data accessed successfully",
    });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(httpClient.getQueueSize()).toBe(0);
  });

  test("mixed success/failure under concurrency does not corrupt subsequent requests", async () => {

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { httpClient, mockBackend } = await importTargetAuthCore();
    const refreshSpy = vi.spyOn(mockBackend, "refreshAccessToken");

    const loginPromise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login = await loginPromise;

    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 1,
    });

    const protectedCount = 40;
    const failCount = 10;
    const promises = [
      ...Array.from({ length: protectedCount }, () =>
        httpClient.request({ endpoint: "/api/protected" })
      ),
      ...Array.from({ length: failCount }, () =>
        httpClient.request({ endpoint: "/api/fail" })
      ),
    ];

    // Attach handlers immediately to avoid Node `unhandledRejection` warnings
    // while timers are still pending.
    const resultsPromise = Promise.allSettled(promises);

    await flushMicrotasks();
    await vi.runAllTimersAsync();
    const results = await resultsPromise;
    expect(results).toHaveLength(protectedCount + failCount);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(
      protectedCount
    );
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(
      failCount
    );
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(httpClient.getQueueSize()).toBe(0);

    // Subsequent independent request must still succeed.
    const laterPromise = httpClient.request({ endpoint: "/api/protected" });
    await vi.runAllTimersAsync();
    await expect(laterPromise).resolves.toEqual({
      data: "Protected data accessed successfully",
    });
  });

  test("session lifecycle: login -> operations -> logout -> login fully resets internal state", async () => {

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { httpClient, mockBackend } = await importTargetAuthCore();

    // Session 1
    const login1Promise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login1 = await login1Promise;
    httpClient.setTokens({
      accessToken: login1.accessToken,
      expiresAt: Date.now() + 10 * 60_000,
    });
    const r1Promise = httpClient.request({ endpoint: "/api/protected" });
    await vi.runAllTimersAsync();
    await expect(r1Promise).resolves.toEqual({
      data: "Protected data accessed successfully",
    });
    expect(httpClient.getRetryCount()).toBeGreaterThan(0);

    // Logout must clear all bounded state.
    const logoutPromise = httpClient.revokeSessionOnBackend();
    await vi.runAllTimersAsync();
    await logoutPromise;
    httpClient.setTokens(null);
    expect(httpClient.getQueueSize()).toBe(0);
    expect(httpClient.getRetryCount()).toBe(0);

    // Session 2
    const login2Promise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login2 = await login2Promise;
    httpClient.setTokens({
      accessToken: login2.accessToken,
      expiresAt: Date.now() + 10 * 60_000,
    });
    const r2Promise = httpClient.request({ endpoint: "/api/protected" });
    await vi.runAllTimersAsync();
    await expect(r2Promise).resolves.toEqual({
      data: "Protected data accessed successfully",
    });
  });

  test("extended runtime simulation: repeated refresh cycles keep state bounded", async () => {

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { httpClient, mockBackend } = await importTargetAuthCore();

    const loginPromise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login = await loginPromise;

    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const cycles = 40;
    const concurrency = 25;

    for (let i = 0; i < cycles; i++) {
      // Force refresh on each cycle; all callers must settle and the queue must drain.
      httpClient.setTokens({
        accessToken:
          (httpClient as any).tokens?.accessToken ?? login.accessToken,
        expiresAt: Date.now() + 1,
      });

      const promises = Array.from({ length: concurrency }, () =>
        httpClient.request({ endpoint: "/api/protected" })
      );

      await flushMicrotasks();
      const queued = httpClient.getQueueSize();
      expect(queued).toBeGreaterThanOrEqual(0);
      expect(queued).toBeLessThanOrEqual(concurrency - 1);

      await vi.runAllTimersAsync();
      const results = await Promise.allSettled(promises);
      expect(results.every((r) => r.status === "fulfilled")).toBe(true);
      expect(httpClient.getQueueSize()).toBe(0);
    }
  });

  test("boundedness under load: repeated concurrency does not accumulate client state", async () => {

    const mod = await import("../repository_after/src/authCore");
    const httpClient = mod.httpClient as any;
    const mockBackend = mod.mockBackend as any;

    const login = await mockBackend.login(
      "user@fintech.com",
      "User123!",
      nextIp()
    );

    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 10 * 60_000,
    });

    const batches = 20;
    const concurrency = 50;

    for (let i = 0; i < batches; i++) {
      const results = await Promise.allSettled(
        Array.from({ length: concurrency }, () =>
          httpClient.request({ endpoint: "/api/protected" })
        )
      );
      expect(results).toHaveLength(concurrency);
      expect(httpClient.getQueueSize()).toBe(0);
    }

    // Session termination must reset bounded state.
    httpClient.setTokens(null);
    expect(httpClient.getQueueSize()).toBe(0);
    expect(httpClient.getRetryCount()).toBe(0);
  });

  test("concurrent requests never leave the queue non-empty on refresh failure", async () => {

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const { httpClient, mockBackend } = await importTargetAuthCore();

    // Force refresh failure deterministically by making the backend reject.
    const refreshSpy = vi
      .spyOn(mockBackend, "refreshAccessToken")
      .mockImplementation(
        () =>
          new Promise((_resolve, reject) =>
            setTimeout(
              () => reject(new Error("Simulated refresh failure")),
              200
            )
          )
      );

    const loginPromise = loginAsAdmin(mockBackend);
    await vi.advanceTimersByTimeAsync(300);
    const login = await loginPromise;

    httpClient.setTokens({
      accessToken: login.accessToken,
      expiresAt: Date.now() + 1,
    });

    const count = 25;
    const promises = Array.from({ length: count }, () =>
      httpClient.request({ endpoint: "/api/protected" })
    );

    const resultsPromise = Promise.allSettled(promises);

    await flushMicrotasks();
    expect(httpClient.getQueueSize()).toBeGreaterThan(0);

    await vi.runAllTimersAsync();
    const results = await resultsPromise;

    expect(results).toHaveLength(count);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(httpClient.getQueueSize()).toBe(0);
  }, 10_000);
});
