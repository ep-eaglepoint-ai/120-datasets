import React from 'react';

interface InputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'email' | 'tel' | 'url';
  required?: boolean;
}

export function Input({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder = '', 
  type = 'text', 
  required = false 
}: InputProps): React.ReactElement {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="form-label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="form-input"
      />
    </div>
  );
}
