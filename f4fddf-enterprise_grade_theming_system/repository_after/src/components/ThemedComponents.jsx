import React from 'react';

/**
 * Enterprise Card Component
 * Uses semantic tokens for background, border, and shadow.
 */
export const Card = React.memo(({ children, style = {} }) => {
  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: 'var(--shadow-md)',
        transition: 'all var(--transition-speed) var(--transition-bezier)',
        ...style,
      }}
    >
      {children}
    </div>
  );
});

/**
 * Enterprise Typography Component
 * Supports primary, secondary, and muted text hierarchy.
 */
export const Typography = React.memo(({ variant = 'body', children, style = {} }) => {
  const getStyles = () => {
    switch (variant) {
      case 'h1':
        return { fontSize: '2.5rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '1rem' };
      case 'h2':
        return { fontSize: '1.75rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.75rem' };
      case 'h3':
        return { fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '0.5rem' };
      case 'secondary':
        return { fontSize: '1rem', color: 'var(--text-secondary)' };
      case 'muted':
        return { fontSize: '0.875rem', color: 'var(--text-muted)' };
      default:
        return { fontSize: '1rem', color: 'var(--text-primary)' };
    }
  };

  const Component = ['h1', 'h2', 'h3'].includes(variant) ? variant : 'p';

  return (
    <Component style={{ ...getStyles(), ...style }}>
      {children}
    </Component>
  );
});

/**
 * Enterprise Button Component
 * Supports interactive states and semantic colors.
 */
export const Button = React.memo(({ children, onClick, variant = 'default', style = {} }) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: 'var(--color-success)', text: '#FFFFFF' };
      case 'error':
        return { bg: 'var(--color-error)', text: '#FFFFFF' };
      default:
        return { bg: 'var(--interactive-default)', text: '#FFFFFF' };
    }
  };

  const { bg, text } = getColors();

  return (
    <button
      onClick={onClick}
      style={{
        backgroundColor: bg,
        color: text,
        border: 'none',
        borderRadius: '6px',
        padding: '10px 20px',
        fontSize: '1rem',
        fontWeight: '500',
        cursor: 'pointer',
        boxShadow: 'var(--shadow-sm)',
        transition: 'all var(--transition-speed) var(--transition-bezier)',
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.filter = 'brightness(1.1)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = 'none';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
      }}
    >
      {children}
    </button>
  );
});
