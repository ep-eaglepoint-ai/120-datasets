/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../../repository_after/client/src/App";

jest.useFakeTimers();

const mockFetch = (data: unknown) => {
  return jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    }),
  ) as jest.Mock;
};

beforeEach(() => {
  window.history.replaceState({}, "", "/");
  jest.clearAllMocks();
  jest.clearAllTimers();
});

/**
 * REQ-4: Reactive Participant Interface — dashboard displays tickets remaining
 *        (count down from 100), purchase button, and winner when CLOSED.
 */
describe("Dashboard", () => {
  it("displays remaining tickets and user ticket count", async () => {
    global.fetch = mockFetch({
      status: "OPEN",
      remainingTickets: 99,
      userTicketCount: 1,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("remaining-tickets")).toHaveTextContent("99");
    });
    expect(screen.getByTestId("user-ticket-count")).toHaveTextContent("1");
    expect(screen.getByTestId("raffle-status")).toHaveTextContent("OPEN");
  });

  it("displays purchase button", async () => {
    global.fetch = mockFetch({
      status: "OPEN",
      remainingTickets: 100,
      userTicketCount: 0,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("purchase-button")).toBeInTheDocument();
    });
    expect(screen.getByTestId("purchase-button")).toHaveTextContent(
      "Purchase 1 ticket",
    );
  });

  it("displays winner when status is CLOSED", async () => {
    global.fetch = mockFetch({
      status: "CLOSED",
      remainingTickets: 0,
      userTicketCount: 2,
      winningTicketId: 42,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByTestId("winner")).toHaveTextContent("42");
    });
  });
});
