"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  BTN_PRIMARY,
  CARD,
  FIELD_LABEL,
  INPUT,
  TEXTAREA,
} from "@/components/ui-classes";
import { TYPE_LABELS } from "@/lib/labels";
import type { Item, ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const INITIAL_ACTION_STATE: ItemFormState = { error: null };

export type ItemFormState = {
  error: string | null;
};

type ItemFormProps = {
  action: (state: ItemFormState, formData: FormData) => Promise<ItemFormState>;
  item?: Pick<Item, "title" | "type" | "url" | "notes">;
  mode: "create" | "edit";
};

export function ItemForm({ action, item, mode }: ItemFormProps) {
  const isCreate = mode === "create";
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );

  return (
    <form
      action={formAction}
      className={`${CARD} space-y-4`}
    >
      {isCreate ? (
        <label className={FIELD_LABEL}>
          <span>Tipo</span>
          <select
            name="type"
            required
            defaultValue={item?.type ?? "restaurant"}
            className={INPUT}
          >
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      ) : item ? (
        <div className="space-y-1.5 text-sm font-semibold text-ink">
          <span>Tipo</span>
          <p className="flex h-[50px] items-center rounded-xl border border-ink/20 bg-surface-muted px-3.5 text-base font-normal text-ink/70">
            {TYPE_LABELS[item.type]}
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
          placeholder="Detalhes, horários, endereço ou qualquer lembrança."
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
