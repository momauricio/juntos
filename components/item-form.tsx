import Link from "next/link";

import { TYPE_LABELS } from "@/lib/labels";
import type { Item, ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];

type ItemFormProps = {
  action: (formData: FormData) => Promise<void>;
  item?: Pick<Item, "title" | "type" | "url" | "notes">;
  mode: "create" | "edit";
};

export function ItemForm({ action, item, mode }: ItemFormProps) {
  const isCreate = mode === "create";

  return (
    <form
      action={action}
      className="space-y-5 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
    >
      {isCreate ? (
        <label className="block space-y-2 text-sm font-medium text-stone-800">
          <span>Tipo</span>
          <select
            name="type"
            required
            defaultValue={item?.type ?? "restaurant"}
            className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
          >
            {ITEM_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
      ) : item ? (
        <div className="space-y-2 text-sm font-medium text-stone-800">
          <span>Tipo</span>
          <p className="h-12 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-base font-normal text-stone-600">
            {TYPE_LABELS[item.type]}
          </p>
          <p className="text-xs font-normal text-stone-500">
            O tipo fica bloqueado depois que a ideia é criada.
          </p>
        </div>
      ) : null}

      <label className="block space-y-2 text-sm font-medium text-stone-800">
        <span>Título</span>
        <input
          name="title"
          type="text"
          required
          defaultValue={item?.title ?? ""}
          className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
          placeholder="Ex.: Jantar no restaurante novo"
        />
      </label>

      <label className="block space-y-2 text-sm font-medium text-stone-800">
        <span>URL</span>
        <input
          name="url"
          type="text"
          defaultValue={item?.url ?? ""}
          className="h-12 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
          placeholder="https://..."
        />
      </label>

      <label className="block space-y-2 text-sm font-medium text-stone-800">
        <span>Notas</span>
        <textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          rows={5}
          className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
          placeholder="Detalhes, horários, endereço ou qualquer lembrança."
        />
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-2xl px-5 text-base font-semibold text-stone-700 transition hover:bg-stone-100"
        >
          Voltar
        </Link>
        <button
          type="submit"
          className="h-12 rounded-2xl bg-rose-500 px-5 text-base font-semibold text-white transition hover:bg-rose-600"
        >
          {isCreate ? "Criar ideia" : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
