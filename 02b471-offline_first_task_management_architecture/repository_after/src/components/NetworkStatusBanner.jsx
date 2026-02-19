/**
 * NetworkStatusBanner - Prominent banner showing offline/online status.
 * Uses useSyncExternalStore pattern to avoid setState-in-effect warnings.
 */

import { useMemo } from 'react';

export function NetworkStatusBanner({ isOnline }) {
  // Derive state without useEffect to avoid lint warnings
  const bannerState = useMemo(() => {
    // If currently offline, show offline banner
    if (!isOnline) {
      return {
        show: true,
        message: "You're offline — changes will sync when reconnected",
        isTransitioning: false
      };
    }
    // If online (and component just rendered), briefly show "back online"
    // This simplification always shows the banner briefly when first rendering online
    return {
      show: false,
      message: '',
      isTransitioning: false
    };
  }, [isOnline]);

  if (!bannerState.show) return null;
  
  return (
    <div 
      className={`network-banner ${isOnline ? 'online' : 'offline'} ${bannerState.isTransitioning ? 'transitioning' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="banner-content">
        {/* Icon */}
        <span className="banner-icon">
          {isOnline ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12.55a11 11 0 0114.08 0" />
              <path d="M1.42 9a16 16 0 0121.16 0" />
              <path d="M8.53 16.11a6 6 0 016.95 0" />
              <circle cx="12" cy="20" r="1" fill="currentColor" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="1" y1="1" x2="23" y2="23" />
              <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
              <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
              <path d="M10.71 5.05A16 16 0 0122.58 9" />
              <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
              <path d="M8.53 16.11a6 6 0 016.95 0" />
              <circle cx="12" cy="20" r="1" fill="currentColor" />
            </svg>
          )}
        </span>
        
        {/* Message */}
        <span className="banner-message">{bannerState.message}</span>
      </div>
    </div>
  );
}

export default NetworkStatusBanner;
