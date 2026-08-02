# Juntos Redesign Hub + Wizards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Juntos demo so home is a decision hub, ideias/viagens are created via wizards, trips support multiple dated destinations, ratings use 1–10, and the UI follows the “Pôr do sol na estrada” visual direction.

**Architecture:** Keep `lib/demo/store.ts` as the single source of truth (localStorage + sync encode/merge). Extend `Trip` with ordered `destinations[]` and migrate legacy single `destination`/`startDate`/`endDate` in `normalizeTrip`. Split UI into focused components (`demo-hub`, wizard shell, idea wizard, trip wizard) wired from `demo-app.tsx`. Theme tokens live in `globals.css` + fonts in `app/layout.tsx`.

**Tech Stack:** Next.js 16 (demo / static export), React 19, TypeScript, Tailwind CSS 4, Vitest, localStorage demo store.

**Spec:** `docs/superpowers/specs/2026-08-02-juntos-redesign-hub-design.md`

## Global Constraints

- Product name in UI: **Juntos**
- Ratings: integers **1 a 10** (restaurant food/service/ambiance + simple score)
- Ideia wizard order: Tipo → Nome → Link (link skippable)
- Viagem wizard order: Título → Destinos (1+) → Datas por destino (total = min start → max end)
- Home: hub first; cards stacked on mobile; link **Ver ideias registradas**
- Visual: indigo atmosphere + cream + terracotta accents; expressive type; no Inter/Roboto/Arial/system
- Sync must round-trip new destination fields
- Demo-only; no new Supabase work
- Portuguese (pt-BR) copy

## File map

| File | Role |
|------|------|
| `lib/ratings.ts` | `assertScore` 1–10; averages unchanged formula |
| `tests/ratings.test.ts` | Rating range tests |
| `lib/demo/store.ts` | `TripDestination`, `destinations`, `tripDateRange`, `createTrip` input, normalize/migrate |
| `tests/demo-store.test.ts` | Destinations + date range + sync |
| `app/globals.css` | Sunset tokens + motion helpers |
| `app/layout.tsx` | Fonts (keep Fraunces display + swap body if needed) |
| `components/demo-wizard-shell.tsx` | Dots, Voltar/Continuar, step frame |
| `components/demo-hub.tsx` | Decision hub |
| `components/demo-idea-wizard.tsx` | Ideia wizard |
| `components/demo-trip-wizard.tsx` | Viagem wizard (replaces `NewTripForm` usage) |
| `components/demo-trips.tsx` | Show destinations + total dates; remove/retire single-field `NewTripForm` |
| `components/demo-app.tsx` | Screens: hub / ideas list / wizards; nav labels; ScoreSelect 1–10 |
| `scripts/build-demo-static.cjs` | Unchanged unless paths break |

---

### Task 1: Ratings 1–10

**Files:**
- Modify: `lib/ratings.ts`
- Modify: `tests/ratings.test.ts`
- Modify: `components/demo-app.tsx` (`ScoreSelect` options + defaults)
- Modify: `components/rating-form.tsx` if it still hardcodes 1–5

**Interfaces:**
- Consumes: none new
- Produces: `assertScore(n: number): void` accepts integers 1–10 inclusive; error message `"Nota deve ser um inteiro de 1 a 10"`

- [ ] **Step 1: Update failing tests for 1–10**

Replace `tests/ratings.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { assertScore, restaurantAverage } from "@/lib/ratings";

describe("restaurantAverage", () => {
  it("averages three scores to one decimal", () => {
    expect(restaurantAverage(10, 8, 8)).toBe(8.7);
    expect(restaurantAverage(10, 10, 10)).toBe(10);
    expect(restaurantAverage(1, 2, 3)).toBe(2);
  });
});

describe("assertScore", () => {
  it("accepts integers 1 through 10", () => {
    for (const n of [1, 5, 10]) {
      expect(() => assertScore(n)).not.toThrow();
    }
  });

  it("rejects out of range and non-integers", () => {
    expect(() => assertScore(0)).toThrow(/1 a 10/);
    expect(() => assertScore(11)).toThrow(/1 a 10/);
    expect(() => assertScore(3.5)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL on old 1–5 assert**

Run: `npm test -- tests/ratings.test.ts`
Expected: FAIL (assert still 1–5 and/or average cases)

- [ ] **Step 3: Implement 1–10 in `lib/ratings.ts`**

```ts
export function assertScore(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > 10) {
    throw new Error("Nota deve ser um inteiro de 1 a 10");
  }
}
```

Leave `restaurantAverage` / `displayRating` logic unchanged (they call `assertScore`).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/ratings.test.ts`
Expected: PASS

- [ ] **Step 5: Update demo ScoreSelect + defaults**

In `components/demo-app.tsx`:
- Default draft scores from `5` → `7`
- `ScoreSelect`: options `Array.from({ length: 10 }, (_, i) => i + 1)`
- Label helper text if any says “1–5” → “1–10”

In `components/rating-form.tsx` (if present): same 1–10 options and assert path.

**Legacy scores:** Do **not** auto-multiply stored 1–5 values. They remain valid on the 1–10 scale (old “5” stays 5/10). Document in commit message. UI defaults for *new* ratings are 7.

- [ ] **Step 6: Commit**

```bash
git add lib/ratings.ts tests/ratings.test.ts components/demo-app.tsx components/rating-form.tsx
git commit -m "feat: change ratings scale from 1-5 to 1-10"
```

---

### Task 2: Trip destinations model + date range

**Files:**
- Modify: `lib/demo/store.ts`
- Modify: `tests/demo-store.test.ts`

**Interfaces:**
- Consumes: existing `Trip`, `createTrip`, `normalizeTrip`, `formatTripDates`
- Produces:

```ts
export type TripDestination = {
  id: string;
  name: string;
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;
};

export type Trip = {
  id: string;
  title: string;
  destinations: TripDestination[];
  /** @deprecated legacy single field; normalized into destinations */
  destination: string | null;
  startDate: string | null; // derived cache: tripDateRange().start
  endDate: string | null;   // derived cache: tripDateRange().end
  notes: string | null;
  packItems: PackItem[];
  stops: Stop[];
  docs: DocLink[];
  createdAt: string;
  updatedAt: string;
};

export function tripDateRange(destinations: TripDestination[]): {
  start: string | null;
  end: string | null;
};

export function createTrip(
  space: DemoSpace,
  input: {
    title: string;
    destinations: Array<{
      name: string;
      startDate?: string;
      endDate?: string;
    }>;
    notes?: string;
  },
): DemoSpace;
```

- [ ] **Step 1: Write failing store tests**

Add to `tests/demo-store.test.ts`:

```ts
import { tripDateRange, createTrip, encodeSpace, decodeSpace, createUser, createSpace } from "@/lib/demo/store";

describe("trip destinations", () => {
  it("computes total range from multiple destinations", () => {
    expect(
      tripDateRange([
        { id: "a", name: "SP", startDate: "2026-12-20", endDate: "2026-12-22" },
        { id: "b", name: "Nordeste", startDate: "2026-12-22", endDate: "2026-12-30" },
      ]),
    ).toEqual({ start: "2026-12-20", end: "2026-12-30" });
  });

  it("creates trip with ordered destinations and derived dates", () => {
    const user = createUser("Mauricio");
    let space = createSpace(user);
    space = createTrip(space, {
      title: "Nordeste final do ano",
      destinations: [
        { name: "SP", startDate: "2026-12-20", endDate: "2026-12-22" },
        { name: "Nordeste", startDate: "2026-12-22", endDate: "2026-12-30" },
      ],
    });
    const trip = space.trips[0];
    expect(trip.destinations.map((d) => d.name)).toEqual(["SP", "Nordeste"]);
    expect(trip.startDate).toBe("2026-12-20");
    expect(trip.endDate).toBe("2026-12-30");
  });

  it("normalizes legacy single destination into destinations[]", () => {
    const user = createUser("Mauricio");
    const space = createSpace(user);
    const legacy = {
      ...space,
      trips: [
        {
          id: "trip_legacy",
          title: "Chile",
          destination: "Santiago",
          startDate: "2026-08-01",
          endDate: "2026-08-10",
          notes: null,
          packItems: [],
          stops: [],
          docs: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    };
    const decoded = decodeSpace(encodeSpace(legacy as never));
    expect(decoded?.trips[0].destinations).toHaveLength(1);
    expect(decoded?.trips[0].destinations[0].name).toBe("Santiago");
  });

  it("round-trips destinations through sync encode", () => {
    const user = createUser("Mauricio");
    let space = createSpace(user);
    space = createTrip(space, {
      title: "Nordeste",
      destinations: [
        { name: "SP", startDate: "2026-12-20", endDate: "2026-12-22" },
        { name: "Nordeste", startDate: "2026-12-22", endDate: "2026-12-30" },
      ],
    });
    const decoded = decodeSpace(encodeSpace(space));
    expect(decoded?.trips[0].destinations).toHaveLength(2);
    expect(decoded?.trips[0].endDate).toBe("2026-12-30");
  });
});
```

Update existing `createTrip(space, { title, destination, startDate, endDate })` call sites in this test file to the new `destinations` shape.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- tests/demo-store.test.ts`
Expected: FAIL (`tripDateRange` missing / `createTrip` shape)

- [ ] **Step 3: Implement model in `lib/demo/store.ts`**

Add type + helpers:

```ts
export type TripDestination = {
  id: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
};

export function tripDateRange(destinations: TripDestination[]): {
  start: string | null;
  end: string | null;
} {
  const starts = destinations.map((d) => d.startDate).filter(Boolean) as string[];
  const ends = destinations.map((d) => d.endDate).filter(Boolean) as string[];
  const start = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : null;
  const end = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : null;
  return { start, end };
}
```

Update `Trip` to include `destinations: TripDestination[]`.

`normalizeTrip`:
1. If `raw.destinations` is a non-empty array, normalize each (`id`, trimmed `name`, dates).
2. Else if legacy `destination` or dates exist, build one destination with `id: uid("dest")`, `name: destination ?? "Destino"`.
3. Else `destinations = []`.
4. Set `startDate`/`endDate` from `tripDateRange(destinations)`.
5. Keep `destination` as `destinations.map(d => d.name).join(" → ") || null` for display/back-compat in older UI bits.

`createTrip`:
- Require `input.destinations.length >= 1` with non-empty names (caller validates UI; store trims and filters empty names — if none left, still create with empty destinations only if tests require throw: **throw** `Error("Viagem precisa de pelo menos um destino")` when after trim there are zero destinations).
- Map to `TripDestination` with new ids; derive range; set `destination` join string.

`formatTripDates`: keep using `trip.startDate` / `trip.endDate` (derived).

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/demo-store.test.ts`
Expected: PASS

- [ ] **Step 5: Fix TypeScript call sites that still pass old `createTrip` args**

Update `components/demo-app.tsx` and `components/demo-trips.tsx` temporarily so the project typechecks — either adapt `NewTripForm` to pass `destinations: [{ name: destination, startDate, endDate }]` or leave a thin adapter until Task 6. Prefer adapter in `NewTripForm.onSave` now:

```ts
onSave({
  title,
  destinations: [
    {
      name: destination.trim() || "Destino",
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    },
  ],
  notes,
});
```

- [ ] **Step 6: Commit**

```bash
git add lib/demo/store.ts tests/demo-store.test.ts components/demo-trips.tsx components/demo-app.tsx
git commit -m "feat: multi-destination trips with derived total dates"
```

---

### Task 3: Sunset theme tokens + motion

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx` (only if font variable names change)

**Interfaces:**
- Consumes: existing CSS variable names used by Tailwind (`background`, `foreground`, `accent`, …)
- Produces: same variable names, new values; optional utility classes `.hub-card-enter`, `.wizard-step-enter`

- [ ] **Step 1: Replace `:root` palette in `app/globals.css`**

Use indigo-led atmosphere + cream + terracotta accent (not cream-dominant serif cliché):

```css
:root {
  --background: #1a2238;
  --foreground: #f3ebe3;
  --surface: rgba(243, 235, 227, 0.94);
  --surface-muted: rgba(243, 235, 227, 0.78);
  --surface-strong: #e8dcd0;
  --border: rgba(243, 235, 227, 0.22);
  --accent: #c45c3e;
  --accent-strong: #1a2238;
  --accent-soft: #f0d5c8;
  --accent-contrast: #fff8f3;
  --danger: #e07070;
  --ink-on-surface: #1a2238;
  --cream: #f3ebe3;
  --indigo-deep: #12182b;
  --indigo: #1a2238;
  --terracotta: #c45c3e;
}
```

Update `body` background to layered indigo → warm cream gradient (atmosphere, not flat). Ensure text on surface cards uses dark ink (`text` classes may need `text-[var(--ink-on-surface)]` in later UI tasks — for theme task, set `--foreground` for page chrome on dark gradient and keep surfaces light with dark text via component classes).

Practical approach for minimal breakage:
- Keep surfaces light (`--surface` cream)
- Set `--background` to deep indigo
- Set `--foreground` to cream for page-level text on dark bg
- Set `--accent` terracotta, `--accent-strong` deep indigo for headings on light cards
- Body gradient: indigo deep → indigo → soft warm edge

Add motion:

```css
@keyframes rise-in {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}
.hub-card-enter {
  animation: rise-in 420ms ease-out both;
}
.hub-card-enter:nth-child(2) { animation-delay: 80ms; }
.wizard-step-enter {
  animation: rise-in 320ms ease-out both;
}
```

Keep Fraunces + Source Sans 3 (already expressive; not Inter/Roboto).

- [ ] **Step 2: Smoke-check demo in browser or static build**

Run: `npm run build:demo-static`
Expected: build succeeds (visual polish verified in Task 7).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "style: apply sunset travel theme tokens and motion"
```

---

### Task 4: Wizard shell component

**Files:**
- Create: `components/demo-wizard-shell.tsx`

**Interfaces:**
- Consumes: none
- Produces:

```tsx
export function WizardShell(props: {
  title: string;
  step: number;       // 0-based
  stepCount: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string; // default "Continuar"
  backLabel?: string; // default "Voltar"
  nextDisabled?: boolean;
  children: React.ReactNode;
}): JSX.Element;
```

- [ ] **Step 1: Create `components/demo-wizard-shell.tsx`**

```tsx
"use client";

export function WizardShell({
  title,
  step,
  stepCount,
  onBack,
  onNext,
  nextLabel = "Continuar",
  backLabel = "Voltar",
  nextDisabled = false,
  children,
}: {
  title: string;
  step: number;
  stepCount: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="wizard-step-enter space-y-5">
      <div>
        <p className="text-sm text-cream/70">{title}</p>
        <div className="mt-3 flex gap-2" aria-label={`Passo ${step + 1} de ${stepCount}`}>
          {Array.from({ length: stepCount }, (_, i) => (
            <span
              key={i}
              className={`h-2 flex-1 rounded-full ${
                i <= step ? "bg-[var(--terracotta)]" : "bg-white/20"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="rounded-3xl bg-surface p-4 text-[var(--ink-on-surface)] shadow-lg shadow-black/20">
        {children}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-12 flex-1 rounded-2xl border border-white/25 text-sm font-medium text-cream"
        >
          {backLabel}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          className="h-12 flex-1 rounded-2xl bg-[var(--terracotta)] text-sm font-semibold text-accent-contrast disabled:opacity-40"
        >
          {nextLabel}
        </button>
      </div>
    </div>
  );
}
```

If CSS vars `--cream` / `--terracotta` / `--ink-on-surface` are missing after Task 3, use the literal hex values from Task 3 instead.

- [ ] **Step 2: Commit**

```bash
git add components/demo-wizard-shell.tsx
git commit -m "feat: add shared wizard shell with progress dots"
```

---

### Task 5: Hub + Ideia wizard

**Files:**
- Create: `components/demo-hub.tsx`
- Create: `components/demo-idea-wizard.tsx`
- Modify: `components/demo-app.tsx`

**Interfaces:**
- Consumes: `WizardShell`, `TYPE_LABELS`, `addItem`, `ItemType`
- Produces:

```tsx
export function DemoHub(props: {
  onIdea: () => void;
  onTrip: () => void;
  onSeeIdeas: () => void;
}): JSX.Element;

export function IdeaWizard(props: {
  onCancel: () => void;
  onSave: (input: { type: ItemType; title: string; url?: string }) => void;
}): JSX.Element;
```

Screen union additions in `demo-app.tsx`:

```ts
| { name: "hub" }
| { name: "ideas" }
| { name: "idea-wizard" }
```

After login, default screen = `"hub"` (not list). Nav: **Início** → hub; **Lista** can map to ideas or drop in favor of hub link — use bottom nav: `Início | Viagens | Sync | Ajustes`. “Ver ideias” is from hub only (or keep Lista as alias to ideas).

- [ ] **Step 1: Implement `components/demo-hub.tsx`**

Brand **Juntos** as hero. Two stacked full-width cards (`Ideia de Role`, `Nova Viagem`) with `.hub-card-enter`. Text button below: **Ver ideias registradas**.

- [ ] **Step 2: Implement `components/demo-idea-wizard.tsx`**

Steps 0–2:
0. Type: large selectable rows for each `ItemType` via `TYPE_LABELS`
1. Name: required text input
2. Link: URL input + allow Continuar with empty URL; on last step button label **Salvar**

Validation: `nextDisabled` when step0 and no type; step1 and `!title.trim()`.

On save call `onSave({ type, title: title.trim(), url: url.trim() || undefined })`.

- [ ] **Step 3: Wire `demo-app.tsx`**

- Import hub + idea wizard
- `home` screen becomes hub OR rename: use `hub` as default after welcome
- `ideas` shows existing `Home` list component
- Replace `screen.name === "new"` / `NewItem` with `idea-wizard`
- Bottom nav: Início → hub; optional Lista → ideas
- After idea save → `setScreen({ name: "hub" })` + message

- [ ] **Step 4: Manual check**

Run: `npm run dev` (or static build) — hub visible, wizard completes, item appears under Ver ideias.

- [ ] **Step 5: Commit**

```bash
git add components/demo-hub.tsx components/demo-idea-wizard.tsx components/demo-app.tsx
git commit -m "feat: add decision hub and ideia wizard"
```

---

### Task 6: Viagem wizard + trips UI for destinations

**Files:**
- Create: `components/demo-trip-wizard.tsx`
- Modify: `components/demo-trips.tsx`
- Modify: `components/demo-app.tsx`

**Interfaces:**
- Consumes: `WizardShell`, `createTrip`, `tripDateRange`, `formatTripDates`
- Produces:

```tsx
export function TripWizard(props: {
  onCancel: () => void;
  onSave: (input: {
    title: string;
    destinations: Array<{ name: string; startDate?: string; endDate?: string }>;
  }) => void;
}): JSX.Element;
```

- [ ] **Step 1: Implement `TripWizard`**

Steps:
0. Title (required)
1. Destinations: list of name inputs; button **+ Adicionar destino**; remove allowed if length > 1; optional up/down reorder buttons (↑ ↓) — include reorder (spec desirable)
2. Dates: for each destination, `start` + `end` date inputs; show live total:

```tsx
const total = tripDateRange(
  destinations.map((d, i) => ({
    id: String(i),
    name: d.name,
    startDate: d.startDate || null,
    endDate: d.endDate || null,
  })),
);
// UI: "Período total: 2026-12-20 → 2026-12-30" or "Defina as datas"
```

Validation:
- step0: title trimmed
- step1: ≥1 destination with non-empty name
- step2: each destination with a date must have `end >= start` when both set; require at least one start and one end across the trip (or require every destination has both dates — **require both dates on every destination**)

Last button: **Criar viagem**

- [ ] **Step 2: Update trips list/detail display**

In `TripsHome` / `TripDetail` header:
- Show `trip.destinations.map(d => d.name).join(" → ")` instead of only `trip.destination`
- Keep `formatTripDates(trip)` for total range

Remove or stop using `NewTripForm`; `trip-new` screen renders `TripWizard`.

- [ ] **Step 3: Wire save in `demo-app.tsx`**

```ts
onSave={(input) => {
  const nextSpace = createTrip(space, input);
  persist({ user, space: nextSpace });
  const tripId = nextSpace.trips[0]?.id;
  setMessage("Viagem criada. Use Sync para enviar à parceira.");
  setScreen(tripId ? { name: "trip-detail", tripId } : { name: "trips" });
}}
```

- [ ] **Step 4: Run unit tests + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/demo-trip-wizard.tsx components/demo-trips.tsx components/demo-app.tsx
git commit -m "feat: add viagem wizard with multi-destination dates"
```

---

### Task 7: Polish nav/copy, build static demo, verify

**Files:**
- Modify: `components/demo-app.tsx` (nav active states include hub/wizards)
- Modify: `README.md` only if demo instructions mention old home
- Run: `scripts/build-demo-static.cjs` via npm script

- [ ] **Step 1: Nav active states**

```ts
active={screen.name === "hub" || screen.name === "idea-wizard"}
// Lista/ideas:
active={screen.name === "ideas" || screen.name === "detail"}
// trips includes trip-wizard alias of trip-new
```

Copy: ensure no “1–5” strings remain (`rg "1.?5|1–5" components lib`).

- [ ] **Step 2: Build static demo**

Run: `npm run build:demo-static`
Expected: `out/` generated successfully

- [ ] **Step 3: Publish gh-pages (if credentials allow)**

```bash
# follow existing project pattern — if README documents it, use that;
# otherwise:
npx gh-pages -d out -b gh-pages
```

If publish fails, leave `out/` committed instructions in PR body; do not block.

- [ ] **Step 4: Final commit**

```bash
git add components/demo-app.tsx README.md
git commit -m "chore: polish redesign nav and refresh demo build notes"
git push -u origin cursor/juntos-redesign-hub-b575
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Hub home + stacked cards + Ver ideias | Task 5 |
| Ideia wizard A→B→C | Task 5 |
| Viagem título → destinos → datas/destino | Task 6 |
| Multi destination + total range | Task 2 + 6 |
| Sunset visual | Task 3 |
| Ratings 1–10 | Task 1 |
| Sync includes destinations | Task 2 |
| Checklist/roteiro/docs after create | Task 6 (opens detail) |
| Motion 2–3 | Task 3 (+ shell/hub enter) |

No TBD placeholders. Types aligned: `TripDestination`, `tripDateRange`, `createTrip({ destinations })`, wizards’ `onSave` shapes match store.
