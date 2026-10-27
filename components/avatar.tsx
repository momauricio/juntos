type AvatarTone = "terracotta" | "sage";

type AvatarProps = {
  label: string;
  size?: "xs" | "md" | "sm" | "lg" | "xl";
  tone?: AvatarTone;
  dashed?: boolean;
  className?: string;
};

const SIZES = {
  xs: "h-[22px] w-[22px] text-[11px] font-bold",
  md: "h-[30px] w-[30px] text-sm font-bold",
  sm: "h-11 w-11 text-lg",
  lg: "h-14 w-14 text-2xl",
  xl: "h-16 w-16 text-[26px]",
};

const TONES: Record<AvatarTone, string> = {
  terracotta: "bg-accent text-accent-contrast",
  sage: "bg-sage text-white",
};

// Primeira letra do nome, em maiúscula.
export function initial(name: string) {
  return (Array.from(name.trim())[0] ?? "?").toUpperCase();
}

// Cor do avatar pela ordem de entrada no espaço: 1º terracota, 2º sálvia.
export function memberTone(index: number): AvatarTone {
  return index === 1 ? "sage" : "terracotta";
}

export function Avatar({
  label,
  size = "sm",
  tone = "terracotta",
  dashed = false,
  className = "",
}: AvatarProps) {
  const small = size === "xs" || size === "md";

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${
        dashed
          ? "border-2 border-dashed border-foreground/50 text-foreground/70"
          : `${TONES[tone]} ${small ? "" : "shadow-lg shadow-accent/30"}`
      } ${className}`}
    >
      {label}
    </span>
  );
}
