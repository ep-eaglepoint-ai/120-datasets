/**
 * Requirement 2: Copy-to-clipboard functionality for shareable poll links.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CopyLinkButton } from '../../repository_after/client/src/components/CopyLinkButton';

const mockWriteText = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockWriteText.mockResolvedValue(undefined);
  Object.assign(navigator, {
    clipboard: { writeText: mockWriteText },
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CopyLinkButton - Requirement 2', () => {
  it('copies URL to clipboard when clicked', async () => {
    render(<CopyLinkButton url="https://example.com/poll/abc123" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    expect(mockWriteText).toHaveBeenCalledWith('https://example.com/poll/abc123');
  });

  it('shows "Copied!" feedback after successful copy', async () => {
    render(<CopyLinkButton url="https://example.com/poll/abc123" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    expect(screen.getByText('Copied!')).toBeInTheDocument();
  });

  it('reverts to "Copy link" after 2 seconds', async () => {
    render(<CopyLinkButton url="https://example.com/poll/abc123" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    expect(screen.getByText('Copied!')).toBeInTheDocument();
    
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('handles clipboard error gracefully', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard error'));
    render(<CopyLinkButton url="https://example.com/poll/abc123" />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }));
    });
    // Should not crash and button should remain functional with "Copy link" text
    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.getByText('Copy link')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    render(<CopyLinkButton url="https://example.com/poll/abc123" className="custom-class" />);
    const button = screen.getByRole('button', { name: 'Copy link' });
    expect(button).toHaveClass('custom-class');
  });
});
