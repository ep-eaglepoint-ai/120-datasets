/**
 * Custom hook for tracking network connectivity status.
 * Provides online/offline state with debouncing for rapid changes.
 */

import { useState, useEffect, useCallback, useRef } from "react";

export const ConnectionQuality = {
  OFFLINE: "offline",
  POOR: "poor",
  GOOD: "good",
  EXCELLENT: "excellent",
};

export function useNetworkStatus(options = {}) {
  const { debounceMs = 300, onOnline, onOffline } = options;

  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [lastOnline, setLastOnline] = useState(() =>
    isOnline ? Date.now() : null,
  );
  const [connectionQuality, setConnectionQuality] = useState(
    isOnline ? ConnectionQuality.GOOD : ConnectionQuality.OFFLINE,
  );

  const timeoutRef = useRef(null);
  const onOnlineRef = useRef(onOnline);
  const onOfflineRef = useRef(onOffline);

  // Keep callback refs updated
  useEffect(() => {
    onOnlineRef.current = onOnline;
    onOfflineRef.current = onOffline;
  }, [onOnline, onOffline]);

  /**
   * Debounced status update to handle rapid toggling
   */
  const updateStatus = useCallback(
    (online) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setIsOnline((prevOnline) => {
          if (prevOnline !== online) {
            if (online) {
              setLastOnline(Date.now());
              setConnectionQuality(ConnectionQuality.GOOD);
              onOnlineRef.current?.();
              console.log("[Network] Connection restored");
            } else {
              setConnectionQuality(ConnectionQuality.OFFLINE);
              onOfflineRef.current?.();
              console.log("[Network] Connection lost");
            }
          }
          return online;
        });
      }, debounceMs);
    },
    [debounceMs],
  );

  /**
   * Manual connection check (useful for testing)
   */
  const checkConnection = useCallback(() => {
    updateStatus(navigator.onLine);
  }, [updateStatus]);

  useEffect(() => {
    const handleOnline = () => updateStatus(true);
    const handleOffline = () => updateStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    checkConnection();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [updateStatus, checkConnection]);

  /**
   * Estimate connection quality based on Network Information API
   * Falls back to binary online/offline if API not available
   */
  useEffect(() => {
    if (isOnline) {
      const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;

      if (connection) {
        const updateQuality = () => {
          const effectiveType = connection.effectiveType;

          switch (effectiveType) {
            case "slow-2g":
            case "2g":
              setConnectionQuality(ConnectionQuality.POOR);
              break;
            case "3g":
              setConnectionQuality(ConnectionQuality.GOOD);
              break;
            case "4g":
              setConnectionQuality(ConnectionQuality.EXCELLENT);
              break;
            default:
              setConnectionQuality(ConnectionQuality.GOOD);
          }
        };

        updateQuality();
        connection.addEventListener("change", updateQuality);

        return () => {
          connection.removeEventListener("change", updateQuality);
        };
      }
    }
  }, [isOnline]);

  return {
    isOnline,
    lastOnline,
    connectionQuality,
    checkConnection,
  };
}

export default useNetworkStatus;
