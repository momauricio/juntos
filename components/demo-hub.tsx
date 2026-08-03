"use client";

import type { JSX } from "react";

export function DemoHub({
  onIdea,
  onTrip,
  onSeeIdeas,
  onSeeTrips,
}: {
  onIdea: () => void;
  onTrip: () => void;
  onSeeIdeas: () => void;
  onSeeTrips: () => void;
}): JSX.Element {
  return (
    <div className="space-y-8 py-4">
      <section className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-cream/60">
          Juntos · demo
        </p>
        <div>
          <h1 className="font-serif text-4xl leading-tight text-cream">
            O que vocês querem fazer?
          </h1>
          <p className="mt-3 max-w-sm text-base leading-7 text-cream/75">
            Escolham uma ideia de rolê ou comecem a montar a próxima viagem.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-label="Escolher o que criar">
        <button
          type="button"
          className="hub-card-enter w-full rounded-[2rem] bg-surface p-6 text-left text-[var(--ink-on-surface)] shadow-xl shadow-black/20 transition-transform active:scale-[0.99]"
          onClick={onIdea}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--terracotta)]">
            Adicionar
          </span>
          <span className="mt-3 block font-serif text-3xl leading-tight">
            Ideia de Role
          </span>
          <span className="mt-3 block text-sm leading-6 text-accent-strong/70">
            Restaurante, evento, filme, cidade ou qualquer vontade para decidir
            depois.
          </span>
        </button>

        <button
          type="button"
          className="hub-card-enter w-full rounded-[2rem] bg-surface-muted p-6 text-left text-[var(--ink-on-surface)] shadow-xl shadow-black/15 transition-transform active:scale-[0.99]"
          onClick={onTrip}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-accent-strong/55">
            Planejar
          </span>
          <span className="mt-3 block font-serif text-3xl leading-tight">
            Nova Viagem
          </span>
          <span className="mt-3 block text-sm leading-6 text-accent-strong/70">
            Crie uma viagem simples para organizar datas, checklist e roteiro.
          </span>
        </button>
      </section>

      <div className="space-y-3 pb-4">
        <button
          type="button"
          className="w-full text-center text-sm font-semibold text-cream underline decoration-cream/40 underline-offset-4"
          onClick={onSeeIdeas}
        >
          Ver ideias registradas
        </button>
        <button
          type="button"
          className="w-full text-center text-sm font-semibold text-cream underline decoration-cream/40 underline-offset-4"
          onClick={onSeeTrips}
        >
          Ver viagens registradas
        </button>
      </div>
    </div>
  );
}
