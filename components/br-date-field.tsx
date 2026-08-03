"use client";

import { useRef, type JSX } from "react";

import { brToIso, isoToBr, maskBrDateInput } from "@/lib/dates";

export function BrDateField({
  label,
  valueIso,
  valueText,
  minIso,
  onChange,
}: {
  label: string;
  valueIso: string;
  valueText: string;
  minIso?: string;
  onChange: (next: { iso: string; text: string }) => void;
}): JSX.Element {
  const pickerRef = useRef<HTMLInputElement>(null);

  function onTextChange(raw: string) {
    const text = maskBrDateInput(raw);
    onChange({ text, iso: brToIso(text) ?? "" });
  }

  function onPickerChange(iso: string) {
    onChange({ iso, text: iso ? isoToBr(iso) : "" });
  }

  function openCalendar() {
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  }

  return (
    <label className="block text-sm font-medium text-accent-strong">
      {label}
      <div className="relative mt-2">
        <input
          required
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/AAAA"
          className="h-12 w-full rounded-xl border border-border bg-surface py-0 pl-3 pr-12 text-sm"
          value={valueText}
          onChange={(event) => onTextChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-accent-strong/70"
          onClick={openCalendar}
          aria-label={`Abrir calendário — ${label}`}
        >
          <span aria-hidden="true" className="text-accent-strong/70">
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
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          min={minIso || undefined}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          value={valueIso || ""}
          onChange={(event) => onPickerChange(event.target.value)}
        />
      </div>
    </label>
  );
}
