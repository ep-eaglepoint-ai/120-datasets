import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import App from '../App';

describe('Enterprise Requirements (repository_before)', () => {
  it('should support "system" theme mode', () => {
    render(<App />);
    const systemButton = screen.queryByText(/system/i);
    expect(systemButton).toBeInTheDocument();
  });

  it('should use CSS variables for theming', () => {
    render(<App />);
    const appContainer = document.querySelector('.app');
    expect(appContainer.style.backgroundColor).toContain('var(--bg-primary)');
  });

  it('should meet WCAG AAA contrast for primary interactive elements', () => {
    render(<App />);
    const lightButton = screen.getByText(/light/i);
    const bgColor = window.getComputedStyle(lightButton).backgroundColor;
    expect(bgColor).not.toBe('rgb(0, 123, 255)'); 
  });

  it('should have 300ms transitions for visual stability', () => {
    render(<App />);
    const dashboard = document.querySelector('.dashboard');
    const transition = window.getComputedStyle(dashboard).transitionDuration;
    expect(transition).toBe('0.3s');
  });

  it('should respect prefers-reduced-motion', () => {
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    render(<App />);
    const app = document.querySelector('.app');
    const transition = window.getComputedStyle(app).transition;
    expect(transition).toBe('none');
  });
});
