'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormHeaderEditor } from './FormHeaderEditor';
import { TextFieldEditor } from './TextFieldEditor';
import { ChoiceFieldEditor } from './ChoiceFieldEditor';
import { FormPreview } from './FormPreview';
import { generateId } from '@/lib/utils';
import { saveFormData } from '@/lib/formStorage';
import type { FormData, TextField, ChoiceField, ActivePanel } from '@/lib/types';

export function FormBuilder(): React.ReactElement {
  const router = useRouter();
  
  const [formData, setFormData] = useState<FormData>({
    title: 'Title of your form',
    description: 'Your questions will be displayed below.',
    fields: [],
  });

  const [activePanel, setActivePanel] = useState<ActivePanel>('none');

  const handleHeaderApply = (title: string, description: string): void => {
    setFormData((prev) => ({
      ...prev,
      title: title || prev.title,
      description: description || prev.description,
    }));
    setActivePanel('none');
  };

  const handleTextApply = (config: {
    inputType: TextField['inputType'];
    label: string;
    placeholder: string;
    required: boolean;
  }): void => {
    const newField: TextField = {
      id: generateId(),
      type: 'text',
      inputType: config.inputType,
      label: config.label,
      placeholder: config.placeholder,
      required: config.required,
    };

    setFormData((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setActivePanel('none');
  };

  const handleChoiceApply = (config: {
    choiceType: ChoiceField['choiceType'];
    legend: string;
    options: ChoiceField['options'];
  }): void => {
    const newField: ChoiceField = {
      id: generateId(),
      type: 'choice',
      choiceType: config.choiceType,
      legend: config.legend,
      options: config.options,
    };

    setFormData((prev) => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setActivePanel('none');
  };

  const handleCancel = (): void => {
    setActivePanel('none');
  };

  const handleSave = (): void => {
    try {
      saveFormData(formData);
      alert('Form saved successfully! See the form.');
      router.push('/view-form');
    } catch (error) {
      alert('Failed to save form. Please try again.');
    }
  };

  const handlePanelClick = (panel: ActivePanel): void => {
    if (activePanel !== 'none' && activePanel !== panel) {
      return;
    }
    setActivePanel(activePanel === panel ? 'none' : panel);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        <div className="space-y-4 sm:space-y-6 order-2 xl:order-1">
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 h-[350px] sm:h-[400px] md:h-[450px] overflow-hidden">
            {activePanel === 'none' ? (
              <div className="flex items-center justify-center h-full text-gray-400 p-4">
                <div className="text-center">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <p className="text-sm sm:text-base">Select an option below to configure</p>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">
                {activePanel === 'header' && (
                  <FormHeaderEditor onApply={handleHeaderApply} onCancel={handleCancel} />
                )}
                {activePanel === 'text' && (
                  <TextFieldEditor onApply={handleTextApply} onCancel={handleCancel} />
                )}
                {activePanel === 'choice' && (
                  <ChoiceFieldEditor onApply={handleChoiceApply} onCancel={handleCancel} />
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <button
              onClick={() => handlePanelClick('header')}
              className={`p-4 sm:p-5 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border-2 ${
                activePanel === 'header' 
                  ? 'border-primary bg-primary/5 scale-95' 
                  : 'border-primary hover:border-primary/80 hover:scale-105'
              } active:scale-95`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <div className="font-semibold text-primary text-sm sm:text-base">Edit Header</div>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">Title & Description</div>
            </button>
            
            <button
              onClick={() => handlePanelClick('text')}
              className={`p-4 sm:p-5 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border-2 ${
                activePanel === 'text' 
                  ? 'border-primary bg-primary/5 scale-95' 
                  : 'border-primary hover:border-primary/80 hover:scale-105'
              } active:scale-95`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <div className="font-semibold text-primary text-sm sm:text-base">Add Text Field</div>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">Input, Email, Phone, URL</div>
            </button>
            
            <button
              onClick={() => handlePanelClick('choice')}
              className={`p-4 sm:p-5 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-200 border-2 ${
                activePanel === 'choice' 
                  ? 'border-primary bg-primary/5 scale-95' 
                  : 'border-primary hover:border-primary/80 hover:scale-105'
              } active:scale-95`}
            >
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <div className="font-semibold text-primary text-sm sm:text-base">Add Choice Field</div>
              </div>
              <div className="text-xs sm:text-sm text-gray-600">Radio or Checkbox</div>
            </button>
            
            <button
              onClick={handleSave}
              className="p-4 sm:p-5 bg-accent rounded-xl shadow-md hover:shadow-xl transition-all duration-200 text-white hover:bg-[#ff5722] active:scale-95 transform"
            >
              <div className="flex items-center gap-2 mb-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                <div className="font-semibold text-sm sm:text-base">Save Form</div>
              </div>
              <div className="text-xs sm:text-sm opacity-90">Save to Browser</div>
            </button>
          </div>
        </div>

        <div className="order-1 xl:order-2">
          <FormPreview formData={formData} />
        </div>
      </div>
    </div>
  );
}
