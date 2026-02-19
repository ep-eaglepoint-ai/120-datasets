function Hero() {
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231a1a1a' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
      </div>

      {/* Floating Shapes */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-terracotta/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/3 left-1/4 w-96 h-96 bg-sage/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

      <div className="max-w-7xl mx-auto px-6 lg:px-12 w-full">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Text Content */}
          <div className="relative z-10">
            <span className="inline-block font-body text-sm tracking-[0.3em] uppercase text-terracotta mb-6 opacity-0 animate-slide-up">
              Curated Collection 2026
            </span>
            
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl leading-[0.9] mb-8 opacity-0 animate-slide-up animate-delay-100">
              Where Art
              <br />
              <span className="italic text-terracotta">Meets</span>
              <br />
              Living
            </h1>
            
            <p className="font-body text-lg text-charcoal/70 max-w-md mb-10 leading-relaxed opacity-0 animate-slide-up animate-delay-200">
              Discover extraordinary contemporary artworks from emerging and established artists. 
              Each piece tells a story, waiting to become part of yours.
            </p>
            
            <div className="flex flex-wrap gap-4 opacity-0 animate-slide-up animate-delay-300">
              <a href="#collection" className="btn-primary">
                Explore Collection
              </a>
              <a href="#about" className="btn-outline">
                Our Story
              </a>
            </div>

            {/* Stats */}
            <div className="flex gap-12 mt-16 pt-8 border-t border-charcoal/10 opacity-0 animate-slide-up animate-delay-400">
              <div>
                <span className="font-display text-4xl text-terracotta">500+</span>
                <p className="font-body text-sm text-charcoal/60 mt-1">Original Artworks</p>
              </div>
              <div>
                <span className="font-display text-4xl text-terracotta">120</span>
                <p className="font-body text-sm text-charcoal/60 mt-1">Global Artists</p>
              </div>
              <div>
                <span className="font-display text-4xl text-terracotta">15k</span>
                <p className="font-body text-sm text-charcoal/60 mt-1">Happy Collectors</p>
              </div>
            </div>
          </div>

          {/* Hero Image Grid */}
          <div className="relative">
            <div className="grid grid-cols-12 gap-4">
              {/* Main Image */}
              <div className="col-span-8 row-span-2 opacity-0 animate-slide-up animate-delay-200">
                <div className="aspect-[3/4] bg-gradient-to-br from-charcoal via-charcoal/90 to-charcoal/70 relative overflow-hidden group">
                  <img 
                    src="https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=600&h=800&fit=crop"
                    alt="Abstract Modern Art"
                    className="w-full h-full object-cover mix-blend-luminosity opacity-80 group-hover:opacity-100 group-hover:mix-blend-normal transition-all duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent" />
                  <div className="absolute bottom-6 left-6 right-6">
                    <span className="font-body text-xs tracking-widest uppercase text-ivory/60">Featured</span>
                    <h3 className="font-display text-2xl text-ivory mt-1">Ethereal Dreams</h3>
                    <p className="font-body text-ivory/80 mt-1">$3,200</p>
                  </div>
                </div>
              </div>

              {/* Secondary Images */}
              <div className="col-span-4 opacity-0 animate-slide-up animate-delay-300">
                <div className="aspect-square bg-sage/20 overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=400&h=400&fit=crop"
                    alt="Modern Sculpture"
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
                  />
                </div>
              </div>

              <div className="col-span-4 opacity-0 animate-slide-up animate-delay-400">
                <div className="aspect-square bg-terracotta/20 overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1549887534-1541e9326642?w=400&h=400&fit=crop"
                    alt="Contemporary Art"
                    className="w-full h-full object-cover hover:scale-110 transition-transform duration-700"
                  />
                </div>
              </div>
            </div>

            {/* Decorative Element */}
            <div className="absolute -bottom-8 -left-8 w-32 h-32 border border-terracotta/30" />
            <div className="absolute -top-4 -right-4 w-24 h-24 border border-sage/30" />
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-0 animate-fade-in animate-delay-600">
        <span className="font-body text-xs tracking-widest uppercase text-charcoal/40">Scroll</span>
        <div className="w-px h-12 bg-gradient-to-b from-charcoal/40 to-transparent" />
      </div>
    </section>
  )
}

export default Hero

