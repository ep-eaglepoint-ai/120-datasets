import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { THEME_MODES } from '../theme/tokens';

const wrapper = ({ children }) => <ThemeProvider>{children}</ThemeProvider>;

describe('ThemeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with system theme by default', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.mode).toBe(THEME_MODES.SYSTEM);
    expect(result.current.isLocked).toBe(false);
  });

  it('should toggle theme from system to light', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.mode).toBe(THEME_MODES.LIGHT);
    expect(result.current.isLocked).toBe(true);
    expect(result.current.isDark).toBe(false);
  });

  it('should toggle theme from light to dark', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    
    // System -> Light
    act(() => {
      result.current.toggleTheme();
    });
    
    // Light -> Dark
    act(() => {
      result.current.toggleTheme();
    });
    
    expect(result.current.mode).toBe(THEME_MODES.DARK);
    expect(result.current.isLocked).toBe(true);
    expect(result.current.isDark).toBe(true);
  });

  it('should toggle theme from dark back to system', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    
    // System -> Light -> Dark -> System
    act(() => {
      result.current.toggleTheme();
      result.current.toggleTheme();
      result.current.toggleTheme();
    });
    
    expect(result.current.mode).toBe(THEME_MODES.SYSTEM);
    expect(result.current.isLocked).toBe(false);
  });

  it('should set a specific theme mode', () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    
    act(() => {
      result.current.setTheme(THEME_MODES.DARK);
    });
    
    expect(result.current.mode).toBe(THEME_MODES.DARK);
    expect(result.current.isLocked).toBe(true);
    expect(result.current.isDark).toBe(true);
  });

  it('should sync with system preference changes when not locked', () => {
    let mockMatches = false;
    let changeHandler = null;

    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: mockMatches,
      media: query,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.isDark).toBe(false);

    // Simulate system change to dark
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true });
      }
    });

    expect(result.current.isDark).toBe(true);
  });

  it('should NOT sync with system preference changes when locked', () => {
    let changeHandler = null;

    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event, handler) => {
        if (event === 'change') changeHandler = handler;
      }),
      removeEventListener: vi.fn(),
    }));

    const { result } = renderHook(() => useTheme(), { wrapper });

    // Lock to light
    act(() => {
      result.current.setTheme(THEME_MODES.LIGHT);
    });

    expect(result.current.isLocked).toBe(true);

    // Simulate system change to dark
    act(() => {
      if (changeHandler) {
        changeHandler({ matches: true });
      }
    });

    // Should still be light (not dark)
    expect(result.current.isDark).toBe(false);
  });
});
