import { useState, useEffect, useCallback } from "react";
import { Toast } from "./Toast";

const API_BASE = "/api";

interface RaffleState {
  status: "OPEN" | "CLOSED";
  remainingTickets: number;
  userTicketCount?: number;
  winningTicketId?: number;
}

function getUserId(): string {
  if (typeof window === "undefined") return "demo-user";
  const params = new URLSearchParams(window.location.search);
  const q = params.get("userId");
  if (q) return q;
  let stored = localStorage.getItem("raffle_user_id");
  if (!stored) {
    stored = "user-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem("raffle_user_id", stored);
  }
  return stored;
}

export default function App() {
  const [state, setState] = useState<RaffleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userId] = useState(() => getUserId());

  const fetchState = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/raffle/state?userId=${encodeURIComponent(userId)}`,
        );
        if (!res.ok) throw new Error("Failed to load state");
        const data: RaffleState = await res.json();
        setState(data);
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    fetchState();

    const interval = setInterval(() => {
      fetchState(true);
    }, 3000);

    return () => clearInterval(interval);
  }, [fetchState]);

  const handlePurchase = async () => {
    setPurchasing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/purchase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, quantity: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      } else {
        setError(data.error || "Purchase failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network timeout or error");
    } finally {
      setPurchasing(false);
    }
  };

  const isDisabled =
    !state ||
    state.remainingTickets === 0 ||
    (state.userTicketCount ?? 0) >= 2 ||
    state.status === "CLOSED" ||
    purchasing;

  if (loading && !state) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <p>Loading raffle state…</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", padding: 24 }}>
      <h1>Raffle Dashboard</h1>
      {state && (
        <>
          <p data-testid="remaining-tickets">
            <strong>Tickets remaining:</strong> {state.remainingTickets}
          </p>
          <p data-testid="user-ticket-count">
            <strong>Your tickets:</strong> {state.userTicketCount ?? 0}
          </p>
          <p data-testid="raffle-status">
            <strong>Status:</strong> {state.status}
          </p>
          {state.status === "CLOSED" && state.winningTicketId != null && (
            <p data-testid="winner">Winner: ticket #{state.winningTicketId}</p>
          )}
          <button
            data-testid="purchase-button"
            type="button"
            onClick={handlePurchase}
            disabled={isDisabled}
            aria-busy={purchasing}
          >
            {purchasing ? "Purchasing…" : "Purchase 1 ticket"}
          </button>
        </>
      )}
      {error && <Toast message={error} variant="error" />}
    </div>
  );
}
