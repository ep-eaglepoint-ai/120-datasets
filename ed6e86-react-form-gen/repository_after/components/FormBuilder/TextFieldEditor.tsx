import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import type { InputType } from '@/lib/types';

interface TextFieldEditorProps {
  onApply: (config: {
    inputType: InputType;
    label: string;
    placeholder: string;
    required: boolean;
  }) => void;
  onCancel: () => void;
}

export function TextFieldEditor({ onApply, onCancel }: TextFieldEditorProps): React.ReactElement {
  const [inputType, setInputType] = useState<InputType>('text');
  const [label, setLabel] = useState('');
  const [placeholder, setPlaceholder] = useState('Your Answer Here...');
  const [required, setRequired] = useState(true);

  const handleApply = (): void => {
    if (label.trim() === '') {
      alert('Please enter a label for the field');
      return;
    }

    onApply({
      inputType,
      label: label.trim(),
      placeholder: placeholder.trim() || 'Your Answer Here...',
      required,
    });

    setInputType('text');
    setLabel('');
    setPlaceholder('Your Answer Here...');
    setRequired(true);
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col overflow-y-auto">
      <Select
        id="texttype"
        label="Input Type"
        value={inputType}
        onChange={(value) => setInputType(value as InputType)}
        options={[
          { value: 'text', label: 'Text' },
          { value: 'email', label: 'Email' },
          { value: 'tel', label: 'Phone' },
          { value: 'url', label: 'URL' },
        ]}
      />
      <Input
        id="label_input"
        label="Field Label"
        value={label}
        onChange={setLabel}
        placeholder="e.g., Full Name"
      />
      <Input
        id="placeholder_input"
        label="Placeholder Text"
        value={placeholder}
        onChange={setPlaceholder}
        placeholder="Your Answer Here..."
      />
      <Select
        id="requiredbox"
        label="Required Field"
        value={required ? 'required' : 'none'}
        onChange={(value) => setRequired(value === 'required')}
        options={[
          { value: 'required', label: 'Yes' },
          { value: 'none', label: 'No' },
        ]}
      />
      <div className="flex gap-2 sm:gap-3 justify-end mt-auto pt-4">
        <Button onClick={onCancel} variant="secondary" className="text-sm sm:text-base">
          Cancel
        </Button>
        <Button onClick={handleApply} variant="accent" className="text-sm sm:text-base">
          Apply
        </Button>
      </div>
    </div>
  );
}
