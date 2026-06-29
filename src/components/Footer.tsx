import { site, socialLinks } from "../data/content";
import { AnimatedLink } from "./ui/AnimatedLink";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t border-border px-6 py-12 lg:px-10"
      aria-label="Site footer"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <p className="font-display text-lg text-bone">{site.name}</p>
        <ul className="flex flex-wrap gap-6">
          {socialLinks.map((link) => (
            <li key={link.label}>
              <AnimatedLink
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${link.label} (opens in new tab)`}
                className="inline-flex min-h-11 items-center text-sm"
              >
                {link.label}
              </AnimatedLink>
            </li>
          ))}
        </ul>
        <p className="font-body text-xs text-bone-muted">
          © {year} {site.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
