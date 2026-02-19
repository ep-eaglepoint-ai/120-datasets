'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadFormData } from '@/lib/formStorage';
import type { FormData, FormField } from '@/lib/types';

export function FormDisplay(): React.ReactElement {
  const [formData, setFormData] = useState<FormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const data = loadFormData();
    setFormData(data);
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="flex justify-center items-center min-h-[500px]">
        <div className="text-center bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800">No Form Found</h2>
          <p className="text-gray-600 mb-6">You haven't created any forms yet.</p>
          <Link
            href="/build-form"
            className="px-6 py-3 bg-primary hover:bg-[#008a95] text-white font-medium rounded-lg transition-colors inline-block"
          >
            Create Your First Form
          </Link>
        </div>
      </div>
    );
  }

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
          />
        </div>
      );
    } else {
      return (
        <fieldset key={field.id} className="mb-4 sm:mb-6 p-3 sm:p-4 border border-gray-200 rounded-lg">
          <legend className="font-medium text-gray-700 px-2 text-sm sm:text-base">{field.legend}</legend>
          <div className="space-y-2 mt-2">
            {field.options.map((option) => (
              <label key={option.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded transition-colors">
                <input
                  type={field.choiceType}
                  id={`${field.id}-${option.id}`}
                  name={field.id}
                  value={option.value}
                  className="w-4 h-4 text-primary cursor-pointer"
                />
                <span className="text-gray-700 text-sm sm:text-base">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      );
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    alert('Form submitted successfully!');
    e.currentTarget.reset();
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-4 sm:py-6 md:py-8 px-2 sm:px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-4 sm:p-6 md:p-8">
          <div className="border-b border-gray-200 pb-4 sm:pb-6 mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800">{formData.title}</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-2">{formData.description}</p>
          </div>
          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            {formData.fields.map(renderField)}
            <div className="pt-4 sm:pt-6 border-t border-gray-200">
              <button
                type="submit"
                className="w-full bg-primary hover:bg-[#008a95] active:bg-[#007a85] text-white font-medium py-3 sm:py-4 px-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 transform text-sm sm:text-base"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Submit Form
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
