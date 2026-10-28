"use client";

import {
  useActionState,
  useState,
  type FormEvent,
  type InputHTMLAttributes,
} from "react";

import {
  BTN_PRIMARY,
  CARD,
  FIELD_LABEL,
  INPUT,
  TEXTAREA,
} from "@/components/ui-classes";
import {
  COMMENT_MAX_LENGTH,
  parseScore,
  SCORE_ERROR,
  SCORE_PATTERN,
  scoreInputValue,
} from "@/lib/ratings";
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

const INITIAL_ACTION_STATE: RatingFormState = { error: null };

export type RatingFormState = {
  error: string | null;
};

function scoreFromForm(formData: FormData, key: string) {
  const rawValue = formData.get(key);
  return parseScore(typeof rawValue === "string" ? rawValue : "");
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
          <ScoreInput
            label="Comida"
            name="food"
            required
            defaultValue={scoreInputValue(rating?.food)}
          />
          <ScoreInput
            label="Atendimento"
            name="service"
            required
            defaultValue={scoreInputValue(rating?.service)}
          />
          <ScoreInput
            label="Ambiente"
            name="ambiance"
            required
            defaultValue={scoreInputValue(rating?.ambiance)}
          />
        </div>
      ) : (
        <ScoreInput
          label="Nota"
          name="score"
          required
          defaultValue={scoreInputValue(rating?.score)}
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

type ScoreInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type" | "inputMode" | "pattern" | "className"
> & {
  label: string;
};

// Nota de 1 a 10 com até 1 casa ("8,2" ou "8.2"); quem lê o valor usa parseScore.
// Também usado no formulário de nota da demo.
export function ScoreInput({ label, ...inputProps }: ScoreInputProps) {
  return (
    <label className={FIELD_LABEL}>
      <span>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder="ex.: 8,2"
        pattern={SCORE_PATTERN}
        title={SCORE_ERROR}
        {...inputProps}
        className={INPUT}
      />
    </label>
  );
}
