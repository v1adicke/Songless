// Small shared UI primitives in the corporate-noir style.

import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "subtle" | "danger";
  children: ReactNode;
}

export function Button({
  variant = "subtle",
  className,
  children,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium tracking-tight transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const variants: Record<string, string> = {
    primary:
      "bg-[var(--color-accent)] text-[var(--color-noir-950)] hover:bg-white active:scale-[0.98]",
    ghost:
      "bg-transparent text-[var(--color-accent-dim)] hover:text-[var(--color-accent)] hover:bg-[var(--color-noir-800)]",
    subtle:
      "bg-[var(--color-noir-800)] text-[var(--color-accent)] border border-[var(--color-line)] hover:border-[var(--color-line-strong)] hover:bg-[var(--color-noir-700)] active:scale-[0.98]",
    danger:
      "bg-transparent text-[var(--color-close)] border border-[var(--color-close)]/40 hover:border-[var(--color-close)] hover:bg-[var(--color-close)]/10 active:scale-[0.98]",
  };
  return (
    <button className={cx(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-[var(--color-line)] bg-[var(--color-noir-900)]/70 backdrop-blur-xl shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "rounded-full border px-4 py-2 text-sm font-medium tracking-tight transition-all duration-200 active:scale-[0.97]",
        active
          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-noir-950)]"
          : "border-[var(--color-line)] bg-[var(--color-noir-800)] text-[var(--color-accent-dim)] hover:border-[var(--color-line-strong)] hover:text-[var(--color-accent)]"
      )}
    >
      {children}
    </button>
  );
}

// Animated equalizer bars used as the audio/loading indicator.
export function Equalizer({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[3px] h-4">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cx(
            "w-[3px] rounded-full bg-current",
            active ? "eq-bar" : ""
          )}
          style={{
            height: "100%",
            animationDelay: `${i * 0.15}s`,
            transform: active ? undefined : "scaleY(0.4)",
          }}
        />
      ))}
    </div>
  );
}
