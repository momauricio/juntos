"use client";

import { useMemo, useRef, useState } from "react";

import {
  DOC_CATEGORIES,
  DOC_CATEGORY_LABELS,
  addDocLink,
  addPackItem,
  addStop,
  formatTripDates,
  removeDocLink,
  removePackItem,
  removeStop,
  togglePackItem,
  type DemoSpace,
  type DocCategory,
  type Trip,
} from "@/lib/demo/store";
import {
  dayNumberFromTripDate,
  isoToBr,
  tripDateFromDayNumber,
} from "@/lib/dates";

export function TripsHome({
  space,
  onOpen,
  onNew,
  onBack,
}: {
  space: DemoSpace;
  onOpen: (tripId: string) => void;
  onNew: () => void;
  onBack: () => void;
}) {
  if (space.trips.length === 0) {
    return (
      <div className="space-y-4">
        <button type="button" className="text-sm text-cream/70" onClick={onBack}>
          ← Voltar
        </button>
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl text-cream">Viagens</h1>
          <button
            type="button"
            className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-contrast"
            onClick={onNew}
          >
            + Nova
          </button>
        </div>
        <p className="rounded-xl bg-surface-muted px-4 py-8 text-center text-sm text-accent-strong/70">
          Nenhuma viagem ainda
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-cream/70" onClick={onBack}>
        ← Voltar
      </button>
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-cream">Viagens</h1>
        <button
          type="button"
          className="h-11 rounded-xl bg-accent px-4 text-sm font-medium text-accent-contrast"
          onClick={onNew}
        >
          + Nova
        </button>
      </div>
      <ul className="space-y-2">
        {space.trips.map((trip) => {
          const dates = formatTripDates(trip);
          const destinations = formatTripDestinations(trip);
          return (
            <li key={trip.id}>
              <button
                type="button"
                onClick={() => onOpen(trip.id)}
                className="w-full rounded-2xl bg-surface px-4 py-3 text-left shadow-sm shadow-accent-strong/5"
              >
                <p className="font-medium text-accent-strong">{trip.title}</p>
                <p className="mt-1 text-xs text-accent-strong/65">
                  {[destinations, dates].filter(Boolean).join(" · ") ||
                    "Sem datas"}
                </p>
                <p className="mt-1 text-xs text-accent-strong/55">
                  {trip.packItems.length} itens · {trip.stops.length} paradas ·{" "}
                  {trip.docs.length} docs
                </p>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type TripSegment = "checklist" | "itinerary" | "docs";

function formatTripDestinations(trip: Trip): string | null {
  return trip.destinations.map((destination) => destination.name).join(" → ") || null;
}

export function TripDetail({
  trip,
  onBack,
  onChange,
}: {
  trip: Trip;
  onBack: () => void;
  onChange: (updater: (space: DemoSpace) => DemoSpace) => void;
}) {
  const [segment, setSegment] = useState<TripSegment>("checklist");
  const dates = formatTripDates(trip);
  const destinations = formatTripDestinations(trip);

  return (
    <div className="space-y-4">
      <button type="button" className="text-sm text-cream/70" onClick={onBack}>
        ← Viagens
      </button>
      <div>
        <h1 className="font-serif text-3xl text-cream">{trip.title}</h1>
        <p className="mt-1 text-sm text-cream/70">
          {[destinations, dates].filter(Boolean).join(" · ") ||
            "Sem destino/datas"}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["checklist", "Checklist"],
            ["itinerary", "Roteiro"],
            ["docs", "Docs"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setSegment(key)}
            className={`h-11 rounded-xl text-sm font-medium ${
              segment === key
                ? "bg-accent text-accent-contrast"
                : "bg-surface-muted text-accent-strong"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {segment === "checklist" ? (
        <ChecklistSegment trip={trip} onChange={onChange} />
      ) : null}
      {segment === "itinerary" ? (
        <ItinerarySegment trip={trip} onChange={onChange} />
      ) : null}
      {segment === "docs" ? <DocsSegment trip={trip} onChange={onChange} /> : null}
    </div>
  );
}

function ChecklistSegment({
  trip,
  onChange,
}: {
  trip: Trip;
  onChange: (updater: (space: DemoSpace) => DemoSpace) => void;
}) {
  const [title, setTitle] = useState("");

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onChange((space) => addPackItem(space, trip.id, title));
          setTitle("");
        }}
      >
        <input
          className="h-12 flex-1 rounded-xl border border-border bg-surface px-3 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: Passaporte"
        />
        <button
          type="submit"
          className="h-12 rounded-xl bg-accent px-4 text-sm font-medium text-accent-contrast"
        >
          Add
        </button>
      </form>

      {trip.packItems.length === 0 ? (
        <p className="rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-accent-strong/70">
          Nada na mala ainda
        </p>
      ) : (
        <ul className="space-y-2">
          {trip.packItems.map((item) => (
            <li
              key={item.id}
              className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2"
            >
              <button
                type="button"
                className="flex min-h-11 flex-1 items-center gap-3 text-left"
                onClick={() =>
                  onChange((space) => togglePackItem(space, trip.id, item.id))
                }
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-md border ${
                    item.done
                      ? "border-accent bg-accent text-accent-contrast"
                      : "border-border bg-surface"
                  }`}
                >
                  {item.done ? "✓" : ""}
                </span>
                <span
                  className={`text-sm ${item.done ? "text-accent-strong/50 line-through" : ""}`}
                >
                  {item.title}
                </span>
              </button>
              <button
                type="button"
                className="h-11 px-2 text-sm text-danger"
                onClick={() =>
                  onChange((space) => removePackItem(space, trip.id, item.id))
                }
              >
                Apagar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItinerarySegment({
  trip,
  onChange,
}: {
  trip: Trip;
  onChange: (updater: (space: DemoSpace) => DemoSpace) => void;
}) {
  const [day, setDay] = useState(1);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [url, setUrl] = useState("");
  const calendarRef = useRef<HTMLInputElement>(null);

  const tripStart = trip.startDate;
  const tripEnd = trip.endDate;
  const selectedDate = tripStart
    ? tripDateFromDayNumber(tripStart, day)
    : null;

  const byDay = useMemo(() => {
    const map = new Map<number, Trip["stops"]>();
    trip.stops.forEach((stop) => {
      const list = map.get(stop.day) ?? [];
      list.push(stop);
      map.set(stop.day, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [trip.stops]);

  function openCalendar() {
    const el = calendarRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  }

  function onCalendarPick(iso: string) {
    if (!tripStart || !iso) return;
    const nextDay = dayNumberFromTripDate(tripStart, iso);
    if (nextDay != null) setDay(nextDay);
  }

  return (
    <div className="space-y-4">
      <form
        className="space-y-2 rounded-2xl bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          onChange((space) =>
            addStop(space, trip.id, { day, title, notes, url }),
          );
          setTitle("");
          setNotes("");
          setUrl("");
        }}
      >
        <p className="text-sm font-medium">Nova parada</p>
        <label className="block text-xs font-medium text-accent-strong">
          Dia
          <div className="relative mt-1">
            <input
              type="number"
              min={1}
              className="h-11 w-full rounded-xl border border-border bg-surface py-0 pl-3 pr-12 text-sm"
              value={day}
              onChange={(e) => setDay(Math.max(1, Number(e.target.value) || 1))}
            />
            {tripStart ? (
              <>
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-accent-strong/70"
                  onClick={openCalendar}
                  aria-label="Escolher dia no calendário"
                >
                  <span aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M8 3v4M16 3v4M3 11h18" />
                    </svg>
                  </span>
                </button>
                <input
                  ref={calendarRef}
                  type="date"
                  tabIndex={-1}
                  aria-hidden="true"
                  min={tripStart}
                  max={tripEnd || undefined}
                  className="pointer-events-none absolute h-0 w-0 opacity-0"
                  value={selectedDate || tripStart}
                  onChange={(e) => onCalendarPick(e.target.value)}
                />
              </>
            ) : null}
          </div>
          {tripStart && selectedDate ? (
            <p className="mt-1 text-[11px] text-accent-strong/60">
              Dia {day} = {isoToBr(selectedDate)}
              {tripStart ? ` · início da viagem ${isoToBr(tripStart)}` : ""}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-accent-strong/60">
              Digite o número do dia (1, 2, 3…)
            </p>
          )}
        </label>
        <input
          required
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Onde vamos"
        />
        <input
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link (opcional)"
          inputMode="url"
        />
        <textarea
          className="min-h-20 w-full rounded-xl border border-border bg-surface p-3 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observação"
        />
        <button
          type="submit"
          className="h-11 w-full rounded-xl bg-accent text-sm font-medium text-accent-contrast"
        >
          Adicionar parada
        </button>
      </form>

      {byDay.length === 0 ? (
        <p className="rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-accent-strong/70">
          Roteiro vazio
        </p>
      ) : (
        byDay.map(([dayNumber, stops]) => {
          const dayDate =
            tripStart != null
              ? tripDateFromDayNumber(tripStart, dayNumber)
              : null;
          return (
          <section key={dayNumber} className="space-y-2">
            <h2 className="text-sm font-semibold text-accent-strong">
              Dia {dayNumber}
              {dayDate ? ` · ${isoToBr(dayDate)}` : ""}
            </h2>
            <ul className="space-y-2">
              {stops.map((stop) => (
                <li key={stop.id} className="rounded-xl bg-surface px-3 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-accent-strong">{stop.title}</p>
                      {stop.notes ? (
                        <p className="mt-1 text-xs text-accent-strong/65">{stop.notes}</p>
                      ) : null}
                      {stop.url ? (
                        <a
                          href={stop.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block break-all text-xs text-accent underline"
                        >
                          {stop.url}
                        </a>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="h-11 px-2 text-sm text-danger"
                      onClick={() =>
                        onChange((space) => removeStop(space, trip.id, stop.id))
                      }
                    >
                      Apagar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          );
        })
      )}
    </div>
  );
}

function DocsSegment({
  trip,
  onChange,
}: {
  trip: Trip;
  onChange: (updater: (space: DemoSpace) => DemoSpace) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<DocCategory>("flight");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <div className="space-y-4">
      <form
        className="space-y-2 rounded-2xl bg-surface p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim() || !url.trim()) return;
          onChange((space) =>
            addDocLink(space, trip.id, { title, category, url, notes }),
          );
          setTitle("");
          setUrl("");
          setNotes("");
        }}
      >
        <p className="text-sm font-medium">Novo documento (link)</p>
        <input
          required
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex.: LATAM ida"
        />
        <select
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as DocCategory)}
        >
          {DOC_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {DOC_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
        <input
          required
          className="h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          inputMode="url"
        />
        <textarea
          className="min-h-16 w-full rounded-xl border border-border bg-surface p-3 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Observação"
        />
        <button
          type="submit"
          className="h-11 w-full rounded-xl bg-accent text-sm font-medium text-accent-contrast"
        >
          Salvar link
        </button>
      </form>

      {trip.docs.length === 0 ? (
        <p className="rounded-xl bg-surface-muted px-4 py-6 text-center text-sm text-accent-strong/70">
          Nenhum documento ainda
        </p>
      ) : (
        <ul className="space-y-2">
          {trip.docs.map((doc) => (
            <li key={doc.id} className="rounded-xl bg-surface px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-accent-strong/60">
                    {DOC_CATEGORY_LABELS[doc.category]}
                  </p>
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent-strong underline"
                  >
                    {doc.title}
                  </a>
                  {doc.notes ? (
                    <p className="mt-1 text-xs text-accent-strong/65">{doc.notes}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="h-11 px-2 text-sm text-danger"
                  onClick={() =>
                    onChange((space) => removeDocLink(space, trip.id, doc.id))
                  }
                >
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
