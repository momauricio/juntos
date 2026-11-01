"use client";

import { useState, type JSX } from "react";

import { WizardShell } from "@/components/demo-wizard-shell";
import { sortCategories } from "@/lib/categories";
import { typeHint } from "@/lib/labels";
import type { Category } from "@/lib/types";

const STEP_COUNT = 3;

export function IdeaWizard({
  categories,
  initialCategoryId = null,
  onCancel,
  onSave,
}: {
  // Categorias da sessão, na ordem do casal (C7).
  categories: Category[];
  // "+ Adicionar em {nome}": a categoria já vem marcada.
  initialCategoryId?: string | null;
  onCancel: () => void;
  onSave: (input: { category: Category; title: string; url?: string }) => void;
}): JSX.Element {
  const [step, setStep] = useState(0);
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId);
  const category = categories.find((candidate) => candidate.id === categoryId) ?? null;
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const nextDisabled =
    (step === 0 && category == null) || (step === 1 && !title.trim());

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
    if (!category) return;
    onSave({
      category,
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
      backLabel="Voltar"
      nextLabel={step === STEP_COUNT - 1 ? "Salvar" : "Continuar"}
      nextDisabled={nextDisabled}
      bare={typeStep}
      heading={typeStep ? "Qual categoria?" : undefined}
      subtitle={
        typeStep
          ? "Toque no card inteiro para escolher. Depois vocês filtram fácil."
          : undefined
      }
    >
      {step === 0 ? (
        <div className="space-y-3" role="group" aria-label="Categoria">
          {sortCategories(categories).map((option) => {
            const selected = categoryId === option.id;
            // Dica só nas padrão (vêm de um tipo); nas do casal, só o nome.
            const hint = option.created_by === null ? typeHint(option.item_type) : "";
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                className={`w-full rounded-[1.75rem] p-5 text-left transition-transform active:scale-[0.99] ${
                  selected
                    ? "border-2 border-[var(--terracotta)] bg-accent-soft text-[var(--ink-on-surface)] shadow-lg shadow-black/15"
                    : "border border-transparent bg-surface text-[var(--ink-on-surface)] shadow-lg shadow-black/15"
                }`}
                onClick={() => setCategoryId(option.id)}
              >
                <span
                  className={`block font-serif text-2xl leading-tight ${
                    selected ? "text-[var(--terracotta)]" : "text-accent-strong"
                  }`}
                >
                  <span aria-hidden="true">{option.emoji} </span>
                  {option.name}
                </span>
                {hint ? (
                  <span className="mt-2 block text-sm leading-6 text-accent-strong/70">
                    {hint}
                  </span>
                ) : null}
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
