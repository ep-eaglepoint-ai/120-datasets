/**
 * SyncStatusIndicator - Visual indicator showing sync state, pending operations, and errors.
 */

import { SYNC_STATES } from '../lib/syncEngine.js';

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'Never';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

export function SyncStatusIndicator({ 
  syncState, 
  pendingCount, 
  failedCount, 
  lastSyncTime,
  onRetry 
}) {
  const isSyncing = syncState === SYNC_STATES.SYNCING;
  const hasError = syncState === SYNC_STATES.ERROR || failedCount > 0;
  const hasPending = pendingCount > 0;

  return (
    <div className="sync-status-indicator">
      {/* Sync icon with animation */}
      <div className={`sync-icon ${isSyncing ? 'syncing' : ''} ${hasError ? 'error' : ''}`}>
        {isSyncing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.22-8.56" />
          </svg>
        ) : hasError ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ) : hasPending ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Status text */}
      <div className="sync-status-text">
        {isSyncing && <span className="status syncing">Syncing...</span>}
        {!isSyncing && hasError && (
          <span className="status error">
            {failedCount} failed
            {onRetry && (
              <button className="retry-btn" onClick={onRetry}>
                Retry
              </button>
            )}
          </span>
        )}
        {!isSyncing && !hasError && hasPending && (
          <span className="status pending">
            {pendingCount} pending
          </span>
        )}
        {!isSyncing && !hasError && !hasPending && (
          <span className="status synced">
            Synced {formatRelativeTime(lastSyncTime)}
          </span>
        )}
      </div>

      {/* Pending badge */}
      {hasPending && !isSyncing && (
        <div className="pending-badge pulse">
          {pendingCount}
        </div>
      )}
    </div>
  );
}

export default SyncStatusIndicator;
