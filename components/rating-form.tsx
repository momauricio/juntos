"use client";

import { useActionState, useState, type FormEvent } from "react";

import {
  BTN_PRIMARY,
  CARD,
  FIELD_LABEL,
  INPUT,
  TEXTAREA,
} from "@/components/ui-classes";
import { assertScore, COMMENT_MAX_LENGTH } from "@/lib/ratings";
import type { Item, Rating } from "@/lib/types";

type RatingFormProps = {
  action: (
    state: RatingFormState,
    formData: FormData,
  ) => Promise<RatingFormState>;
  item: Pick<Item, "type">;
  rating: Pick<
    Rating,
    "food" | "service" | "ambiance" | "score" | "comment"
  > | null;
};

const SCORE_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const INITIAL_ACTION_STATE: RatingFormState = { error: null };

export type RatingFormState = {
  error: string | null;
};

function scoreFromForm(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  const value = typeof rawValue === "string" ? Number(rawValue) : Number.NaN;
  assertScore(value);
  return value;
}

export function RatingForm({ action, item, rating }: RatingFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [state, formAction, isPending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );
  const isRestaurant = item.type === "restaurant";
  const displayError = error ?? state.error;

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
          : "Informe uma nota de 1 a 10.",
      );
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={validateScores}
      className={`${CARD} space-y-4`}
    >
      <h2 className="text-2xl leading-tight">
        {rating ? "Editar minha nota" : "Dar minha nota"}
      </h2>

      {isRestaurant ? (
        <div className="grid grid-cols-3 gap-2.5">
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

      <label className={FIELD_LABEL}>
        <span>Quer contar o que achou? (opcional)</span>
        <textarea
          name="comment"
          maxLength={COMMENT_MAX_LENGTH}
          rows={3}
          defaultValue={rating?.comment ?? ""}
          className={TEXTAREA}
        />
      </label>

      {displayError ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-danger">
          {displayError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className={BTN_PRIMARY}
      >
        {isPending ? "Salvando..." : "Salvar minha nota"}
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
    <label className={FIELD_LABEL}>
      <span>{label}</span>
      <select
        name={name}
        required
        defaultValue={defaultValue}
        className={INPUT}
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
