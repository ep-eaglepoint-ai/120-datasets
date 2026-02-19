import { render, screen, fireEvent } from '@testing-library/react';
import { MoodInput } from '../MoodInput';

describe('MoodInput', () => {
  test('renders input field', () => {
    render(<MoodInput onSubmit={jest.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  test('renders submit button', () => {
    render(<MoodInput onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: /generate/i })).toBeInTheDocument();
  });

  test('updates input value on change', () => {
    render(<MoodInput onSubmit={jest.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    
    fireEvent.change(input, { target: { value: 'happy' } });
    expect(input.value).toBe('happy');
  });

  test('calls onSubmit with mood text when valid', () => {
    const onSubmit = jest.fn();
    render(<MoodInput onSubmit={onSubmit} />);
    
    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /generate/i });
    
    fireEvent.change(input, { target: { value: 'excited' } });
    fireEvent.click(button);
    
    expect(onSubmit).toHaveBeenCalledWith('excited');
  });

  describe('Empty Input Validation (REQUIREMENT #3)', () => {
    test('shows error when submitting empty mood', () => {
      render(<MoodInput onSubmit={jest.fn()} />);
      const button = screen.getByRole('button', { name: /generate/i });
      
      fireEvent.click(button);
      
      expect(screen.getByText(/mood cannot be empty/i)).toBeInTheDocument();
    });

    test('shows error for whitespace-only input', () => {
      render(<MoodInput onSubmit={jest.fn()} />);
      const input = screen.getByRole('textbox');
      const button = screen.getByRole('button', { name: /generate/i });
      
      fireEvent.change(input, { target: { value: '   ' } });
      fireEvent.click(button);
      
      expect(screen.getByText(/mood cannot be empty/i)).toBeInTheDocument();
    });

    test('does not call onSubmit when empty', () => {
      const onSubmit = jest.fn();
      render(<MoodInput onSubmit={onSubmit} />);
      const button = screen.getByRole('button', { name: /generate/i });
      
      fireEvent.click(button);
      
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  test('clears error when user types after error', () => {
    render(<MoodInput onSubmit={jest.fn()} />);
    const input = screen.getByRole('textbox');
    const button = screen.getByRole('button', { name: /generate/i });
    
    // Trigger error
    fireEvent.click(button);
    expect(screen.getByText(/mood cannot be empty/i)).toBeInTheDocument();
    
    // Type something
    fireEvent.change(input, { target: { value: 'h' } });
    expect(screen.queryByText(/mood cannot be empty/i)).not.toBeInTheDocument();
  });

  test('respects maxLength of 100', () => {
    render(<MoodInput onSubmit={jest.fn()} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    
    expect(input.maxLength).toBe(100);
  });

  test('shows character count', () => {
    render(<MoodInput onSubmit={jest.fn()} />);
    expect(screen.getByText(/0\/100 characters/i)).toBeInTheDocument();
    
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'happy' } });
    
    expect(screen.getByText(/5\/100 characters/i)).toBeInTheDocument();
  });
});
