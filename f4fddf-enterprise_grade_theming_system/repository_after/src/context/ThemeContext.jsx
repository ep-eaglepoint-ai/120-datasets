import React, { createContext, useContext, useReducer, useMemo, useEffect, useCallback } from 'react';
import { THEME_MODES, tokens } from '../theme/tokens';


const ThemeContext = createContext(undefined);

const ACTIONS = {
  SET_THEME: 'SET_THEME',
  TOGGLE_THEME: 'TOGGLE_THEME',
  SYNC_SYSTEM_THEME: 'SYNC_SYSTEM_THEME',
};

const getSystemPreference = () => {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};
function themeReducer(state, action) {
  const startTime = performance.now();
  let newState;

  switch (action.type) {
    case ACTIONS.SET_THEME:
      newState = {
        ...state,
        mode: action.payload,
        isDark: action.payload === THEME_MODES.SYSTEM ? getSystemPreference() : action.payload === THEME_MODES.DARK,
        isLocked: action.payload !== THEME_MODES.SYSTEM,
      };
      break;
    case ACTIONS.TOGGLE_THEME: {
      const modes = [THEME_MODES.SYSTEM, THEME_MODES.LIGHT, THEME_MODES.DARK];
      const currentIndex = modes.indexOf(state.mode);
      const nextMode = modes[(currentIndex + 1) % modes.length];
      newState = {
        ...state,
        mode: nextMode,
        isDark: nextMode === THEME_MODES.SYSTEM ? getSystemPreference() : nextMode === THEME_MODES.DARK,
        isLocked: nextMode !== THEME_MODES.SYSTEM,
      };
      break;
    }
    case ACTIONS.SYNC_SYSTEM_THEME:
      if (state.isLocked) {
        newState = state;
      } else {
        newState = {
          ...state,
          isDark: action.payload,
        };
      }
      break;
    default:
      return state;
  }

  const endTime = performance.now();
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Theme] Action: ${action.type}, Duration: ${(endTime - startTime).toFixed(4)}ms`);
    console.log(`[Theme] New State:`, newState);
  }
  return newState;
}

export const ThemeProvider = ({ children }) => {
  const initialState = {
    mode: THEME_MODES.SYSTEM,
    isDark: getSystemPreference(),
    isLocked: false,
  };

  const [state, dispatch] = useReducer(themeReducer, initialState);

  // Sync with system theme changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      dispatch({ type: ACTIONS.SYNC_SYSTEM_THEME, payload: e.matches });
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Inject CSS Variables
  useEffect(() => {
    const themeTokens = state.isDark ? tokens.dark : tokens.light;
    const styleId = 'enterprise-theme-tokens';
    let styleTag = document.getElementById(styleId);

    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }

    const cssVariables = Object.entries(themeTokens)
      .map(([key, value]) => `${key}: ${value};`)
      .join('\n');

    // Handle prefers-reduced-motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const transitionProperty = reducedMotion ? 'none' : 'background-color, color, border-color, box-shadow, filter';
    const transitionValue = reducedMotion ? 'none' : `${themeTokens['--transition-speed']} ${themeTokens['--transition-bezier']}`;

    styleTag.innerHTML = `
      :root {
        ${cssVariables}
        color-scheme: ${state.isDark ? 'dark' : 'light'};
        --focus-ring-color: ${state.isDark ? 'rgba(102, 178, 255, 0.5)' : 'rgba(0, 86, 179, 0.5)'};
        --gradient-start: ${themeTokens['--bg-secondary']};
        --gradient-end: ${themeTokens['--bg-tertiary']};
      }
      * {
        transition-property: ${transitionProperty};
        transition-duration: var(--transition-speed);
        transition-timing-function: var(--transition-bezier);
      }
      *:focus-visible {
        outline: none;
        box-shadow: var(--focus-ring);
      }
    `;
  }, [state.isDark]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  const { state, dispatch } = context;

  const setTheme = useCallback((mode) => {
    dispatch({ type: ACTIONS.SET_THEME, payload: mode });
  }, [dispatch]);

  const toggleTheme = useCallback(() => {
    dispatch({ type: ACTIONS.TOGGLE_THEME });
  }, [dispatch]);

  return {
    ...state,
    setTheme,
    toggleTheme,
    ACTIONS,
  };
};
