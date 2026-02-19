import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { Card, Typography, Button } from '../components/ThemedComponents';

describe('ThemedComponents', () => {
  describe('Card', () => {
    it('should render children and apply styles', () => {
      render(<Card>Test Content</Card>);
      const card = screen.getByText('Test Content');
      expect(card).toBeInTheDocument();
      expect(card.style.backgroundColor).toBe('var(--bg-secondary)');
    });
  });

  describe('Typography', () => {
    it('should render as different variants', () => {
      const { rerender } = render(<Typography variant="h1">Heading 1</Typography>);
      expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();

      rerender(<Typography variant="muted">Muted Text</Typography>);
      const muted = screen.getByText('Muted Text');
      expect(muted.tagName).toBe('P');
      expect(muted.style.color).toBe('var(--text-muted)');
    });
  });

  describe('Button', () => {
    it('should render with different variants', () => {
      const { rerender } = render(<Button variant="success">Success</Button>);
      const button = screen.getByRole('button');
      expect(button.style.backgroundColor).toBe('var(--color-success)');

      rerender(<Button variant="error">Error</Button>);
      expect(button.style.backgroundColor).toBe('var(--color-error)');
    });

    it('should handle click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });
});
