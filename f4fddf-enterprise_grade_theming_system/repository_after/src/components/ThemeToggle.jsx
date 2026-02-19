import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { THEME_MODES } from '../theme/tokens';

/**
 * Three-state Theme Toggle Button
 * Cycles through: System -> Light -> Dark -> System
 */
const ThemeToggle = () => {
  const { mode, isDark, toggleTheme } = useTheme();
  const [ripple, setRipple] = useState(null);

  const getIcon = () => {
    if (mode === THEME_MODES.SYSTEM) return '🖥️';
    if (mode === THEME_MODES.LIGHT) return '☀️';
    return '🌙';
  };

  const getLabel = () => {
    const current = mode.charAt(0).toUpperCase() + mode.slice(1);
    return `Current theme: ${current}. Click to change.`;
  };

  const handleClick = (e) => {
    // Ripple effect
    const rect = e.currentTarget.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    setRipple({ x, y, size });
    setTimeout(() => setRipple(null), 600);
    
    toggleTheme();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={handleClick}
        aria-label={getLabel()}
        aria-pressed={mode !== THEME_MODES.SYSTEM}
        title={`Theme: ${mode}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px 24px',
          fontSize: '1rem',
          fontWeight: '600',
          cursor: 'pointer',
          border: '2px solid var(--border-color)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary)',
          color: 'var(--text-primary)',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all var(--transition-speed) var(--transition-bezier)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--interactive-hover)';
          e.currentTarget.style.color = '#FFFFFF';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }}
      >
        <span style={{ marginRight: '8px' }} aria-hidden="true">{getIcon()}</span>
        <span style={{ textTransform: 'capitalize' }}>{mode}</span>

        {ripple && (
          <span
            style={{
              position: 'absolute',
              top: ripple.y,
              left: ripple.x,
              width: ripple.size,
              height: ripple.size,
              background: 'rgba(255, 255, 255, 0.3)',
              borderRadius: '50%',
              transform: 'scale(0)',
              animation: 'ripple 600ms linear',
              pointerEvents: 'none',
            }}
          />
        )}
      </button>

      <style>{`
        @keyframes ripple {
          to {
            transform: scale(4);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default React.memo(ThemeToggle);
