import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { HomePage } from '../pages/HomePage';
import { GalleryPage } from '../pages/GalleryPage';
import { storageManager } from '../lib/storageManager';

describe('Integration Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Mood Creation Flow', () => {
    test('user can input mood and generate shape', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      );

      // Input mood
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'excited and happy' } });

      // Submit
      const button = screen.getByRole('button', { name: /generate/i });
      fireEvent.click(button);

      // Should show the mood shape
      expect(screen.getByText(/Your Mood:/i)).toBeInTheDocument();
      expect(screen.getByText(/excited and happy/i)).toBeInTheDocument();
    });

    test('user can save generated mood', () => {
      render(
        <BrowserRouter>
          <HomePage />
        </BrowserRouter>
      );

      // Generate mood
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'peaceful' } });
      fireEvent.click(screen.getByRole('button', { name: /generate/i }));

      // Save mood
      const saveButton = screen.getByRole('button', { name: /save to gallery/i });
      fireEvent.click(saveButton);

      // Button should show saved state
      expect(screen.getByText(/✓ Saved/i)).toBeInTheDocument();

      // Verify in storage
      const saved = storageManager.loadAll();
      expect(saved).toHaveLength(1);
      expect(saved[0].mood).toBe('peaceful');
    });
  });

  describe('Gallery Flow', () => {
    test('shows empty state when no moods saved', () => {
      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      );

      expect(screen.getByText(/No moods saved yet!/i)).toBeInTheDocument();
    });

    test('displays saved moods', () => {
      // Save a mood first
      const mood = {
        id: 'test-1',
        mood: 'test mood',
        timestamp: Date.now(),
        properties: {
          type: 'circle' as const,
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 100,
          animation: 'rotate' as const,
          speed: 5,
          pattern: 'solid' as const,
        },
      };
      storageManager.save(mood);

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      );

      expect(screen.getByText('test mood')).toBeInTheDocument();
      expect(screen.getByText(/1 mood saved/i)).toBeInTheDocument();
    });

    test('can clear all moods', () => {
      // Save moods
      storageManager.save({
        id: '1',
        mood: 'happy',
        timestamp: Date.now(),
        properties: {
          type: 'circle',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 100,
          animation: 'rotate',
          speed: 5,
          pattern: 'solid',
        },
      });

      // Mock window.confirm to auto-accept
      window.confirm = jest.fn(() => true);

      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      );

      const clearButton = screen.getByRole('button', { name: /clear all/i });
      fireEvent.click(clearButton);

      // Should show empty state
      expect(screen.getByText(/No moods saved yet!/i)).toBeInTheDocument();
    });
  });

  describe('Persistence', () => {
    test('moods persist across page reloads', () => {
      // Save mood
      storageManager.save({
        id: 'persist-test',
        mood: 'persistent mood',
        timestamp: Date.now(),
        properties: {
          type: 'triangle',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          size: 150,
          animation: 'pulse',
          speed: 6,
          pattern: 'gradient',
        },
      });

      // Simulate reload by creating new gallery instance
      const { unmount } = render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      );

      expect(screen.getByText('persistent mood')).toBeInTheDocument();

      unmount();

      // Render again (simulating reload)
      render(
        <BrowserRouter>
          <GalleryPage />
        </BrowserRouter>
      );

      expect(screen.getByText('persistent mood')).toBeInTheDocument();
    });
  });
});
