import Link from 'next/link';
import React from 'react';

export function Header(): React.ReactElement {
  return (
    <header className="w-full h-14 sm:h-16 bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-full">
        <div className="flex items-center justify-between h-full">
          <Link href="/" className="text-lg sm:text-xl md:text-2xl font-bold text-primary hover:text-accent transition-colors active:scale-95">
            Form Generator
          </Link>

          <nav className="hidden md:flex items-center gap-4 lg:gap-8">
            <Link href="/" className="text-sm lg:text-base text-gray-600 hover:text-primary transition-colors font-medium active:scale-95">
              Home
            </Link>
            <Link href="/build-form" className="text-sm lg:text-base text-gray-600 hover:text-primary transition-colors font-medium active:scale-95">
              Build Form
            </Link>
            <Link href="/view-form" className="text-sm lg:text-base text-gray-600 hover:text-primary transition-colors font-medium active:scale-95">
              View Form
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
