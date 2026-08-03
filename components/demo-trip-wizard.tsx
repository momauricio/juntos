"use client";

import { useState, type JSX } from "react";

import { WizardShell } from "@/components/demo-wizard-shell";
import { BrDateField } from "@/components/br-date-field";
import {
  destinationDateError,
  formatIsoRange,
  isoToBr,
} from "@/lib/dates";
import { tripDateRange } from "@/lib/demo/store";

type DestinationDraft = {
  name: string;
  /** ISO YYYY-MM-DD when complete, else empty */
  startDate: string;
  endDate: string;
  /** What the user is typing in the fields */
  startText: string;
  endText: string;
};

const STEP_COUNT = 3;

function blankDestination(): DestinationDraft {
  return {
    name: "",
    startDate: "",
    endDate: "",
    startText: "",
    endText: "",
  };
}

function moveDestination(
  destinations: DestinationDraft[],
  index: number,
  direction: -1 | 1,
) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= destinations.length) return destinations;
  const next = [...destinations];
  const [destination] = next.splice(index, 1);
  next.splice(nextIndex, 0, destination);
  return next;
}

export function TripWizard({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (input: {
    title: string;
    destinations: Array<{ name: string; startDate?: string; endDate?: string }>;
  }) => void;
}): JSX.Element {
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [destinations, setDestinations] = useState<DestinationDraft[]>([
    blankDestination(),
  ]);

  const trimmedDestinations = destinations.map((destination) => ({
    ...destination,
    name: destination.name.trim(),
  }));

  const dateErrors = trimmedDestinations.map((_, index) =>
    destinationDateError(trimmedDestinations, index),
  );
  const total = tripDateRange(
    trimmedDestinations.map((destination, index) => ({
      id: String(index),
      name: destination.name,
      startDate: destination.startDate || null,
      endDate: destination.endDate || null,
    })),
  );

  const titleInvalid = !title.trim();
  const destinationsInvalid =
    trimmedDestinations.length === 0 ||
    trimmedDestinations.some((destination) => !destination.name);
  const datesInvalid = dateErrors.some(Boolean);
  const nextDisabled =
    (step === 0 && titleInvalid) ||
    (step === 1 && destinationsInvalid) ||
    (step === 2 && datesInvalid);

  function updateDestination(
    index: number,
    patch: Partial<DestinationDraft>,
  ) {
    setDestinations((current) =>
      current.map((destination, currentIndex) =>
        currentIndex === index ? { ...destination, ...patch } : destination,
      ),
    );
  }

  function onDateChange(
    index: number,
    field: "start" | "end",
    next: { iso: string; text: string },
  ) {
    if (field === "start") {
      updateDestination(index, { startText: next.text, startDate: next.iso });
    } else {
      updateDestination(index, { endText: next.text, endDate: next.iso });
    }
  }

  function removeDestination(index: number) {
    setDestinations((current) =>
      current.length > 1
        ? current.filter((_, currentIndex) => currentIndex !== index)
        : current,
    );
  }

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

    onSave({
      title: title.trim(),
      destinations: trimmedDestinations.map((destination) => ({
        name: destination.name,
        startDate: destination.startDate,
        endDate: destination.endDate,
      })),
    });
  }

  return (
    <WizardShell
      title="Nova viagem"
      step={step}
      stepCount={STEP_COUNT}
      onBack={back}
      onNext={next}
      backLabel="Voltar"
      nextLabel={step === STEP_COUNT - 1 ? "Criar viagem" : "Continuar"}
      nextDisabled={nextDisabled}
    >
      {step === 0 ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl text-accent-strong">
              Qual é a viagem?
            </h1>
            <p className="mt-2 text-sm leading-6 text-accent-strong/70">
              Dê um nome para vocês reconhecerem esse plano depois.
            </p>
          </div>
          <label className="block text-sm font-medium text-accent-strong">
            Título
            <input
              required
              className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex.: Chile 2026"
              autoFocus
            />
          </label>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl text-accent-strong">
              Quais destinos entram?
            </h1>
            <p className="mt-2 text-sm leading-6 text-accent-strong/70">
              Liste na ordem da viagem. Use as setas para reorganizar o roteiro.
            </p>
          </div>
          <div className="space-y-3">
            {destinations.map((destination, index) => (
              <div key={index} className="rounded-2xl border border-border p-3">
                <label className="block text-sm font-medium text-accent-strong">
                  Destino {index + 1}
                  <input
                    required
                    className="mt-2 h-12 w-full rounded-xl border border-border bg-surface px-3 text-base"
                    value={destination.name}
                    onChange={(event) =>
                      updateDestination(index, { name: event.target.value })
                    }
                    placeholder="Ex.: Santiago"
                    autoFocus={index === 0}
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-surface-muted px-3 text-sm font-medium disabled:opacity-40"
                    onClick={() =>
                      setDestinations((current) =>
                        moveDestination(current, index, -1),
                      )
                    }
                    disabled={index === 0}
                    aria-label={`Mover destino ${index + 1} para cima`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="h-10 rounded-xl bg-surface-muted px-3 text-sm font-medium disabled:opacity-40"
                    onClick={() =>
                      setDestinations((current) =>
                        moveDestination(current, index, 1),
                      )
                    }
                    disabled={index === destinations.length - 1}
                    aria-label={`Mover destino ${index + 1} para baixo`}
                  >
                    ↓
                  </button>
                  {destinations.length > 1 ? (
                    <button
                      type="button"
                      className="h-10 rounded-xl bg-red-50 px-3 text-sm font-medium text-danger"
                      onClick={() => removeDestination(index)}
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="h-12 w-full rounded-xl bg-accent-soft font-medium text-accent-strong"
            onClick={() =>
              setDestinations((current) => [...current, blankDestination()])
            }
          >
            + Adicionar destino
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-serif text-2xl text-accent-strong">
              Quando estarão em cada lugar?
            </h1>
            <p className="mt-2 text-sm leading-6 text-accent-strong/70">
              Digite as datas em DD/MM/AAAA. O próximo destino só pode começar
              no fim do anterior (ou depois).
            </p>
          </div>

          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm font-medium text-accent-strong">
            Período total:{" "}
            {formatIsoRange(total.start, total.end) || "Defina as datas"}
          </p>

          <div className="space-y-3">
            {destinations.map((destination, index) => {
              const previousEnd = trimmedDestinations[index - 1]?.endDate;
              return (
                <div key={index} className="rounded-2xl border border-border p-3">
                  <p className="font-medium text-accent-strong">
                    {trimmedDestinations[index]?.name || `Destino ${index + 1}`}
                  </p>
                  {previousEnd ? (
                    <p className="mt-1 text-xs text-accent-strong/60">
                      A partir de {isoToBr(previousEnd)} (fim do destino anterior)
                    </p>
                  ) : null}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <BrDateField
                      label="Início"
                      valueIso={destination.startDate}
                      valueText={destination.startText}
                      minIso={previousEnd || undefined}
                      onChange={(next) => onDateChange(index, "start", next)}
                    />
                    <BrDateField
                      label="Fim"
                      valueIso={destination.endDate}
                      valueText={destination.endText}
                      minIso={
                        destination.startDate || previousEnd || undefined
                      }
                      onChange={(next) => onDateChange(index, "end", next)}
                    />
                  </div>
                  {dateErrors[index] ? (
                    <p className="mt-2 text-xs text-danger">{dateErrors[index]}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </WizardShell>
  );
}
