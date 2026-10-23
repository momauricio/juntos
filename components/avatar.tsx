type AvatarProps = {
  label: string;
  size?: "sm" | "lg";
  dashed?: boolean;
  className?: string;
};

const SIZES = {
  sm: "h-11 w-11 text-lg",
  lg: "h-24 w-24 text-4xl",
};

// Primeira letra do nome, em maiúscula.
export function initial(name: string) {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

export function Avatar({
  label,
  size = "sm",
  dashed = false,
  className = "",
}: AvatarProps) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${
        dashed
          ? "border-2 border-dashed border-foreground/50 text-foreground/70"
          : "bg-accent text-accent-contrast shadow-lg shadow-accent/30"
      } ${className}`}
    >
      {label}
    </span>
  );
}
