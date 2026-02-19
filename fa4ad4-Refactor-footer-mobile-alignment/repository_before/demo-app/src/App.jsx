import Header from './components/Header'
import Hero from './components/Hero'
import FeaturedCollection from './components/FeaturedCollection'
import About from './components/About'
import Newsletter from './components/Newsletter'
import Footer from './components/Footer'

function App() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <FeaturedCollection />
        <About />
        <Newsletter />
      </main>
      <Footer />
    </div>
  )
}

export default App

