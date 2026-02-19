import React from 'react';

interface ToastProps {
  message: string;
  /** For testing: 'error' shows as error toast with data-testid="error-toast" */
  variant?: 'error';
}

/**
 * Simple toast notification. Used for error feedback (REQ-7).
 * Renders as a fixed-position toast so tests can assert on it via jsdom/RTL.
 */
export function Toast({ message, variant = 'error' }: ToastProps) {
  const isError = variant === 'error';
  return (
    <div
      role="alert"
      data-testid={isError ? 'error-toast' : 'toast'}
      aria-live="assertive"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        maxWidth: 320,
        padding: '12px 16px',
        borderRadius: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        backgroundColor: isError ? '#fde8e8' : '#f5f5f5',
        color: isError ? '#c00' : '#333',
        fontSize: 14,
        zIndex: 9999,
      }}
    >
      {message}
    </div>
  );
}
