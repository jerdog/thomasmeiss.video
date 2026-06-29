import { useEffect, useState } from "react";
import { navLinks, site } from "../data/content";
import { PillButton } from "./ui/PillButton";

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border bg-ground/80 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav
        className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-10"
        aria-label="Main"
      >
        <a
          href="#"
          className="font-display text-lg tracking-tight text-bone transition-colors hover:text-ember-light"
        >
          {site.name}
        </a>
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="link-underline font-body text-sm text-bone-muted transition-colors hover:text-bone"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
        <PillButton href="#contact" className="text-xs md:text-sm">
          Start a project
        </PillButton>
      </nav>
    </header>
  );
}
