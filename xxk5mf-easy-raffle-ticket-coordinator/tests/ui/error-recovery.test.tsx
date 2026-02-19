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
 * REQ-7: Error handling — React shows a descriptive error toast and re-enables
 *        the purchase button when server transaction fails (e.g. 409) or network timeout.
 */
describe("Error recovery", () => {
  it("shows error toast and re-enables button when purchase fails with 409", async () => {
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
        return Promise.resolve({
          ok: false,
          status: 409,
          json: () =>
            Promise.resolve({ success: false, error: "Limit Reached" }),
        });
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
      const toast = screen.getByTestId("error-toast");
      expect(toast).toHaveTextContent("Limit Reached");
      expect(toast).toHaveAttribute("role", "alert");
    });

    await waitFor(() => {
      const btn = screen.getByTestId("purchase-button");
      expect(btn).not.toHaveTextContent("Purchasing…");
      expect(btn).not.toBeDisabled();
    });
  });

  it("shows error toast and re-enables button when purchase fails due to network timeout (REQ-7)", async () => {
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
        return Promise.reject(new Error("Network timeout"));
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
      const toast = screen.getByTestId("error-toast");
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent("Network timeout");
      expect(toast).toHaveAttribute("role", "alert");
    });

    await waitFor(() => {
      const btn = screen.getByTestId("purchase-button");
      expect(btn).not.toHaveTextContent("Purchasing…");
      expect(btn).not.toBeDisabled();
    });
  });
});
