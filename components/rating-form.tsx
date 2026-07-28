"use client";

import { useActionState, useState, type FormEvent } from "react";

import { assertScore, displayRating, restaurantAverage } from "@/lib/ratings";
import type { Item, Rating } from "@/lib/types";

type RatingFormProps = {
  action: (
    state: RatingFormState,
    formData: FormData,
  ) => Promise<RatingFormState>;
  item: Pick<Item, "type" | "status">;
  rating: Pick<Rating, "food" | "service" | "ambiance" | "score"> | null;
};

const SCORE_OPTIONS = [1, 2, 3, 4, 5];
const INITIAL_ACTION_STATE: RatingFormState = { error: null };

export type RatingFormState = {
  error: string | null;
};

function formatRating(value: number) {
  return value.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
}

function scoreFromForm(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  const value = typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
  assertScore(value);
  return value;
}

function restaurantSummary(
  rating: Pick<Rating, "food" | "service" | "ambiance"> | null,
) {
  if (
    rating?.food == null ||
    rating.service == null ||
    rating.ambiance == null
  ) {
    return null;
  }

  const average = restaurantAverage(
    rating.food,
    rating.service,
    rating.ambiance,
  );

  return `Comida ${rating.food} · Atendimento ${rating.service} · Ambiente ${
    rating.ambiance
  } · Média ${formatRating(average)}`;
}

export function RatingForm({ action, item, rating }: RatingFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );
  const isRestaurant = item.type === "restaurant";
  const currentRating = rating ? displayRating(rating) : null;
  const displayError = error ?? state.error;
  const currentSummary = isRestaurant
    ? restaurantSummary(rating)
    : currentRating != null
      ? `Nota atual ${formatRating(currentRating)}`
      : null;

  function validateScores(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);

    try {
      if (isRestaurant) {
        scoreFromForm(formData, "food");
        scoreFromForm(formData, "service");
        scoreFromForm(formData, "ambiance");
      } else {
        scoreFromForm(formData, "score");
      }

      setError(null);
    } catch (validationError) {
      event.preventDefault();
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Informe uma nota de 1 a 5.",
      );
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={validateScores}
      className="space-y-5 rounded-3xl bg-surface p-6 ring-1 ring-border"
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
          Avaliação compartilhada
        </p>
        <h2 className="font-serif text-2xl font-semibold tracking-tight">
          {rating ? "Editar nota" : "Marcar como feito"}
        </h2>
        <p className="text-sm leading-6 text-foreground/70">
          {rating
            ? "Atualize a nota que aparece para vocês dois."
            : "Salve a nota para marcar esta ideia como feita."}
        </p>
        {currentSummary ? (
          <p className="text-sm font-medium text-foreground/75">
            {currentSummary}
          </p>
        ) : null}
      </div>

      {isRestaurant ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <ScoreSelect
            label="Comida"
            name="food"
            defaultValue={rating?.food ?? ""}
          />
          <ScoreSelect
            label="Atendimento"
            name="service"
            defaultValue={rating?.service ?? ""}
          />
          <ScoreSelect
            label="Ambiente"
            name="ambiance"
            defaultValue={rating?.ambiance ?? ""}
          />
        </div>
      ) : (
        <ScoreSelect
          label="Nota"
          name="score"
          defaultValue={rating?.score ?? ""}
        />
      )}

      {displayError ? (
        <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
          {displayError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="h-12 w-full rounded-2xl bg-accent-strong px-5 text-base font-semibold text-accent-contrast transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isPending
          ? "Salvando..."
          : item.status === "want"
            ? "Marcar como feito e salvar nota"
            : "Salvar nota"}
      </button>
    </form>
  );
}

type ScoreSelectProps = {
  label: string;
  name: string;
  defaultValue: number | "";
};

function ScoreSelect({ label, name, defaultValue }: ScoreSelectProps) {
  return (
    <label className="block space-y-2 text-sm font-medium text-foreground/85">
      <span>{label}</span>
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
      >
        <option value="" disabled>
          Escolha
        </option>
        {SCORE_OPTIONS.map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </label>
  );
}
