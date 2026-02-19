function About() {
  return (
    <section id="about" className="py-32 relative overflow-hidden">
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-sand/30" />
      
      <div className="max-w-7xl mx-auto px-6 lg:px-12 relative">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Image Composition */}
          <div className="relative">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-8 col-start-1">
                <div className="aspect-[4/5] overflow-hidden">
                  <img 
                    src="https://images.unsplash.com/photo-1577720643272-265f09367456?w=600&h=750&fit=crop"
                    alt="Art Gallery Interior"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="col-span-6 col-start-6 -mt-32 relative z-10">
                <div className="aspect-square overflow-hidden shadow-2xl">
                  <img 
                    src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400&h=400&fit=crop"
                    alt="Artist at Work"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>
            
            {/* Experience Badge */}
            <div className="absolute -bottom-8 left-8 bg-terracotta text-ivory p-8 shadow-xl">
              <span className="font-display text-5xl block">12</span>
              <span className="font-body text-sm tracking-widest uppercase">Years of Excellence</span>
            </div>
          </div>

          {/* Content */}
          <div className="lg:pl-12">
            <span className="font-body text-sm tracking-[0.3em] uppercase text-terracotta">
              Our Story
            </span>
            
            <h2 className="font-display text-4xl md:text-5xl mt-4 mb-8 leading-tight">
              Bridging Artists
              <br />
              <span className="italic">& Collectors</span>
            </h2>
            
            <div className="space-y-6 font-body text-charcoal/70 leading-relaxed">
              <p>
                Founded in 2014, ARTHAUS emerged from a simple belief: exceptional art should be 
                accessible to passionate collectors everywhere. We've built a platform that 
                celebrates artistic vision while creating meaningful connections between creators 
                and appreciators.
              </p>
              <p>
                Our curatorial team travels the globe, discovering emerging talents and working 
                with established masters. Each piece in our collection is selected not just for 
                its aesthetic merit, but for its ability to transform spaces and inspire minds.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-8 mt-12">
              <div>
                <div className="w-12 h-12 bg-charcoal/5 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl mb-2">Authenticated</h3>
                <p className="font-body text-sm text-charcoal/60">
                  Every artwork comes with a certificate of authenticity and provenance documentation.
                </p>
              </div>

              <div>
                <div className="w-12 h-12 bg-charcoal/5 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <h3 className="font-display text-xl mb-2">Secure Shipping</h3>
                <p className="font-body text-sm text-charcoal/60">
                  Museum-grade packaging and white-glove delivery to your doorstep worldwide.
                </p>
              </div>

              <div>
                <div className="w-12 h-12 bg-charcoal/5 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl mb-2">Art Advisory</h3>
                <p className="font-body text-sm text-charcoal/60">
                  Complimentary consultation with our experts to find your perfect piece.
                </p>
              </div>

              <div>
                <div className="w-12 h-12 bg-charcoal/5 flex items-center justify-center mb-4">
                  <svg className="w-6 h-6 text-terracotta" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <h3 className="font-display text-xl mb-2">Flexible Payment</h3>
                <p className="font-body text-sm text-charcoal/60">
                  Interest-free installment plans available for qualifying purchases.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default About

