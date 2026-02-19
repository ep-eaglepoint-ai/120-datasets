/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
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

describe("Polling Behavior", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
    jest.clearAllMocks();
  });

  it("polls the raffle state every 3 seconds", async () => {
    const fetchMock = mockFetch({
      status: "OPEN",
      remainingTickets: 100,
      userTicketCount: 0,
    });
    global.fetch = fetchMock;

    render(<App />);

    // Initial fetch
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // Fast-forward 3 seconds for the first poll
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    // Update mock to simulate a change
    fetchMock.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "OPEN",
            remainingTickets: 95,
            userTicketCount: 0,
          }),
      }),
    );

    // Fast-forward another 3 seconds for the second poll
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.getByTestId("remaining-tickets")).toHaveTextContent("95");
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
