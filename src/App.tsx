import { About } from "./components/About";
import { ContactForm } from "./components/ContactForm";
import { Footer } from "./components/Footer";
import { Hero } from "./components/Hero";
import { Nav } from "./components/Nav";
import { Services } from "./components/Services";
import { Showreel } from "./components/Showreel";
import { TrustMarquee } from "./components/TrustMarquee";
import { WorkGrid } from "./components/WorkGrid";

export default function App() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-ground"
      >
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <Hero />
        <TrustMarquee />
        <Showreel />
        <WorkGrid />
        <Services />
        <About />
        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
