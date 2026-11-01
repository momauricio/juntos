"use client";

import { typeHint } from "@/lib/labels";
import { ITEM_CATEGORY_LABEL, sortCategories } from "@/lib/categories";
import type { Category } from "@/lib/types";

export type FieldCategory = Pick<
  Category,
  "id" | "name" | "emoji" | "position" | "created_at" | "item_type" | "created_by"
>;

// Mockup .chip / .chip.on; a altura de toque fica no <label> (min-h-11).
const CHIP =
  "flex h-[34px] cursor-pointer items-center gap-1.5 rounded-full bg-ink/[0.07] px-[13px] text-sm font-semibold text-ink transition peer-checked:bg-accent peer-checked:text-accent-contrast peer-focus-visible:ring-4 peer-focus-visible:ring-accent-soft";

// Campo "Categoria" (no lugar do antigo "Tipo"): chips "{emoji} {nome}" na
// ordem do casal (C7). Grava `category_id`; o servidor confere o espaço.
export function CategoryField({
  categories,
  value,
  onChange,
  legendClassName,
  name = "category_id",
}: {
  categories: readonly FieldCategory[];
  value: string | null;
  onChange: (id: string) => void;
  legendClassName: string;
  name?: string;
}) {
  const selected = categories.find((category) => category.id === value) ?? null;
  // Dica só nas categorias padrão (semeadas: created_by null), que vêm de um
  // tipo; nas do casal não há o que explicar.
  const hint = selected && selected.created_by === null ? typeHint(selected.item_type) : "";

  return (
    <fieldset>
      <legend className={legendClassName}>{ITEM_CATEGORY_LABEL}</legend>
      <div className="flex flex-wrap gap-x-1.5 pt-1">
        {sortCategories(categories).map((category) => (
          <label key={category.id} className="flex min-h-11 items-center">
            <input
              type="radio"
              name={name}
              value={category.id}
              checked={value === category.id}
              onChange={() => onChange(category.id)}
              className="peer sr-only"
            />
            <span className={CHIP}>
              <span aria-hidden="true">{category.emoji}</span>
              {category.name}
              {value === category.id ? " ✓" : null}
            </span>
          </label>
        ))}
      </div>
      {selected && hint ? (
        <div className="mt-1.5 flex items-start gap-2.5 rounded-[14px] bg-accent-soft px-3 py-2.5 text-[14.5px] text-ink">
          <span aria-hidden="true" className="text-xl leading-6">
            {selected.emoji}
          </span>
          <p>
            <b>{selected.name}</b>
            <br />
            {hint}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
