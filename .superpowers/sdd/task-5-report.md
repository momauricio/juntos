# Task 5 Report: Hub + Ideia wizard

## Status

Completed.

## Implemented

- Added `components/demo-hub.tsx` with the Juntos hero, two stacked animated action cards (`Ideia de Role`, `Nova Viagem`), and `Ver ideias registradas`.
- Added `components/demo-idea-wizard.tsx` using `WizardShell` for the 3-step idea flow:
  - type selection from `TYPE_LABELS`
  - required title
  - optional URL
- Wired `components/demo-app.tsx` to:
  - default authenticated users to `hub`
  - show the existing list under `ideas`
  - replace the old inline `NewItem` flow with `idea-wizard`
  - save ideas through `addItem`
  - use bottom nav labels `Início | Viagens | Sync | Ajustes`

## Verification

- `npm run build:demo-static` succeeded.

## Concerns

- Did not build a trip wizard, per Task 5 instruction. `Nova Viagem` opens the existing trip form.
