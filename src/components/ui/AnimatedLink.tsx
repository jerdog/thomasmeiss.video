import type { AnchorHTMLAttributes, ReactNode } from "react";

interface AnimatedLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children: ReactNode;
}

export function AnimatedLink({ children, className = "", ...props }: AnimatedLinkProps) {
  return (
    <a
      className={`link-underline text-bone transition-colors hover:text-accent-light ${className}`}
      {...props}
    >
      {children}
    </a>
  );
}
