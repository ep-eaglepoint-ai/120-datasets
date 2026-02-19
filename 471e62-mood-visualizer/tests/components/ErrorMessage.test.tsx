import { render, screen } from '@testing-library/react';
import { ErrorMessage } from '../ErrorMessage';

describe('ErrorMessage', () => {
  test('displays error message when provided', () => {
    render(<ErrorMessage message="Test error" />);
    expect(screen.getByText('Test error')).toBeInTheDocument();
  });

  test('renders nothing when message is empty', () => {
    const { container } = render(<ErrorMessage message="" />);
    expect(container.firstChild).toBeNull();
  });

  test('has error styling', () => {
    render(<ErrorMessage message="Error" />);
    const element = screen.getByRole('alert');
    expect(element).toHaveClass('bg-red-50');
    expect(element).toHaveClass('border-red-300');
    expect(element).toHaveClass('text-red-700');
  });
});
