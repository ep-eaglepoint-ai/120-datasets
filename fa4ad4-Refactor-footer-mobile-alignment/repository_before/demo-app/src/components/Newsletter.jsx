import { useState } from 'react'

function Newsletter() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (email) {
      setIsSubmitted(true)
      setEmail('')
    }
  }

  return (
    <section className="py-32 bg-gradient-to-br from-sage/20 via-ivory to-sand/30 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 border border-charcoal/5 rounded-full" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 border border-charcoal/5 rounded-full" />
      
      <div className="max-w-4xl mx-auto px-6 lg:px-12 text-center relative">
        <span className="font-body text-sm tracking-[0.3em] uppercase text-terracotta">
          Stay Inspired
        </span>
        
        <h2 className="font-display text-4xl md:text-6xl mt-4 mb-6 leading-tight">
          Join Our
          <br />
          <span className="italic">Art Circle</span>
        </h2>
        
        <p className="font-body text-charcoal/70 max-w-xl mx-auto mb-10 leading-relaxed">
          Be the first to discover new arrivals, exclusive exhibitions, and special collector events. 
          Receive curated content delivered to your inbox weekly.
        </p>

        {isSubmitted ? (
          <div className="inline-flex items-center gap-3 bg-sage/30 px-8 py-4">
            <svg className="w-6 h-6 text-sage" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-body text-charcoal">Welcome to the circle. Check your inbox soon.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address"
              className="flex-1 px-6 py-4 bg-ivory border border-charcoal/20 font-body text-charcoal placeholder:text-charcoal/40 focus:outline-none focus:border-terracotta transition-colors"
              required
            />
            <button type="submit" className="btn-primary whitespace-nowrap">
              Subscribe
            </button>
          </form>
        )}

        <p className="font-body text-xs text-charcoal/40 mt-6">
          By subscribing, you agree to our Privacy Policy. Unsubscribe anytime.
        </p>

        {/* Trust Badges */}
        <div className="flex flex-wrap justify-center gap-8 mt-16 pt-16 border-t border-charcoal/10">
          <div className="flex items-center gap-3 text-charcoal/40">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            <span className="font-body text-sm">As seen in Architectural Digest</span>
          </div>
          <div className="flex items-center gap-3 text-charcoal/40">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
            <span className="font-body text-sm">Featured in Elle Decor</span>
          </div>
          <div className="flex items-center gap-3 text-charcoal/40">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
            </svg>
            <span className="font-body text-sm">4.9 Rating from Collectors</span>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Newsletter

