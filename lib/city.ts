// Cidade do item (spec-layout-categorias.md §7): items.city text null, de 1 a
// 60 caracteres, sem espaço nas pontas (o check do banco é o mesmo).
export const CITY_MAX_LENGTH = 60;

export type CityResult = { ok: true; city: string | null } | { ok: false };

// Valor do formulário → o que vai para o banco: trim; vazio vira null; mais de
// 60 caracteres depois do trim é recusado. Conta como o char_length do
// Postgres (por caractere, não por unidade UTF-16).
export function normalizeCity(value: unknown): CityResult {
  if (value === null || value === undefined) {
    return { ok: true, city: null };
  }

  if (typeof value !== "string") {
    return { ok: false };
  }

  const city = value.trim();

  if (!city) {
    return { ok: true, city: null };
  }

  return Array.from(city).length > CITY_MAX_LENGTH
    ? { ok: false }
    : { ok: true, city };
}
