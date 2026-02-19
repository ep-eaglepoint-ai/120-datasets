import Link from 'next/link';
import React from 'react';

export default function HomePage(): React.ReactElement {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-800 mb-3 sm:mb-4">
            Form Generator
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto px-2">
            Create custom forms with ease. Build dynamic forms with text fields,
            multiple choice questions, checkboxes, and more. No coding required!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-12 sm:mb-16">
          <Link
            href="/build-form"
            className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-primary hover:bg-[#008a95] active:bg-[#007a85] text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 transform text-sm sm:text-base"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Build a Form
            </span>
          </Link>
          <Link
            href="/view-form"
            className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-accent hover:bg-[#ff5722] active:bg-[#e64a19] text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 transform text-sm sm:text-base"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              View Saved Form
            </span>
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border-l-4 border-primary">
            <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">Text Fields</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Add various input types including text, email, phone, and URL fields
            </p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border-l-4 border-primary">
            <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">Multiple Choice</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Create radio button and checkbox groups for user selections
            </p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border-l-4 border-primary">
            <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">Easy Customization</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Customize labels, placeholders, and field requirements
            </p>
          </div>
          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow border-l-4 border-primary">
            <h3 className="text-lg sm:text-xl font-semibold text-primary mb-2">Local Storage</h3>
            <p className="text-sm sm:text-base text-gray-600">
              Forms are saved locally in your browser for easy access
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
