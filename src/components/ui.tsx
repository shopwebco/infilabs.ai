import * as React from "react";

function cx(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(" ");
}

export function Panel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx("glass rounded-panel p-6", className)}>{children}</div>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({
  variant = "primary",
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-card px-4 py-2.5 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice/60";
  const styles =
    variant === "primary"
      ? "cta-gradient text-[#05121b] font-semibold hover:brightness-110"
      : "border border-line text-text hover:bg-white/5";
  return (
    <button className={cx(base, styles, className)} disabled={disabled} {...props} />
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, id, className, ...props }, ref) {
    const inputId = id ?? props.name;
    return (
      <label htmlFor={inputId} className="block space-y-1.5">
        <span className="text-sm text-muted">{label}</span>
        <input
          ref={ref}
          id={inputId}
          className={cx(
            "w-full rounded-card border border-line bg-black/30 px-3 py-2.5 text-sm text-text placeholder:text-faint",
            "focus:border-ice-dim focus:outline-none focus:ring-1 focus:ring-ice-dim",
            className,
          )}
          {...props}
        />
      </label>
    );
  },
);

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("font-display text-lg font-bold tracking-tight", className)}>
      <span className="text-ice">Xe</span>
      <span className="text-violet-soft">non</span>
    </span>
  );
}
