### Task 7 Report: Polish nav/copy, build static demo, verify

Status: completed.

Changes:
- Added a dedicated `Lista` bottom-nav tab in `components/demo-app.tsx`.
- Set `Lista` active for `ideas` and `detail`; existing `Início` remains active for `hub` and `idea-wizard`.
- Confirmed `Viagens` remains active for `trips`, `trip-new`, and `trip-detail`.
- Updated the remaining Task 1 Minor copy in `app/(app)/items/[id]/page.tsx` from `1 a 5` to `1 a 10`.
- README already described the current GitHub Pages demo and static build command, so no README edit was needed.

Verification:
- `rg "1.?5|1–5|1 a 5|1-5" components lib app`
  - Only false-positive class names remained (`gap-1.5`, `shadow-black/15`).
- `npm run build:demo-static`
  - Succeeded.
  - Generated `out/`.
- Extra check: `npm run lint`
  - Failed on existing lint rules unrelated to the nav/copy edits:
    - `react-hooks/set-state-in-effect` in `components/demo-app.tsx`.
    - `@typescript-eslint/no-require-imports` in `scripts/build-demo-static.cjs`.

Publish:
- Ran `npx --yes gh-pages -d out -b gh-pages`.
- Publish succeeded with output: `Published`.

Concerns:
- No blocking concerns. Static demo build and gh-pages publish succeeded.
- Repo lint is not green due to the existing errors listed above.
