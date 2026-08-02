"use client";

import { useState, type JSX } from "react";

import { WizardShell } from "@/components/demo-wizard-shell";
import { TYPE_LABELS } from "@/lib/labels";
import type { ItemType } from "@/lib/types";

const ITEM_TYPES = Object.keys(TYPE_LABELS) as ItemType[];
const STEP_COUNT = 3;

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
    >
      {step === 0 ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl text-accent-strong">
              Que tipo de ideia?
            </h1>
            <p className="mt-2 text-sm leading-6 text-accent-strong/70">
              Escolha uma categoria para ficar fácil de filtrar depois.
            </p>
          </div>
          <div className="space-y-2">
            {ITEM_TYPES.map((value) => {
              const selected = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`flex min-h-16 w-full items-center justify-between rounded-2xl border px-4 text-left transition ${
                    selected
                      ? "border-[var(--terracotta)] bg-accent-soft text-accent-strong"
                      : "border-border bg-surface text-accent-strong"
                  }`}
                  onClick={() => setType(value)}
                >
                  <span className="font-medium">{TYPE_LABELS[value]}</span>
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm ${
                      selected
                        ? "border-[var(--terracotta)] bg-[var(--terracotta)] text-accent-contrast"
                        : "border-accent-strong/20"
                    }`}
                    aria-hidden="true"
                  >
                    {selected ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
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
