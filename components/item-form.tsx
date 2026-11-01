"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { CategoryField, type FieldCategory } from "@/components/category-field";
import { useLivePause } from "@/components/use-live-pause";
import {
  BTN_PRIMARY,
  CARD,
  FIELD_LABEL,
  INPUT,
  TEXTAREA,
} from "@/components/ui-classes";
import { NOTES_PLACEHOLDER } from "@/lib/labels";
import { CITY_MAX_LENGTH } from "@/lib/city";
import type { Item } from "@/lib/types";

const INITIAL_ACTION_STATE: ItemFormState = { error: null };

export type ItemFormState = {
  error: string | null;
};

type ItemFormProps = {
  action: (state: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: Pick<Item, "title" | "url" | "notes" | "city" | "category_id"> &
    Partial<Pick<Item, "updated_at">>;
  mode: "create" | "edit";
  // Categorias do espaço, na ordem do casal (C7).
  categories: FieldCategory[];
  // "+ Adicionar em {nome}" (/items/new?categoria=…): já vem marcada.
  categoryId?: string | null;
};

export function ItemForm({ action, item, mode, categories, categoryId }: ItemFormProps) {
  const isCreate = mode === "create";
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );
  // Ao editar, mudar de categoria muda só category_id (o tipo não muda).
  const [category, setCategory] = useState<string | null>(
    item?.category_id ?? categoryId ?? null,
  );
  // Aberto = sem router.refresh() do Realtime (não troca o que está sendo digitado).
  const pauseRef = useLivePause<HTMLFormElement>();

  return (
    <form
      ref={pauseRef}
      action={formAction}
      className={`${CARD} space-y-4`}
    >
      {/* A versão que esta tela carregou: a action avisa se o par gravou depois (lib/edit-conflict.ts). */}
      {!isCreate && item?.updated_at ? (
        <input type="hidden" name="loaded_updated_at" value={item.updated_at} />
      ) : null}
      <CategoryField
        categories={categories}
        value={category}
        onChange={setCategory}
        legendClassName="mb-1.5 text-sm font-semibold text-ink"
      />

      <label className={FIELD_LABEL}>
        <span>Título</span>
        <input
          name="title"
          type="text"
          required
          defaultValue={item?.title ?? ""}
          className={INPUT}
          placeholder="Ex.: Jantar no restaurante novo"
        />
      </label>

      <label className={FIELD_LABEL}>
        <span>Cidade (opcional)</span>
        <input
          name="city"
          type="text"
          maxLength={CITY_MAX_LENGTH}
          defaultValue={item?.city ?? ""}
          className={INPUT}
          placeholder="Ex.: Gramado"
        />
      </label>

      <label className={FIELD_LABEL}>
        <span>URL</span>
        <input
          name="url"
          type="text"
          defaultValue={item?.url ?? ""}
          className={INPUT}
          placeholder="https://..."
        />
      </label>

      <label className={FIELD_LABEL}>
        <span>Notas</span>
        <textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={5}
          className={TEXTAREA}
          placeholder={NOTES_PLACEHOLDER}
        />
      </label>

      {state.error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/"
          className="inline-flex h-[52px] items-center justify-center rounded-2xl px-5 text-base font-semibold text-ink/75 transition hover:bg-accent-soft"
        >
          Voltar
        </Link>
        <button
          type="submit"
          disabled={isPending || !category}
          className={`${BTN_PRIMARY} sm:w-auto`}
        >
          {isPending
            ? isCreate
              ? "Criando..."
              : "Salvando..."
            : isCreate
              ? "Criar ideia"
              : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
