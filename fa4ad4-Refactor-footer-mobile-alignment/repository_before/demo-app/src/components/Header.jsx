import { useState } from 'react'

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-ivory/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <a href="/" className="font-display text-2xl tracking-wider">
            ARTHAUS
          </a>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-12">
            <a href="#collection" className="font-body text-sm tracking-widest uppercase text-charcoal/70 hover:text-terracotta transition-colors duration-300">
              Collection
            </a>
            <a href="#artists" className="font-body text-sm tracking-widest uppercase text-charcoal/70 hover:text-terracotta transition-colors duration-300">
              Artists
            </a>
            <a href="#about" className="font-body text-sm tracking-widest uppercase text-charcoal/70 hover:text-terracotta transition-colors duration-300">
              About
            </a>
            <a href="#contact" className="font-body text-sm tracking-widest uppercase text-charcoal/70 hover:text-terracotta transition-colors duration-300">
              Contact
            </a>
          </nav>

          {/* Cart & Menu */}
          <div className="flex items-center gap-6">
            <button className="relative group">
              <svg className="w-6 h-6 text-charcoal group-hover:text-terracotta transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-terracotta text-ivory text-[10px] flex items-center justify-center rounded-full">
                2
              </span>
            </button>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <nav className="md:hidden py-8 border-t border-charcoal/10 animate-fade-in">
            <div className="flex flex-col gap-6">
              <a href="#collection" className="font-body text-sm tracking-widest uppercase">Collection</a>
              <a href="#artists" className="font-body text-sm tracking-widest uppercase">Artists</a>
              <a href="#about" className="font-body text-sm tracking-widest uppercase">About</a>
              <a href="#contact" className="font-body text-sm tracking-widest uppercase">Contact</a>
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}

export default Header

