const artworks = [
  {
    id: 1,
    title: "Chromatic Resonance",
    artist: "Maya Chen",
    price: 2800,
    image: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=500&h=600&fit=crop",
    category: "Abstract"
  },
  {
    id: 2,
    title: "Urban Solitude",
    artist: "James Morrison",
    price: 4500,
    image: "https://images.unsplash.com/photo-1578321272176-b7bbc0679853?w=500&h=600&fit=crop",
    category: "Contemporary"
  },
  {
    id: 3,
    title: "Nature's Whisper",
    artist: "Sofia Larsson",
    price: 3200,
    image: "https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=500&h=600&fit=crop",
    category: "Minimalist"
  },
  {
    id: 4,
    title: "Digital Horizon",
    artist: "Kai Yamamoto",
    price: 5800,
    image: "https://images.unsplash.com/photo-1549289524-06cf8837ace5?w=500&h=600&fit=crop",
    category: "Digital"
  },
]

function FeaturedCollection() {
  return (
    <section id="collection" className="py-32 bg-charcoal text-ivory">
      <div className="max-w-7xl mx-auto px-6 lg:px-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8 mb-16">
          <div>
            <span className="font-body text-sm tracking-[0.3em] uppercase text-terracotta">
              Featured Works
            </span>
            <h2 className="font-display text-4xl md:text-6xl mt-4 leading-tight">
              Curated
              <br />
              <span className="italic">Excellence</span>
            </h2>
          </div>
          <p className="font-body text-ivory/60 max-w-md leading-relaxed">
            Hand-selected pieces that represent the pinnacle of contemporary artistic expression. 
            Each work has been chosen for its unique vision and masterful execution.
          </p>
        </div>

        {/* Artwork Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {artworks.map((artwork, index) => (
            <article 
              key={artwork.id}
              className="group cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="relative aspect-[5/6] overflow-hidden bg-ivory/5 mb-4">
                <img 
                  src={artwork.image}
                  alt={artwork.title}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                
                {/* Quick View Button */}
                <button className="absolute bottom-4 left-4 right-4 py-3 bg-ivory text-charcoal font-body text-sm tracking-widest uppercase translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                  Quick View
                </button>

                {/* Category Tag */}
                <span className="absolute top-4 left-4 px-3 py-1 bg-charcoal/80 backdrop-blur-sm font-body text-xs tracking-wider uppercase">
                  {artwork.category}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="font-display text-xl group-hover:text-terracotta transition-colors duration-300">
                  {artwork.title}
                </h3>
                <p className="font-body text-sm text-ivory/50">
                  {artwork.artist}
                </p>
                <p className="font-body text-terracotta">
                  ${artwork.price.toLocaleString()}
                </p>
              </div>
            </article>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-16">
          <a 
            href="#" 
            className="inline-flex items-center gap-3 font-body text-sm tracking-widest uppercase text-ivory/70 hover:text-terracotta transition-colors duration-300 group"
          >
            View All Artworks
            <svg 
              className="w-5 h-5 transform group-hover:translate-x-2 transition-transform duration-300" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  )
}

export default FeaturedCollection

