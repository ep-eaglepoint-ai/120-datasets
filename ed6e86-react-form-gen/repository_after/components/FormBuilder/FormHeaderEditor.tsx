import React, { useState } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface FormHeaderEditorProps {
  onApply: (title: string, description: string) => void;
  onCancel: () => void;
}

export function FormHeaderEditor({ onApply, onCancel }: FormHeaderEditorProps): React.ReactElement {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleApply = (): void => {
    onApply(title, description);
    setTitle('');
    setDescription('');
  };

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col overflow-y-auto">
      <Input
        id="titlebox"
        label="Form Title"
        value={title}
        onChange={setTitle}
        placeholder="Enter form title"
      />
      <Input
        id="forminfobox"
        label="Form Description"
        value={description}
        onChange={setDescription}
        placeholder="Enter form description"
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
