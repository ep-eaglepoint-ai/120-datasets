import { render } from '@testing-library/react';
import { ShapeCanvas } from '../ShapeCanvas';
import { ShapeProperties } from '../../lib/types';

describe('ShapeCanvas', () => {
  const mockProperties: ShapeProperties = {
    type: 'circle',
    primaryColor: '#FF0000',
    secondaryColor: '#00FF00',
    size: 100,
    animation: 'rotate',
    speed: 5,
    pattern: 'solid',
  };

  test('renders canvas element', () => {
    const { container } = render(<ShapeCanvas properties={mockProperties} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
  });

  test('sets canvas width and height', () => {
    const { container } = render(
      <ShapeCanvas properties={mockProperties} width={300} height={300} />
    );
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    
    expect(canvas.width).toBe(300);
    expect(canvas.height).toBe(300);
  });

  test('uses default dimensions when not provided', () => {
    const { container } = render(<ShapeCanvas properties={mockProperties} />);
    const canvas = container.querySelector('canvas') as HTMLCanvasElement;
    
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(400);
  });

  test('cleans up animator on unmount', () => {
    const { unmount } = render(<ShapeCanvas properties={mockProperties} />);
    
    // Should not throw error
    expect(() => unmount()).not.toThrow();
  });

  test('re-creates animator when properties change', () => {
    const { rerender } = render(<ShapeCanvas properties={mockProperties} />);
    
    const newProperties: ShapeProperties = {
      ...mockProperties,
      type: 'triangle',
    };
    
    expect(() => rerender(<ShapeCanvas properties={newProperties} />)).not.toThrow();
  });
});
