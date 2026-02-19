import React from 'react';
import type { FormData, FormField } from '@/lib/types';

interface FormPreviewProps {
  formData: FormData;
}

export function FormPreview({ formData }: FormPreviewProps): React.ReactElement {
  const renderField = (field: FormField): React.ReactElement => {
    if (field.type === 'text') {
      return (
        <div key={field.id} className="mb-4 sm:mb-6">
          <label htmlFor={field.id} className="form-label text-sm sm:text-base">
            {field.label} {field.required && <span className="text-red-500">*</span>}
          </label>
          <input
            id={field.id}
            type={field.inputType}
            placeholder={field.placeholder}
            required={field.required}
            className="form-input text-sm sm:text-base"
            disabled
          />
        </div>
      );
    } else {
      return (
        <fieldset key={field.id} className="mb-4 sm:mb-6 p-3 sm:p-4 border border-gray-200 rounded-lg">
          <legend className="font-medium text-gray-700 px-2 text-sm sm:text-base">{field.legend}</legend>
          <div className="space-y-2 mt-2">
            {field.options.map((option) => (
              <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type={field.choiceType}
                  id={`${field.id}-${option.id}`}
                  name={field.id}
                  value={option.value}
                  className="w-4 h-4 text-primary"
                  disabled
                />
                <span className="text-gray-700 text-sm sm:text-base">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 sm:p-6 h-[400px] sm:h-[500px] md:h-[600px] flex flex-col">
      <div className="border-b border-gray-200 pb-3 sm:pb-4 mb-3 sm:mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
          {formData.title || 'Form Preview'}
        </h2>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          {formData.description || 'Your form fields will appear below'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto pr-2">
        {formData.fields.length > 0 ? (
          <form className="space-y-3 sm:space-y-4">
            {formData.fields.map(renderField)}
          </form>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm sm:text-base">Add fields to see them here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
