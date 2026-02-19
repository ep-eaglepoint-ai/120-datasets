import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import ThemeToggle from '../components/ThemeToggle';
import { ThemeProvider } from '../context/ThemeContext';

const renderWithProvider = (ui) => {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
};

describe('ThemeToggle Component', () => {
  it('should render correctly with default system mode', () => {
    renderWithProvider(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveTextContent(/system/i);
    expect(button.getAttribute('aria-label')).toMatch(/current theme: system/i);
  });

  it('should cycle through themes when clicked', () => {
    renderWithProvider(<ThemeToggle />);
    const button = screen.getByRole('button');

    // System -> Light
    fireEvent.click(button);
    expect(button).toHaveTextContent(/light/i);

    // Light -> Dark
    fireEvent.click(button);
    expect(button).toHaveTextContent(/dark/i);

    // Dark -> System
    fireEvent.click(button);
    expect(button).toHaveTextContent(/system/i);
  });

  it('should have proper accessibility attributes', () => {
    renderWithProvider(<ThemeToggle />);
    const button = screen.getByRole('button');
    
    expect(button).toHaveAttribute('aria-label');
    expect(button).toHaveAttribute('aria-pressed');
  });
});
