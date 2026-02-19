import type { AxiosRequestConfig } from "axios";

let responseRejected: any;
let postMock: jest.Mock;
let requestMock: jest.Mock;

jest.mock("axios", () => {
  const create = jest.fn(() => {
    // axios instances are callable and also have methods.
    const instance: any = (requestMock = jest.fn(
      (_config: AxiosRequestConfig) => Promise.resolve({ data: { ok: true } })
    ));

    postMock = jest.fn();
    instance.post = postMock;

    instance.defaults = { headers: { common: {} as Record<string, string> } };
    instance.interceptors = {
      response: {
        use: jest.fn((_onFulfilled: any, onRejected: any) => {
          responseRejected = onRejected;
          return 0;
        }),
      },
    };

    return instance;
  });

  return {
    __esModule: true,
    default: { create },
    create,
  };
});

describe("Frontend Integration: axios interceptor", () => {
  beforeEach(() => {
    jest.resetModules();
    responseRejected = undefined;
    postMock = undefined as any;
    requestMock = undefined as any;
  });

  it("refreshes on 401, retries request, and emits tokenRefreshed", async () => {
    const tokenEvents: string[] = [];
    const onToken = (e: any) => tokenEvents.push(e.detail);
    window.addEventListener("tokenRefreshed", onToken);

    const api = (await import("@client/api/axios")).default as any;

    expect(typeof responseRejected).toBe("function");

    let resolveRefresh: (v: any) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const req1: any = { headers: {} };
    const req2: any = { headers: {} };

    const p1 = responseRejected({ response: { status: 401 }, config: req1 });
    const p2 = responseRejected({ response: { status: 401 }, config: req2 });

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith("/auth/refresh");

    resolveRefresh!({ data: { accessToken: "new-access" } });

    await Promise.all([p1, p2]);

    expect(api.defaults.headers.common["Authorization"]).toBe(
      "Bearer new-access"
    );
    expect(req1.headers["Authorization"]).toBe("Bearer new-access");
    expect(req2.headers["Authorization"]).toBe("Bearer new-access");

    expect(requestMock).toHaveBeenCalledTimes(2);
    expect(tokenEvents).toEqual(["new-access"]);

    window.removeEventListener("tokenRefreshed", onToken);
  });

  it("queues concurrent 401s and does not call refresh twice", async () => {
    const api = (await import("@client/api/axios")).default as any;
    expect(typeof responseRejected).toBe("function");

    let resolveRefresh: (v: any) => void;
    postMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        })
    );

    const req1: any = { headers: {} };
    const req2: any = { headers: {} };
    const req3: any = { headers: {} };

    const p1 = responseRejected({ response: { status: 401 }, config: req1 });
    const p2 = responseRejected({ response: { status: 401 }, config: req2 });
    const p3 = responseRejected({ response: { status: 401 }, config: req3 });

    expect(postMock).toHaveBeenCalledTimes(1);

    resolveRefresh!({ data: { accessToken: "rotated" } });

    await Promise.all([p1, p2, p3]);

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(api.defaults.headers.common["Authorization"]).toBe("Bearer rotated");
    expect(requestMock).toHaveBeenCalledTimes(3);
  });

  it("prevents infinite loops when request already retried", async () => {
    await import("@client/api/axios");
    expect(typeof responseRejected).toBe("function");

    const req: any = { headers: {}, _retry: true };
    await expect(
      responseRejected({ response: { status: 401 }, config: req })
    ).rejects.toBeDefined();

    expect(postMock).not.toHaveBeenCalled();
  });

  it("dispatches authLogout when refresh fails", async () => {
    const logoutEvents: number[] = [];
    const onLogout = () => logoutEvents.push(1);
    window.addEventListener("authLogout", onLogout);

    await import("@client/api/axios");
    expect(typeof responseRejected).toBe("function");

    postMock.mockRejectedValueOnce(new Error("refresh failed"));

    const req: any = { headers: {} };
    await expect(
      responseRejected({ response: { status: 401 }, config: req })
    ).rejects.toBeDefined();

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(logoutEvents.length).toBe(1);

    window.removeEventListener("authLogout", onLogout);
  });
});
