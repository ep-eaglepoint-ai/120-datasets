import { render, screen } from '@testing-library/react';
import { MoodCard } from '../MoodCard';
import { MoodShape } from '../../lib/types';

describe('MoodCard', () => {
  const mockMoodShape: MoodShape = {
    id: 'test-id',
    mood: 'happy and excited',
    timestamp: Date.now(),
    properties: {
      type: 'circle',
      primaryColor: '#FFD700',
      secondaryColor: '#FF6B6B',
      size: 120,
      animation: 'pulse',
      speed: 7,
      pattern: 'gradient',
    },
  };

  test('renders mood text', () => {
    render(<MoodCard moodShape={mockMoodShape} />);
    expect(screen.getByText('happy and excited')).toBeInTheDocument();
  });

  test('renders canvas with shape', () => {
    const { container } = render(<MoodCard moodShape={mockMoodShape} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  test('displays formatted date', () => {
    render(<MoodCard moodShape={mockMoodShape} />);
    // Date should be formatted and visible
    const dateElements = screen.getAllByText(/\d{1,2}, \d{4}/);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  test('truncates long mood text visually', () => {
    const longMood: MoodShape = {
      ...mockMoodShape,
      mood: 'a'.repeat(200),
    };
    
    const { container } = render(<MoodCard moodShape={longMood} />);
    const moodText = container.querySelector('.truncate');
    expect(moodText).toBeInTheDocument();
  });
});
