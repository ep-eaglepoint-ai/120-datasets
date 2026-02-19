function Footer() {
  return (
    <footer id="contact" className="bg-charcoal text-ivory py-20">
      <div className="max-w-7xl mx-auto px-[10%] md:px-6 lg:px-12">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16 text-center md:text-left">
          <div className="lg:col-span-1 order-1">
            <a href="/" className="font-display text-3xl tracking-wider">ARTHAUS</a>
            <p className="font-body text-ivory/60 mt-4 leading-relaxed">Curating exceptional contemporary art for discerning collectors since 2014.</p>
          </div>

          <div className="order-2">
            <h4 className="font-body text-sm tracking-widest uppercase mb-6">Explore</h4>
            <ul className="space-y-3">
              {['New Arrivals', 'Best Sellers', 'Artists', 'Collections', 'Gift Cards'].map((item) => (
                <li key={item}><a href="#" className="font-body text-ivory/60 hover:text-terracotta transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>

          <div className="order-3">
            <h4 className="font-body text-sm tracking-widest uppercase mb-6">Support</h4>
            <ul className="space-y-3">
              {['Shipping Info', 'Returns', 'Art Advisory', 'FAQ', 'Contact Us'].map((item) => (
                <li key={item}><a href="#" className="font-body text-ivory/60 hover:text-terracotta transition-colors">{item}</a></li>
              ))}
            </ul>
          </div>

          <div className="order-4">
            <h4 className="font-body text-sm tracking-widest uppercase mb-6">Visit Us</h4>
            <address className="font-body text-ivory/60 not-italic leading-relaxed">
              245 Gallery Row<br />SoHo, New York<br />NY 10012
            </address>
            <p className="font-body text-ivory/60 mt-4"><a href="tel:+12125551234" className="hover:text-terracotta transition-colors">+1 (212) 555-1234</a></p>
            <p className="font-body text-ivory/60 mt-1"><a href="mailto:hello@arthaus.com" className="hover:text-terracotta transition-colors">hello@arthaus.com</a></p>
            <p className="font-body text-ivory/40 text-sm mt-4">Tue–Sat: 10am–7pm<br />Sun: 12pm–5pm</p>
          </div>

          <div className="flex gap-4 justify-center md:justify-start order-last md:order-1 md:col-span-2 lg:col-span-4 md:mt-0 mt-4" data-testid="social-icons">
            {[
              "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
              "M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84",
              "M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z",
              "M12 0c-6.627 0-12 5.372-12 12 0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.169.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146 1.124.347 2.317.535 3.554.535 6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"
            ].map((d, i) => (
              <a key={i} href="#" className="w-10 h-10 border border-ivory/20 flex items-center justify-center hover:border-terracotta hover:text-terracotta transition-colors">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d={d}/></svg>
              </a>
            ))}
          </div>
        </div>
        <div className="pt-8 border-t border-ivory/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="font-body text-sm text-ivory/40">© 2026 ARTHAUS. All rights reserved.</p>
          <div className="flex gap-6">
            {['Privacy Policy', 'Terms of Service', 'Accessibility'].map((item) => (
              <a key={item} href="#" className="font-body text-sm text-ivory/40 hover:text-ivory transition-colors">{item}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
