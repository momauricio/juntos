"use client";

import type { JSX } from "react";

export function DemoHub({
  onIdea,
  onTrip,
  onSeeIdeas,
}: {
  onIdea: () => void;
  onTrip: () => void;
  onSeeIdeas: () => void;
}): JSX.Element {
  return (
    <div className="space-y-8 py-4">
      <section className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-[0.28em] text-cream/60">
          Nosso plano
        </p>
        <div>
          <h1 className="font-serif text-5xl leading-none text-cream">Juntos</h1>
          <p className="mt-3 max-w-sm text-base leading-7 text-cream/75">
            Guardem ideias de rolê, montem viagens e decidam o próximo plano sem
            perder nada pelo caminho.
          </p>
        </div>
      </section>

      <section className="space-y-3" aria-label="Criar novo plano">
        <button
          type="button"
          className="hub-card-enter group w-full rounded-[2rem] bg-surface p-5 text-left text-[var(--ink-on-surface)] shadow-xl shadow-black/20 transition-transform active:scale-[0.99]"
          onClick={onIdea}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--terracotta)]">
            Adicionar
          </span>
          <span className="mt-3 block font-serif text-3xl leading-tight">
            Ideia de Role
          </span>
          <span className="mt-3 block text-sm leading-6 text-accent-strong/70">
            Restaurante, filme, cidade ou qualquer vontade para decidir depois.
          </span>
          <span className="mt-5 inline-flex h-11 items-center rounded-2xl bg-[var(--terracotta)] px-4 text-sm font-semibold text-accent-contrast">
            Nova ideia
          </span>
        </button>

        <button
          type="button"
          className="hub-card-enter group w-full rounded-[2rem] bg-surface-muted p-5 text-left text-[var(--ink-on-surface)] shadow-xl shadow-black/15 transition-transform active:scale-[0.99]"
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
          <span className="mt-5 inline-flex h-11 items-center rounded-2xl bg-accent-strong px-4 text-sm font-semibold text-cream">
            Começar viagem
          </span>
        </button>
      </section>

      <button
        type="button"
        className="w-full text-center text-sm font-semibold text-cream underline decoration-cream/40 underline-offset-4"
        onClick={onSeeIdeas}
      >
        Ver ideias registradas
      </button>
    </div>
  );
}
