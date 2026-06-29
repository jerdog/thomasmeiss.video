import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost";

type SharedProps = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

type ButtonProps = SharedProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof SharedProps> & {
    href?: undefined;
  };

type LinkProps = SharedProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof SharedProps> & {
    href: string;
  };

type PillButtonProps = ButtonProps | LinkProps;

export function PillButton(props: PillButtonProps) {
  const {
    variant = "primary",
    children,
    className = "",
    ...rest
  } = props;

  const base =
    "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-medium tracking-wide transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember";
  const styles =
    variant === "primary"
      ? "border border-ember bg-ember text-ground hover:bg-ember-light hover:border-ember-light"
      : "border border-border bg-transparent text-bone hover:border-bone-muted hover:text-bone";

  if ("href" in props && props.href) {
    const { href, ...linkRest } = rest as Omit<LinkProps, keyof SharedProps>;
    return (
      <a href={href} className={`${base} ${styles} ${className}`} {...linkRest}>
        {children}
      </a>
    );
  }

  const buttonRest = rest as Omit<ButtonProps, keyof SharedProps>;
  return (
    <button type="button" className={`${base} ${styles} ${className}`} {...buttonRest}>
      {children}
    </button>
  );
}
