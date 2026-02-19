import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { generateId } from '@/lib/utils';
import type { ChoiceType, ChoiceOption } from '@/lib/types';

interface ChoiceFieldEditorProps {
  onApply: (config: {
    choiceType: ChoiceType;
    legend: string;
    options: ChoiceOption[];
  }) => void;
  onCancel: () => void;
}

export function ChoiceFieldEditor({ onApply, onCancel }: ChoiceFieldEditorProps): React.ReactElement {
  const [choiceType, setChoiceType] = useState<ChoiceType>('radio');
  const [legend, setLegend] = useState('Your Choice Below...');
  const [options, setOptions] = useState<ChoiceOption[]>([]);
  const [currentOption, setCurrentOption] = useState('');

  const handleAddOption = (): void => {
    if (currentOption.trim() === '') {
      alert('Please enter an option value');
      return;
    }

    const newOption: ChoiceOption = {
      id: generateId(),
      label: currentOption.trim(),
      value: currentOption.trim().toLowerCase().replace(/\s+/g, '-'),
    };

    setOptions([...options, newOption]);
    setCurrentOption('');
  };

  const handleRemoveOption = (): void => {
    if (options.length > 0) {
      setOptions(options.slice(0, -1));
    }
  };

  const handleApply = (): void => {
    if (options.length === 0) {
      alert('Please add at least one option');
      return;
    }

    onApply({
      choiceType,
      legend: legend.trim() || 'Your Choice Below...',
      options,
    });

    setChoiceType('radio');
    setLegend('Your Choice Below...');
    setOptions([]);
    setCurrentOption('');
  };

  const handleCancel = (): void => {
    setChoiceType('radio');
    setLegend('Your Choice Below...');
    setOptions([]);
    setCurrentOption('');
    onCancel();
  };

  return (
    <div className="p-4 h-full flex flex-col overflow-y-auto">
      <Select
        id="choicetype"
        label="Choice Type"
        value={choiceType}
        onChange={(value) => setChoiceType(value as ChoiceType)}
        options={[
          { value: 'radio', label: 'Radio (Single Choice)' },
          { value: 'checkbox', label: 'Checkbox (Multiple Choice)' },
        ]}
      />
      <Input
        id="legend_input"
        label="Question Label"
        value={legend}
        onChange={setLegend}
        placeholder="Your Choice Below..."
      />
      <div className="mb-4">
        <Input
          id="options_input"
          label="Add Options"
          value={currentOption}
          onChange={setCurrentOption}
          placeholder="Enter option text"
        />
        <div className="flex gap-2 mt-2">
          <Button onClick={handleAddOption} variant="primary" className="flex-1">
            Add Option
          </Button>
          <Button onClick={handleRemoveOption} variant="secondary" className="flex-1">
            Remove Last
          </Button>
        </div>
      </div>
      {options.length > 0 && (
        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Options ({options.length}):</p>
          <ul className="space-y-1">
            {options.map((option, index) => (
              <li key={option.id} className="text-sm text-gray-600">
                {index + 1}. {option.label}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex gap-2 sm:gap-3 justify-end mt-auto pt-4">
        <Button onClick={handleCancel} variant="secondary" className="text-sm sm:text-base">
          Cancel
        </Button>
        <Button onClick={handleApply} variant="accent" className="text-sm sm:text-base">
          Apply
        </Button>
      </div>
    </div>
  );
}
