/**
 * @jest-environment jsdom
 */
import React from "react";
import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import App from "../../repository_after/client/src/App";

jest.useFakeTimers();

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  jest.clearAllMocks();
  jest.clearAllTimers();
});

/**
 * REQ-4: Reactive Participant Interface — purchase button: loading state during
 *        transaction; disabled when inventory is zero, user at personal cap (2),
 *        or raffle CLOSED; clear error feedback.
 */
describe("Purchase button", () => {
  it("is disabled when remaining tickets is 0", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/raffle/state")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "OPEN",
              remainingTickets: 0,
              userTicketCount: 0,
            }),
        });
      }
      return Promise.reject(new Error("unexpected"));
    }) as jest.Mock;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("purchase-button")).toBeDisabled();
    });
  });

  it("is disabled when user has 2 tickets", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/raffle/state")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "OPEN",
              remainingTickets: 50,
              userTicketCount: 2,
            }),
        });
      }
      return Promise.reject(new Error("unexpected"));
    }) as jest.Mock;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("purchase-button")).toBeDisabled();
    });
  });

  it("is disabled when status is CLOSED", async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes("/raffle/state")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "CLOSED",
              remainingTickets: 0,
              userTicketCount: 0,
            }),
        });
      }
      return Promise.reject(new Error("unexpected"));
    }) as jest.Mock;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("purchase-button")).toBeDisabled();
    });
  });

  it("shows loading state during purchase", async () => {
    let resolvePurchase: (value: unknown) => void;
    const purchasePromise = new Promise((resolve) => {
      resolvePurchase = resolve;
    });

    global.fetch = jest.fn((url: string, opts?: { method?: string }) => {
      if (url.includes("/raffle/state") && !opts?.method) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              status: "OPEN",
              remainingTickets: 100,
              userTicketCount: 0,
            }),
        });
      }
      if (url.includes("/purchase") && opts?.method === "POST") {
        return purchasePromise.then((data) => ({
          ok: true,
          json: () => Promise.resolve(data),
        }));
      }
      return Promise.reject(new Error("unexpected"));
    }) as jest.Mock;

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("purchase-button")).not.toBeDisabled();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("purchase-button"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("purchase-button")).toHaveTextContent(
        "Purchasing…",
      );
    });

    await act(async () => {
      (resolvePurchase! as (v: unknown) => void)({
        success: true,
        tickets: [
          { id: 1, userId: "test", createdAt: new Date().toISOString() },
        ],
        remaining: 99,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("purchase-button")).toHaveTextContent(
        "Purchase 1 ticket",
      );
    });
  });
});
