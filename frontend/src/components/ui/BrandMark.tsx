import { cn } from "../../lib/cn";

type Variant = "tile" | "plain";

export function BrandMark({
  size = 28,
  variant = "tile",
  className,
}: {
  size?: number;
  variant?: Variant;
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {variant === "tile" ? (
        <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--logo-bg)" stroke="var(--logo-border)" />
      ) : null}
      <path
        fill="var(--logo-fg)"
        d="M18 6C22 6 26 9 26 14C26 18 24 20 21 21C23 22 25 23 23 25C20 27 15 27 12 24C10 22 10 18 12 15C13 12 15 8 18 6Z"
      />
      <rect x="5" y="19" width="4" height="6" rx="2" fill="var(--logo-accent)" />
    </svg>
  );
}
