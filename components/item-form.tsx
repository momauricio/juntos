"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { TypeHintBox } from "@/components/item-visuals";
import { useLivePause } from "@/components/use-live-pause";
import {
  BTN_PRIMARY,
  CARD,
  FIELD_LABEL,
  INPUT,
  TEXTAREA,
} from "@/components/ui-classes";
import {
  NOTES_PLACEHOLDER,
  TYPE_EMOJI,
  TYPE_LABELS,
  typeLabel,
} from "@/lib/labels";
import { CITY_MAX_LENGTH } from "@/lib/city";
import type { Item, ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const INITIAL_ACTION_STATE: ItemFormState = { error: null };

export type ItemFormState = {
  error: string | null;
};

type ItemFormProps = {
  action: (state: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: Pick<Item, "title" | "type" | "url" | "notes" | "city"> &
    Partial<Pick<Item, "updated_at">>;
  mode: "create" | "edit";
  // "+ Adicionar em {nome}" (/items/new?categoria=…): o tipo da categoria já
  // vem marcado e, enquanto ele não mudar, o item vai para ela. O campo
  // "Categoria" de verdade entra no PR 6.
  category?: { id: string; item_type: ItemType } | null;
};

export function ItemForm({ action, item, mode, category }: ItemFormProps) {
  const isCreate = mode === "create";
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );
  const [type, setType] = useState<ItemType>(
    item?.type ?? category?.item_type ?? "restaurant",
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
      {isCreate && category && category.item_type === type ? (
        <input type="hidden" name="category_id" value={category.id} />
      ) : null}
      {isCreate ? (
        <div className="space-y-2.5">
          <label className={FIELD_LABEL}>
            <span>Tipo</span>
            <select
              name="type"
              required
              value={type}
              onChange={(event) => setType(event.target.value as ItemType)}
              className={INPUT}
            >
              {ITEM_TYPES.map((option) => (
                <option key={option} value={option}>
                  {TYPE_EMOJI[option]} {TYPE_LABELS[option]}
                </option>
              ))}
            </select>
          </label>
          <TypeHintBox type={type} />
        </div>
      ) : item ? (
        <div className="space-y-1.5 text-sm font-semibold text-ink">
          <span>Tipo</span>
          <p className="flex h-[50px] items-center rounded-xl border border-ink/20 bg-surface-muted px-3.5 text-base font-normal text-ink/70">
            {typeLabel(item.type)}
          </p>
          <p className="text-xs font-normal text-ink/60">
            O tipo fica bloqueado depois que a ideia é criada.
          </p>
        </div>
      ) : null}

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
          disabled={isPending}
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
