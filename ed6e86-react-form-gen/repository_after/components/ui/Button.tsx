import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'accent' | 'secondary';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export function Button({ 
  onClick, 
  children, 
  variant = 'primary', 
  disabled = false, 
  type = 'button', 
  className = '' 
}: ButtonProps): React.ReactElement {
  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    primary: 'bg-primary hover:bg-[#008a95] text-white',
    accent: 'bg-accent hover:bg-[#ff5722] text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-700',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
