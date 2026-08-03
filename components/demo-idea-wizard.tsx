"use client";

import { useState, type JSX } from "react";

import { WizardShell } from "@/components/demo-wizard-shell";
import { TYPE_LABELS } from "@/lib/labels";
import type { ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const STEP_COUNT = 3;

const TYPE_HINTS: Record<ItemType, string> = {
  restaurant: "Onde comer bem juntos.",
  food_idea: "Um prato ou receita para tentar.",
  tourist_spot: "Lugar para visitar e explorar.",
  movie: "Filme, série ou sessão juntos.",
  city: "Uma cidade ou destino para sonhar.",
  event: "Show, festa, exposição ou qualquer programa.",
};

export function IdeaWizard({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: { type: ItemType; title: string; url?: string }) => void;
}): JSX.Element {
  const [step, setStep] = useState(0);
  const [type, setType] = useState<ItemType | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const nextDisabled =
    (step === 0 && type == null) || (step === 1 && !title.trim());

  function back() {
    if (step === 0) {
      onCancel();
      return;
    }
    setStep((current) => current - 1);
  }

  function next() {
    if (nextDisabled) return;
    if (step < STEP_COUNT - 1) {
      setStep((current) => current + 1);
      return;
    }
    if (!type) return;
    onSave({
      type,
      title: title.trim(),
      url: url.trim() || undefined,
    });
  }

  const typeStep = step === 0;

  return (
    <WizardShell
      title="Nova ideia"
      step={step}
      stepCount={STEP_COUNT}
      onBack={back}
      onNext={next}
      backLabel={step === 0 ? "Cancelar" : "Voltar"}
      nextLabel={step === STEP_COUNT - 1 ? "Salvar" : "Continuar"}
      nextDisabled={nextDisabled}
      bare={typeStep}
      heading={typeStep ? "Que tipo de ideia?" : undefined}
      subtitle={
        typeStep
          ? "Toque no card inteiro para escolher. Depois vocês filtram fácil."
          : undefined
      }
    >
      {step === 0 ? (
        <div className="space-y-3" role="group" aria-label="Tipo da ideia">
          {ITEM_TYPES.map((value) => {
            const selected = type === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                className={`w-full rounded-[1.75rem] p-5 text-left transition-transform active:scale-[0.99] ${
                  selected
                    ? "border-2 border-[var(--terracotta)] bg-accent-soft text-[var(--ink-on-surface)] shadow-lg shadow-black/15"
                    : "border border-transparent bg-surface text-[var(--ink-on-surface)] shadow-lg shadow-black/15"
                }`}
                onClick={() => setType(value)}
              >
                <span
                  className={`block font-serif text-2xl leading-tight ${
                    selected ? "text-[var(--terracotta)]" : "text-accent-strong"
                  }`}
                >
                  {TYPE_LABELS[value]}
                </span>
                <span className="mt-2 block text-sm leading-6 text-accent-strong/70">
                  {TYPE_HINTS[value]}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl text-accent-strong">
              Qual é o nome?
            </h1>
            <p className="mt-2 text-sm leading-6 text-accent-strong/70">
              Coloque como vocês costumam chamar essa ideia.
            </p>
          </div>
          <label className="block text-sm font-medium text-accent-strong">
            Nome da ideia
            <input
              required
              className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Cinema no Belas Artes"
              autoFocus
            />
          </label>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl text-accent-strong">
              Tem algum link?
            </h1>
            <p className="mt-2 text-sm leading-6 text-accent-strong/70">
              Instagram, site, mapa ou trailer. Se não tiver, pode salvar sem link.
            </p>
          </div>
          <label className="block text-sm font-medium text-accent-strong">
            Link opcional
            <input
              className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://..."
              inputMode="url"
              autoFocus
            />
          </label>
        </div>
      ) : null}
    </WizardShell>
  );
}
