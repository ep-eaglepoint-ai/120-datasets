import { FormBuilder } from '@/components/FormBuilder';
import React from 'react';

export default function BuildFormPage(): React.ReactElement {
  return (
    <div 
      className="min-h-[calc(100vh-4rem)] bg-cover bg-no-repeat bg-center bg-fixed"
      style={{
        backgroundImage: 'linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.5) 100%), url(/images/buildpic.jpg)'
      }}
    >
      <div className="py-4 sm:py-6 md:py-8 px-2 sm:px-4">
        <h1 className="text-center text-3xl sm:text-4xl md:text-5xl font-bold text-accent mb-4 sm:mb-6 pt-2 sm:pt-4 pb-2 sm:pb-4 drop-shadow-lg">
          Form Builder
        </h1>
        <FormBuilder />
      </div>
    </div>
  );
}
