import type { ReactNode } from "react";

import type { CategoryColor } from "@/lib/types";

// Quadrado da categoria (mockup .cat): o do início e a prévia das folhas 54/55c.
export const TILE_BASE =
  "relative flex aspect-square w-full flex-col overflow-hidden rounded-[24px] p-3.5 text-left shadow-[0_10px_24px_rgba(0,0,0,0.25)]";
export const TILE_SHADE =
  "pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(10,14,26,0.35))]";
export const TILE_TEXT_SHADOW = "[text-shadow:0_1px_6px_rgba(0,0,0,0.3)]";

const SIZES = {
  // Início (50/51).
  home: {
    emoji: "text-[42px]",
    count: "text-[28px]",
    name: "text-[19px]",
    sample: "text-[12.5px]",
  },
  // Prévia (54/55c): 132px, mais compacta.
  preview: {
    emoji: "text-[34px]",
    count: "text-[22px]",
    name: "text-[17px]",
    sample: "text-[11.5px]",
  },
} as const;

// Miolo do quadrado: emoji, número, nome, extra (selo da média) e amostra.
// `corner` troca o número (modo de ordem: a alça "↕").
export function CategoryTileFace({
  emoji,
  name,
  count,
  sample,
  size = "home",
  extra,
  sampleLines = 2,
  corner,
}: {
  emoji: string;
  name: string;
  count: number;
  sample: string;
  size?: keyof typeof SIZES;
  extra?: ReactNode;
  sampleLines?: 1 | 2;
  corner?: ReactNode;
}) {
  const s = SIZES[size];

  return (
    <>
      <span aria-hidden="true" className={TILE_SHADE} />
      <span className="relative flex items-start justify-between">
        <span aria-hidden="true" className={`${s.emoji} leading-none`}>
          {emoji}
        </span>
        {corner ?? (
          <span
            className={`font-serif ${s.count} font-semibold leading-none ${TILE_TEXT_SHADOW}`}
          >
            {count}
          </span>
        )}
      </span>
      <span
        className={`relative mt-auto ${s.name} font-bold leading-[1.15] ${TILE_TEXT_SHADOW} break-words`}
      >
        {name}
      </span>
      {extra}
      <span
        className={`relative mt-[3px] ${s.sample} leading-[1.3] opacity-[0.92] [text-shadow:0_1px_4px_rgba(0,0,0,0.3)] ${
          sampleLines === 1 ? "line-clamp-1" : "line-clamp-2"
        }`}
      >
        {sample}
      </span>
    </>
  );
}

// Prévia das folhas (54 e 55c): quadrado de 132px.
export function CategoryPreviewTile({
  emoji,
  name,
  color,
  count,
  sample,
  className = "",
}: {
  emoji: string;
  name: string;
  color: CategoryColor;
  count: number;
  sample: string;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative flex aspect-square w-[132px] shrink-0 flex-col overflow-hidden rounded-[20px] p-3 text-white shadow-[0_10px_24px_rgba(0,0,0,0.25)] ${color} ${className}`}
    >
      <CategoryTileFace
        emoji={emoji}
        name={name}
        count={count}
        sample={sample}
        size="preview"
      />
    </div>
  );
}
